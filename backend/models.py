import os
import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./podcast.db")
# Railway/Render 用 postgres:// 舊格式，SQLAlchemy 需要 postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    guid = Column(String, unique=True, index=True)
    title = Column(String, nullable=False)
    pub_date = Column(String)
    duration = Column(String)
    audio_url = Column(String)
    description = Column(Text)
    transcript = Column(Text)
    status = Column(String, default="pending")  # pending | transcribing | done | error
    error_msg = Column(Text)
    # LLM analysis results (JSON arrays stored as text)
    rec_stocks = Column(Text)
    unrec_stocks = Column(Text)
    rec_industries = Column(Text)
    unrec_industries = Column(Text)
    analysis_status = Column(String, default="pending")  # pending | analyzing | done | error
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


Base.metadata.create_all(engine)


def add_missing_columns():
    """Add new columns to existing tables without dropping data."""
    from sqlalchemy import text, inspect as sa_inspect
    new_cols = {
        "rec_stocks": "TEXT",
        "unrec_stocks": "TEXT",
        "rec_industries": "TEXT",
        "unrec_industries": "TEXT",
        "analysis_status": "VARCHAR(32) DEFAULT 'pending'",
    }
    with engine.connect() as conn:
        existing = [c["name"] for c in sa_inspect(engine).get_columns("episodes")]
        for col, col_type in new_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE episodes ADD COLUMN {col} {col_type}"))
        conn.commit()
