from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db

ANIMALS = ("seal", "fish", "shark", "turtle", "octopus")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """SQLite hands datetimes back without a timezone; they were stored as UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Companion preferences
    companion_animal: Mapped[str] = mapped_column(String(16), default="seal")
    companion_name: Mapped[str] = mapped_column(String(32), default="Pip")
    companion_roam: Mapped[bool] = mapped_column(default=True)
    # Cache for the floating tip so we don't call the model on every page load
    nudge_key: Mapped[str | None] = mapped_column(String(64))
    nudge_text: Mapped[str | None] = mapped_column(Text)

    habits: Mapped[list[Habit]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="Habit.id"
    )
    reflections: Mapped[list[Reflection]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )

    __table_args__ = (CheckConstraint(f"companion_animal IN {ANIMALS!r}", name="animal"),)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "timezone": self.timezone,
            "companion": {
                "animal": self.companion_animal,
                "name": self.companion_name,
                "roam": self.companion_roam,
            },
        }


class Habit(db.Model):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date]
    end_date: Mapped[date | None]
    colour: Mapped[str] = mapped_column(String(7), default="#5EC8E5")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="habits")
    logs: Mapped[list[HabitLog]] = relationship(
        back_populates="habit", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="date_order"),
    )


class HabitLog(db.Model):
    """One row per day a habit was held."""

    __tablename__ = "habit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    completed_on: Mapped[date]

    habit: Mapped[Habit] = relationship(back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "completed_on", name="uq_habit_logs_habit_day"),
        Index("ix_habit_logs_habit_day", "habit_id", "completed_on"),
    )


class Reflection(db.Model):
    __tablename__ = "reflections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(160))
    entry_date: Mapped[date]
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="reflections")

    __table_args__ = (Index("ix_reflections_user_date", "user_id", "entry_date"),)


class ChatMessage(db.Model):
    """The debrief conversation with the companion."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="messages")

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="role"),
        Index("ix_chat_messages_user_created", "user_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "created_at": as_utc(self.created_at).isoformat(),
        }
