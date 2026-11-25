"""fake data for seed-demo (seeded so it comes out the same every time)"""
from __future__ import annotations

import random
from datetime import date, timedelta

PALETTE = ["#F08A6C", "#F2C46D", "#5EC8E5", "#9C8CF0", "#6FD3A8", "#F28DB2", "#7FB3FF", "#D6E36B"]

# title, notes, start offset, end offset, colour, hold rate, done today, recent streak length
_HABITS = [
    ("Morning run", "5 km, easy pace", -46, None, 0, 0.7, True, 0),
    ("Read 20 pages", "Currently: The Old Man and the Sea", -60, None, 1, 0.9, True, 23),
    ("Drink 2 L of water", "", -38, None, 2, 0.85, True, 0),
    ("Lights out by 11:30", "Screens off at 11", -30, None, 3, 0.55, False, 0),
    ("Two hours of deep work", "Phone in another room", -52, None, 4, 0.78, True, 0),
    ("Stretch for 10 minutes", "", -12, 20, 5, 0.8, False, 0),
]

_REFLECTIONS = [
    (-2, "Steadier than I expected",
     "Missed two runs mid-week after late nights. Moving runs before class made the rest of the week easier. "
     "Reading streak is the thing keeping me going."),
    (-9, "Sleep is the weak link",
     "Every missed habit this week traces back to going to bed late. Trying screens-off at 11 instead of just "
     "'lights out'."),
    (-16, "Deep work finally sticking", "Phone in the other room works. Two full sessions on three days."),
    (-27, "First week aboard", "Set up Anchor and started with five habits. Probably too many at once, but let's see."),
]


def demo_habits(today: date, *, rate_scale: float = 1.0, seed: int = 11) -> list[dict]:
    """rate_scale < 1 makes the last week worse (handy for testing the storm)"""
    rng = random.Random(seed)
    out = []
    for title, notes, start, end, colour, rate, done_today, run in _HABITS:
        days = set()
        for k in range(start, 0):
            r = rate * (rate_scale if k >= -7 else 1)
            if rng.random() < r or (run and k >= -run and rate_scale >= 1):
                days.add(today + timedelta(days=k))
        if done_today and rate_scale >= 1:
            days.add(today)
        out.append({
            "title": title,
            "notes": notes,
            "start": today + timedelta(days=start),
            "end": today + timedelta(days=end) if end is not None else None,
            "color": PALETTE[colour],
            "done": days,
        })
    return out


def demo_reflections(today: date) -> list[dict]:
    return [
        {"date": today + timedelta(days=o), "title": t, "content": c} for o, t, c in _REFLECTIONS
    ]
