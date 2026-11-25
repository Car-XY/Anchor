"""db queries -> the plain dataclasses that services/metrics.py uses"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from .extensions import db
from .models import Habit, HabitLog, Reflection, User
from .services.metrics import HabitData, ReflectionData, overview


def user_now(user: User) -> datetime:
    try:
        return datetime.now(ZoneInfo(user.timezone or "UTC"))
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now(ZoneInfo("UTC"))


def user_today(user: User) -> date:
    """today's date for the user (railway runs in UTC so date.today() is wrong at night)"""
    return user_now(user).date()


def load_habits(user_id: int) -> list[HabitData]:
    habits = db.session.scalars(
        select(Habit).where(Habit.user_id == user_id).order_by(Habit.id)
    ).all()
    done: dict[int, set[date]] = defaultdict(set)
    # all logs in one query (the old version did one query per habit)
    rows = db.session.execute(
        select(HabitLog.habit_id, HabitLog.completed_on)
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(Habit.user_id == user_id)
    )
    for habit_id, day in rows:
        done[habit_id].add(day)
    return [
        HabitData(
            id=h.id,
            title=h.title,
            notes=h.description or "",
            start=h.start_date,
            end=h.end_date,
            color=h.colour,
            done=done[h.id],
        )
        for h in habits
    ]


def load_reflections(user_id: int) -> list[ReflectionData]:
    rows = db.session.scalars(
        select(Reflection)
        .where(Reflection.user_id == user_id)
        .order_by(Reflection.entry_date.desc(), Reflection.id.desc())
    ).all()
    return [ReflectionData(id=r.id, title=r.title, day=r.entry_date, content=r.content) for r in rows]


def build_overview(user: User) -> dict:
    return overview(load_habits(user.id), load_reflections(user.id), user_today(user))
