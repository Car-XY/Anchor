from __future__ import annotations

import re
from datetime import date

from flask import Blueprint, jsonify, request

from ..auth import ApiError, current_user
from ..repository import build_overview

bp = Blueprint("api", __name__, url_prefix="/api")

HEX = re.compile(r"#[0-9a-fA-F]{6}")


def body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Send the request body as JSON.")
    return data


def text(data: dict, key: str, label: str, *, required: bool = True, max_len: int = 200) -> str:
    value = data.get(key)
    value = value.strip() if isinstance(value, str) else ""
    if required and not value:
        raise ApiError(f"Add a {label}.", field=key)
    if len(value) > max_len:
        raise ApiError(f"Keep the {label} under {max_len} characters.", field=key)
    return value


def parse_date(data: dict, key: str, label: str, *, required: bool = True) -> date | None:
    raw = data.get(key)
    if not raw:
        if required:
            raise ApiError(f"Pick a {label}.", field=key)
        return None
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        raise ApiError(f"The {label} isn't a valid date.", field=key)


def colour(data: dict, key: str = "color") -> str:
    value = data.get(key) or "#5EC8E5"
    if not HEX.fullmatch(value):
        raise ApiError("Pick a colour from the palette.", field=key)
    return value.upper()


def overview_response(status: int = 200):
    """writes send back the updated overview so the frontend doesn't recalc anything"""
    return jsonify(build_overview(current_user())), status


# importing these registers their routes on bp
from . import account, companion, habits, reflections  # noqa: E402,F401
