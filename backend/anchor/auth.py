from __future__ import annotations

from functools import wraps
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, g, jsonify, request, session
from flask_wtf.csrf import generate_csrf
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
from .models import User

bp = Blueprint("auth", __name__, url_prefix="/api")


class ApiError(Exception):
    """Raise from a route to return {"error": message} with a status code."""

    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message, self.status, self.field = message, status, field


def current_user() -> User | None:
    if "user" not in g:
        uid = session.get("user_id")
        g.user = db.session.get(User, uid) if uid else None
    return g.user


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            return jsonify(error="Log in to continue."), 401
        return view(*args, **kwargs)

    return wrapped


def valid_timezone(name: str | None) -> str | None:
    if not name:
        return None
    try:
        ZoneInfo(name)
        return name
    except (ZoneInfoNotFoundError, ValueError):
        return None


def _credentials() -> tuple[str, str, dict]:
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username:
        raise ApiError("Enter your username.", field="username")
    if not password:
        raise ApiError("Enter your password.", field="password")
    return username, password, data


def _start_session(user: User):
    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    g.user = user


@bp.get("/session")
def get_session():
    """Who is logged in, plus the CSRF token the SPA sends back on writes."""
    user = current_user()
    return jsonify(user=user.to_dict() if user else None, csrf=generate_csrf())


@bp.post("/auth/register")
def register():
    username, password, data = _credentials()
    if len(username) > 64:
        raise ApiError("Usernames can be up to 64 characters.", field="username")
    if len(password) < 8:
        raise ApiError("Use at least 8 characters for your password.", field="password")
    if password != (data.get("confirmation") or ""):
        raise ApiError("The passwords don’t match.", field="confirmation")
    taken = db.session.scalar(select(User.id).where(func.lower(User.username) == username.lower()))
    if taken:
        raise ApiError("That username is taken.", 409, field="username")
    user = User(
        username=username,
        password_hash=generate_password_hash(password),
        timezone=valid_timezone(data.get("timezone")) or "UTC",
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ApiError("That username is taken.", 409, field="username")
    _start_session(user)
    return jsonify(user=user.to_dict(), csrf=generate_csrf()), 201


@bp.post("/auth/login")
def login():
    username, password, data = _credentials()
    user = db.session.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if user is None or not check_password_hash(user.password_hash, password):
        raise ApiError("That username and password don’t match.", 401)
    tz = valid_timezone(data.get("timezone"))
    if tz and tz != user.timezone:
        user.timezone = tz
        db.session.commit()
    _start_session(user)
    return jsonify(user=user.to_dict(), csrf=generate_csrf())


@bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True, csrf=generate_csrf())
