from __future__ import annotations

from sqlalchemy import delete, select

from ..auth import ApiError, current_user, login_required
from ..extensions import db
from ..models import Habit, HabitLog
from ..repository import user_today
from . import body, bp, colour, overview_response, parse_date, text


def _own_habit(habit_id: int) -> Habit:
    habit = db.session.get(Habit, habit_id)
    if habit is None or habit.user_id != current_user().id:
        raise ApiError("That habit doesn't exist.", 404)
    return habit


def _fields(data: dict) -> dict:
    start = parse_date(data, "start", "start date")
    end = parse_date(data, "end", "end date", required=False)
    if end and end < start:
        raise ApiError("The end date needs to be on or after the start date.", field="end")
    return {
        "title": text(data, "title", "title", max_len=120),
        "description": text(data, "notes", "note", required=False, max_len=500),
        "start_date": start,
        "end_date": end,
        "colour": colour(data),
    }


@bp.get("/overview")
@login_required
def get_overview():
    return overview_response()


@bp.post("/habits")
@login_required
def create_habit():
    db.session.add(Habit(user_id=current_user().id, **_fields(body())))
    db.session.commit()
    return overview_response(201)


@bp.patch("/habits/<int:habit_id>")
@login_required
def update_habit(habit_id: int):
    habit = _own_habit(habit_id)
    for key, value in _fields(body()).items():
        setattr(habit, key, value)
    # if the dates got narrower, delete logs that are now outside them
    outside = HabitLog.completed_on < habit.start_date
    if habit.end_date:
        outside = outside | (HabitLog.completed_on > habit.end_date)
    db.session.execute(delete(HabitLog).where(HabitLog.habit_id == habit.id, outside))
    db.session.commit()
    return overview_response()


@bp.delete("/habits/<int:habit_id>")
@login_required
def delete_habit(habit_id: int):
    db.session.delete(_own_habit(habit_id))
    db.session.commit()
    return overview_response()


@bp.put("/habits/<int:habit_id>/logs/<day>")
@login_required
def set_log(habit_id: int, day: str):
    """{"done": true} ticks the day, {"done": false} unticks it"""
    habit = _own_habit(habit_id)
    on = parse_date({"day": day}, "day", "day")
    if on > user_today(current_user()):
        raise ApiError("You can't log a day that hasn't happened yet.")
    if on < habit.start_date or (habit.end_date and on > habit.end_date):
        raise ApiError("That day is outside this habit's dates.")
    done = bool(body().get("done"))
    existing = db.session.scalar(
        select(HabitLog).where(HabitLog.habit_id == habit.id, HabitLog.completed_on == on)
    )
    if done and existing is None:
        db.session.add(HabitLog(habit_id=habit.id, completed_on=on))
    elif not done and existing is not None:
        db.session.delete(existing)
    db.session.commit()
    return overview_response()
