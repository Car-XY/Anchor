# run from backend/:
#   flask --app wsgi import-legacy goal_tracker.db
#   flask --app wsgi seed-demo --username demo --password demo1234
from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path

import click
from flask import Flask
from sqlalchemy import func, select
from werkzeug.security import generate_password_hash

from .extensions import db
from .models import Habit, HabitLog, Reflection, User
from .services.demo import demo_habits, demo_reflections


def register_cli(app: Flask) -> None:
    @app.cli.command("import-legacy")
    @click.argument("path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
    def import_legacy(path: Path):
        """Copy users, habits, logs and reflections over from the old goal_tracker.db"""
        src = sqlite3.connect(path)
        src.row_factory = sqlite3.Row
        user_map: dict[int, int] = {}
        habit_map: dict[int, int] = {}
        counts = dict(users=0, skipped=0, habits=0, logs=0, reflections=0)

        for row in src.execute("SELECT id, username, hash FROM users"):
            exists = db.session.scalar(
                select(User).where(func.lower(User.username) == row["username"].lower())
            )
            if exists:
                counts["skipped"] += 1
                continue
            # old db used werkzeug hashes too so passwords carry over
            user = User(username=row["username"], password_hash=row["hash"])
            db.session.add(user)
            db.session.flush()
            user_map[row["id"]] = user.id
            counts["users"] += 1

        for row in src.execute("SELECT * FROM habits"):
            if row["user_id"] not in user_map:
                continue
            start = date.fromisoformat(row["start_date"])
            end = date.fromisoformat(row["end_date"]) if row["end_date"] else None
            if end and end < start:
                end = None
            colour = row["colour"] if row["colour"] and row["colour"].lower() != "#ffffff" else "#5EC8E5"
            habit = Habit(
                user_id=user_map[row["user_id"]],
                title=row["habit"],
                description=row["description"] or "",
                start_date=start,
                end_date=end,
                colour=colour.upper(),
            )
            db.session.add(habit)
            db.session.flush()
            habit_map[row["id"]] = habit.id
            counts["habits"] += 1

        for row in src.execute("SELECT habit_id, completed_date FROM habit_logs"):
            if row["habit_id"] in habit_map:
                db.session.add(HabitLog(habit_id=habit_map[row["habit_id"]], completed_on=date.fromisoformat(row["completed_date"])))
                counts["logs"] += 1

        for row in src.execute("SELECT * FROM reflections"):
            if row["user_id"] in user_map:
                db.session.add(Reflection(
                    user_id=user_map[row["user_id"]],
                    title=row["title"],
                    entry_date=date.fromisoformat(row["date"]),
                    content=row["content"],
                ))
                counts["reflections"] += 1

        db.session.commit()
        click.echo(
            "Imported {users} users ({skipped} already existed), {habits} habits, "
            "{logs} logged days and {reflections} reflections.".format(**counts)
        )

    @app.cli.command("seed-demo")
    @click.option("--username", default="demo", show_default=True)
    @click.option("--password", default="demo1234", show_default=True)
    @click.option("--timezone", "tz", default="America/Toronto", show_default=True)
    @click.option("--rough", is_flag=True, help="Give the last week a rough patch to see the storm.")
    def seed_demo(username: str, password: str, tz: str, rough: bool):
        """Make a demo account with ~6 weeks of fake habits and reflections"""
        if db.session.scalar(select(User).where(func.lower(User.username) == username.lower())):
            raise click.ClickException(f"User {username!r} already exists.")
        user = User(username=username, password_hash=generate_password_hash(password), timezone=tz)
        db.session.add(user)
        db.session.flush()
        from .repository import user_today

        today = user_today(user)
        for h in demo_habits(today, rate_scale=0.35 if rough else 1.0):
            habit = Habit(
                user_id=user.id, title=h["title"], description=h["notes"],
                start_date=h["start"], end_date=h["end"], colour=h["color"],
            )
            habit.logs = [HabitLog(completed_on=d) for d in sorted(h["done"])]
            db.session.add(habit)
        for r in demo_reflections(today):
            db.session.add(Reflection(user_id=user.id, title=r["title"], entry_date=r["date"], content=r["content"]))
        db.session.commit()
        click.echo(f"Created {username!r} with password {password!r}.")
