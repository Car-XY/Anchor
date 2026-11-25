from __future__ import annotations

from ..auth import ApiError, current_user, login_required
from ..extensions import db
from ..models import Reflection
from . import body, bp, overview_response, parse_date, text


def _own(reflection_id: int) -> Reflection:
    ref = db.session.get(Reflection, reflection_id)
    if ref is None or ref.user_id != current_user().id:
        raise ApiError("That reflection doesn’t exist.", 404)
    return ref


def _fields(data: dict) -> dict:
    return {
        "title": text(data, "title", "title", max_len=160),
        "entry_date": parse_date(data, "date", "date"),
        "content": text(data, "content", "few words about how it went", max_len=20_000),
    }


@bp.post("/reflections")
@login_required
def create_reflection():
    db.session.add(Reflection(user_id=current_user().id, **_fields(body())))
    db.session.commit()
    return overview_response(201)


@bp.patch("/reflections/<int:reflection_id>")
@login_required
def update_reflection(reflection_id: int):
    ref = _own(reflection_id)
    for key, value in _fields(body()).items():
        setattr(ref, key, value)
    db.session.commit()
    return overview_response()


@bp.delete("/reflections/<int:reflection_id>")
@login_required
def delete_reflection(reflection_id: int):
    db.session.delete(_own(reflection_id))
    db.session.commit()
    return overview_response()
