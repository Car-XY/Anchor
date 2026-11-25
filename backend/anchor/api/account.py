from __future__ import annotations

from flask import jsonify

from ..auth import ApiError, current_user, login_required, valid_timezone
from ..extensions import db
from ..models import ANIMALS
from . import body, bp, text


@bp.patch("/account")
@login_required
def update_account():
    """update timezone and/or companion settings"""
    user = current_user()
    data = body()
    if "timezone" in data:
        tz = valid_timezone(data.get("timezone"))
        if not tz:
            raise ApiError("That timezone isn't recognised.", field="timezone")
        user.timezone = tz
    companion = data.get("companion") or {}
    if "animal" in companion:
        if companion["animal"] not in ANIMALS:
            raise ApiError("Pick one of the listed companions.", field="animal")
        user.companion_animal = companion["animal"]
        user.nudge_key = None  # new character, new tip
    if "name" in companion:
        user.companion_name = text(companion, "name", "name for your companion", max_len=32)
        user.nudge_key = None
    if "roam" in companion:
        user.companion_roam = bool(companion["roam"])
    db.session.commit()
    return jsonify(user=user.to_dict())
