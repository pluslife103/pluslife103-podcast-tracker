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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


Base.metadata.create_all(engine)
