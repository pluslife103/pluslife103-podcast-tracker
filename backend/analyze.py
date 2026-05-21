import datetime
import json
import os
import re

from groq import Groq

from models import SessionLocal, Episode

PROMPT = """以下是台灣股市 podcast「股癌」的文字稿。請找出主持人明確表達正面或負面看法的股票和產業。

文字稿：
{transcript}

請只回傳 JSON，格式如下：
{{
  "rec_stocks": ["台積電 2330", "輝達 NVDA"],
  "unrec_stocks": ["英特爾 INTC"],
  "rec_industries": ["半導體", "AI 伺服器"],
  "unrec_industries": ["傳統零售"]
}}

規則：
- 只列主持人有明確正面/負面評論的，不要推測
- 股票盡量含代號或英文縮寫
- 沒有提到的類別用空陣列 []
- 只回傳 JSON，不要其他說明
"""


def analyze_episode(episode_id: int):
    db = SessionLocal()
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep or not ep.transcript or ep.analysis_status == "done":
        db.close()
        return

    ep.analysis_status = "analyzing"
    ep.updated_at = datetime.datetime.utcnow()
    db.commit()

    try:
        client = Groq(api_key=os.environ["GROQ_API_KEY"])

        # Use up to 12000 chars to stay within token limits
        transcript = ep.transcript[:12000]

        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": PROMPT.format(transcript=transcript)}],
            temperature=0.1,
            max_tokens=800,
        )

        content = resp.choices[0].message.content.strip()

        # Strip markdown code fences if present
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)
        ep.rec_stocks = json.dumps(data.get("rec_stocks", []), ensure_ascii=False)
        ep.unrec_stocks = json.dumps(data.get("unrec_stocks", []), ensure_ascii=False)
        ep.rec_industries = json.dumps(data.get("rec_industries", []), ensure_ascii=False)
        ep.unrec_industries = json.dumps(data.get("unrec_industries", []), ensure_ascii=False)
        ep.analysis_status = "done"

    except Exception as exc:
        ep.analysis_status = "error"
        ep.error_msg = (ep.error_msg or "") + f" [analyze:{str(exc)[:200]}]"

    ep.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.close()
