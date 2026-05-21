import datetime
import os
import shutil
import subprocess
import tempfile

import httpx
from groq import Groq

from models import SessionLocal, Episode

CHUNK_SECS = 600  # 10-minute chunks to stay under Groq's 25 MB limit


def _audio_duration(path: str) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip() or "0")


def _split_audio(src: str, chunk_dir: str) -> list[str]:
    pattern = os.path.join(chunk_dir, "chunk_%04d.mp3")
    subprocess.run(
        ["ffmpeg", "-i", src, "-f", "segment", "-segment_time", str(CHUNK_SECS),
         "-c", "copy", "-y", pattern],
        capture_output=True,
    )
    return sorted(
        os.path.join(chunk_dir, f)
        for f in os.listdir(chunk_dir)
        if f.endswith(".mp3")
    )


def transcribe_episode(episode_id: int):
    db = SessionLocal()
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep or ep.status in ("done", "transcribing"):
        db.close()
        return

    ep.status = "transcribing"
    ep.updated_at = datetime.datetime.utcnow()
    db.commit()

    audio_path = None
    chunk_dir = None

    try:
        # Stream-download audio to a temp file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            audio_path = f.name

        with httpx.Client(timeout=600, follow_redirects=True) as client:
            with client.stream("GET", ep.audio_url) as resp:
                resp.raise_for_status()
                with open(audio_path, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        f.write(chunk)

        # Chunk if the episode is longer than CHUNK_SECS
        duration = _audio_duration(audio_path)
        if duration > CHUNK_SECS:
            chunk_dir = tempfile.mkdtemp()
            chunks = _split_audio(audio_path, chunk_dir)
        else:
            chunks = [audio_path]

        groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
        parts: list[str] = []

        for chunk_path in chunks:
            with open(chunk_path, "rb") as f:
                res = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(chunk_path), f, "audio/mpeg"),
                    model="whisper-large-v3-turbo",
                    language="zh",
                    response_format="text",
                )
            parts.append(res if isinstance(res, str) else res.text)

        ep.transcript = "\n\n".join(parts)
        ep.status = "done"

    except Exception as exc:
        ep.status = "error"
        ep.error_msg = str(exc)[:500]

    finally:
        ep.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.close()
        if audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)
        if chunk_dir and os.path.exists(chunk_dir):
            shutil.rmtree(chunk_dir)
