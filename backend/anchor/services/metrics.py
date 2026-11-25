"""streaks, hold rates and the sea state.

no db or flask in here so it's easy to test. used by the api, the companion and the cli.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable

# % of due habits held over the last 7 days
CALM_AT = 0.75
OPEN_AT = 0.45
TIMELINE_DAYS = 400  # timeline only needs about a year of logs


@dataclass
class HabitData:
    id: int
    title: str
    notes: str
    start: date
    end: date | None
    color: str
    done: set[date] = field(default_factory=set)

    def is_due(self, day: date) -> bool:
        return self.start <= day and (self.end is None or day <= self.end)


@dataclass
class ReflectionData:
    id: int
    title: str
    day: date
    content: str


def streak(habit: HabitData, today: date) -> int:
    """days in a row ending today.

    if today isn't ticked yet, count from yesterday instead. the old version
    started at today, so every streak showed 0 until you logged something
    """
    day = today if today in habit.done else today - timedelta(days=1)
    count = 0
    while habit.is_due(day) and day in habit.done:
        count += 1
        day -= timedelta(days=1)
    return count


def longest_streak(habit: HabitData) -> int:
    best = run = 0
    prev: date | None = None
    for day in sorted(habit.done):
        run = run + 1 if prev and day - prev == timedelta(days=1) else 1
        best = max(best, run)
        prev = day
    return best


def hold_rate(habits: Iterable[HabitData], today: date, days: int) -> float | None:
    """fraction of due habit-days that got done in the last `days` days.

    today only counts once it's done. None if nothing was due
    """
    due = held = 0
    for offset in range(days):
        day = today - timedelta(days=offset)
        for h in habits:
            if not h.is_due(day):
                continue
            done = day in h.done
            if offset == 0 and not done:
                continue
            due += 1
            held += done
    return held / due if due else None


def sea_state(rate: float | None) -> str:
    if rate is None or rate >= CALM_AT:
        return "calm"
    return "open" if rate >= OPEN_AT else "storm"


def habit_payload(h: HabitData, today: date) -> dict:
    cutoff = today - timedelta(days=TIMELINE_DAYS)
    rate30 = hold_rate([h], today, 30)
    return {
        "id": h.id,
        "title": h.title,
        "notes": h.notes,
        "start": h.start.isoformat(),
        "end": h.end.isoformat() if h.end else None,
        "color": h.color,
        "done": sorted(d.isoformat() for d in h.done if d >= cutoff),
        "streak": streak(h, today),
        "longest_streak": longest_streak(h),
        "rate30": None if rate30 is None else round(rate30, 4),
        "due_today": h.is_due(today),
        "done_today": today in h.done,
    }


def overview(habits: list[HabitData], reflections: list[ReflectionData], today: date) -> dict:
    """everything the frontend needs in one response"""
    rate7 = hold_rate(habits, today, 7)
    payload_habits = [habit_payload(h, today) for h in habits]
    due = [h for h in payload_habits if h["due_today"]]
    done = [h for h in due if h["done_today"]]
    best = max((h for h in payload_habits if h["streak"]), key=lambda h: h["streak"], default=None)
    first = min((h.start for h in habits), default=None)
    refs = sorted(reflections, key=lambda r: (r.day, r.id), reverse=True)
    return {
        "today": today.isoformat(),
        "habits": payload_habits,
        "reflections": [
            {"id": r.id, "title": r.title, "date": r.day.isoformat(), "content": r.content}
            for r in refs
        ],
        "summary": {
            "hold_rate_7": None if rate7 is None else round(rate7, 4),
            "sea_state": sea_state(rate7),
            "due_today": len(due),
            "done_today": len(done),
            "all_done": bool(due) and len(done) == len(due),
            "best": {"habit_id": best["id"], "title": best["title"], "days": best["streak"]} if best else None,
            "reflections_30": sum(1 for r in reflections if r.day > today - timedelta(days=30)),
            "days_aboard": (today - first).days + 1 if first and first <= today else 0,
        },
    }
