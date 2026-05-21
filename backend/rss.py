import time
import email.utils
import feedparser
from models import SessionLocal, Episode

RSS_URL = "https://feeds.soundon.fm/podcasts/954689a5-3096-43a4-a80b-7810b219cef3.xml"


def _parse_iso(entry) -> str:
    if entry.get("published_parsed"):
        return time.strftime("%Y-%m-%dT%H:%M:%S", entry.published_parsed)
    return entry.get("published", "")


def fetch_episodes() -> int:
    feed = feedparser.parse(RSS_URL)
    db = SessionLocal()
    new_count = 0
    try:
        for entry in feed.entries:
            guid = entry.get("id") or entry.get("link", "")
            if not guid:
                continue
            if db.query(Episode).filter(Episode.guid == guid).first():
                continue

            audio_url = next(
                (enc.href for enc in entry.get("enclosures", []) if "audio" in enc.get("type", "")),
                None,
            )
            if not audio_url:
                continue

            ep = Episode(
                guid=guid,
                title=entry.get("title", ""),
                pub_date=_parse_iso(entry),
                duration=entry.get("itunes_duration", ""),
                audio_url=audio_url,
                description=(entry.get("summary", "") or "")[:2000],
            )
            db.add(ep)
            new_count += 1
        db.commit()
    finally:
        db.close()
    return new_count


def migrate_pub_dates():
    """Convert existing RFC 2822 pub_dates to ISO 8601 so string sort works."""
    db = SessionLocal()
    try:
        episodes = db.query(Episode).filter(~Episode.pub_date.like("20%")).all()
        for ep in episodes:
            if not ep.pub_date:
                continue
            try:
                parsed = email.utils.parsedate_to_datetime(ep.pub_date)
                ep.pub_date = parsed.strftime("%Y-%m-%dT%H:%M:%S")
            except Exception:
                pass
        db.commit()
    finally:
        db.close()
