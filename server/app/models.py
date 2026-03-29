from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import mapped_column, Mapped
from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)  # 4-char hex from MAC
    name: Mapped[str] = mapped_column(String(64), default="")
    color: Mapped[str] = mapped_column(String(16), default="#FF0000")
    feed_ids: Mapped[str] = mapped_column(String(128), default="default")  # comma-separated, always includes "default"
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)


class Feed(Base):
    __tablename__ = "feeds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
