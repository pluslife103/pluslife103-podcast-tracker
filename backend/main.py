import os
from dotenv import load_dotenv
load_dotenv()

import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from apscheduler.schedulers.background import BackgroundScheduler

from models import SessionLocal, Episode
from rss import fetch_episodes, migrate_pub_dates
from transcribe import transcribe_episode

app = FastAPI(title="股癌 Podcast Tracker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()


def _auto_sync():
    new_count = fetch_episodes()
    if new_count == 0:
        return
    db = SessionLocal()
    pending = (
        db.query(Episode)
        .filter(Episode.status == "pending")
        .order_by(desc(Episode.pub_date))
        .limit(1)
        .all()
    )
    ids = [ep.id for ep in pending]
    db.close()
    for ep_id in ids:
        transcribe_episode(ep_id)


@app.on_event("startup")
def startup():
    migrate_pub_dates()
    fetch_episodes()
    scheduler.add_job(_auto_sync, "interval", hours=1, id="auto_sync")
    scheduler.start()


@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown()


@app.get("/api/episodes")
def list_episodes(limit: int = 100, offset: int = 0):
    db = SessionLocal()
    try:
        episodes = (
            db.query(Episode)
            .order_by(desc(Episode.pub_date))
            .offset(offset)
            .limit(limit)
            .all()
        )
        total = db.query(Episode).count()
        return {"total": total, "episodes": [_ep_dict(ep) for ep in episodes]}
    finally:
        db.close()


@app.get("/api/episodes/{ep_id}")
def get_episode(ep_id: int):
    db = SessionLocal()
    try:
        ep = db.query(Episode).filter(Episode.id == ep_id).first()
        if not ep:
            raise HTTPException(404, "Episode not found")
        return _ep_dict(ep, include_transcript=True)
    finally:
        db.close()


@app.post("/api/episodes/{ep_id}/transcribe")
def trigger_transcribe(ep_id: int, bg: BackgroundTasks):
    db = SessionLocal()
    try:
        ep = db.query(Episode).filter(Episode.id == ep_id).first()
        if not ep:
            raise HTTPException(404, "Episode not found")
        if ep.status == "transcribing":
            return {"status": "transcribing"}
        if ep.status == "done":
            return {"status": "done"}
        ep.status = "pending"
        ep.error_msg = None
        db.commit()
    finally:
        db.close()
    bg.add_task(transcribe_episode, ep_id)
    return {"status": "queued"}


@app.post("/api/sync")
def sync(bg: BackgroundTasks):
    bg.add_task(fetch_episodes)
    return {"status": "syncing"}


def _ep_dict(ep: Episode, include_transcript: bool = False) -> dict:
    d = {
        "id": ep.id,
        "title": ep.title,
        "pub_date": ep.pub_date,
        "duration": ep.duration,
        "description": ep.description,
        "status": ep.status,
        "error_msg": ep.error_msg,
        "updated_at": ep.updated_at.isoformat() if ep.updated_at else None,
    }
    if include_transcript:
        d["transcript"] = ep.transcript
    return d
