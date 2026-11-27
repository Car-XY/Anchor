from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import current_app, jsonify
from sqlalchemy import delete, func, select

from ..auth import ApiError, current_user, login_required
from ..extensions import db
from ..models import ChatMessage, User
from ..repository import build_overview, user_now
from ..services.companion import (
    NUDGE_INSTRUCTION,
    CompanionError,
    CompanionUnavailable,
    build_context,
    nudge_key,
    openrouter_chat,
    pick_local,
    system_prompt,
)
from . import body, bp, text

HISTORY = 30  # messages of conversation sent to the model


def _configured() -> bool:
    return bool(current_app.config["OPENROUTER_API_KEY"])


def _ask(user: User, messages: list[dict], ov: dict | None = None, **kwargs) -> str:
    cfg = current_app.config
    ov = ov or build_overview(user)
    now = user_now(user)
    system = system_prompt(user.companion_name, user.companion_animal)
    context = "The user's Anchor data right now:\n\n" + build_context(ov, now, user.timezone)
    return openrouter_chat(
        [{"role": "system", "content": system}, {"role": "system", "content": context}, *messages],
        api_key=cfg["OPENROUTER_API_KEY"],
        model=cfg["OPENROUTER_MODEL"],
        base_url=cfg["OPENROUTER_BASE_URL"],
        app_url=cfg["OPENROUTER_APP_URL"],
        **kwargs,
    )


@bp.get("/companion")
@login_required
def companion_status():
    return jsonify(configured=_configured(), model=current_app.config["OPENROUTER_MODEL"])


@bp.get("/companion/nudge")
@login_required
def nudge():
    """tip for the floating companion. cached so the model only gets called when the data changes"""
    user = current_user()
    ov = build_overview(user)
    hour = user_now(user).hour
    key = nudge_key(ov, hour, user.companion_animal, user.companion_name)
    if user.nudge_key == key and user.nudge_text:
        return jsonify(text=user.nudge_text, source="cache")
    if _configured():
        try:
            tip = _ask(user, [{"role": "user", "content": NUDGE_INSTRUCTION}], ov, max_tokens=800, temperature=0.8)
            tip = tip.strip().strip('"').splitlines()[0][:220]
            user.nudge_key, user.nudge_text = key, tip
            db.session.commit()
            return jsonify(text=tip, source="ai")
        except CompanionError as exc:
            current_app.logger.warning("Companion nudge failed: %s", exc)
    return jsonify(text=pick_local(ov, hour, key), source="local")


@bp.get("/companion/messages")
@login_required
def list_messages():
    rows = db.session.scalars(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user().id)
        .order_by(ChatMessage.id.desc())
        .limit(200)
    ).all()
    return jsonify(messages=[m.to_dict() for m in reversed(rows)], configured=_configured())


@bp.post("/companion/messages")
@login_required
def send_message():
    user = current_user()
    content = text(body(), "content", "message", max_len=4000)
    if not _configured():
        raise ApiError(
            "The companion isn't connected yet. Add OPENROUTER_API_KEY to your .env file and restart Anchor.", 503
        )

    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = db.session.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.user_id == user.id, ChatMessage.role == "user", ChatMessage.created_at >= hour_ago
        )
    )
    if recent >= current_app.config["COMPANION_MESSAGES_PER_HOUR"]:
        raise ApiError("That's a lot of messages for one hour. Take a breather and come back soon.", 429)

    history = db.session.scalars(
        select(ChatMessage).where(ChatMessage.user_id == user.id).order_by(ChatMessage.id.desc()).limit(HISTORY)
    ).all()
    messages = [{"role": m.role, "content": m.content} for m in reversed(history)]
    messages.append({"role": "user", "content": content})

    try:
        reply = _ask(user, messages)
    except CompanionUnavailable:
        raise ApiError("The companion isn't connected yet.", 503)
    except CompanionError as exc:
        raise ApiError(str(exc), 502)

    mine = ChatMessage(user_id=user.id, role="user", content=content)
    theirs = ChatMessage(user_id=user.id, role="assistant", content=reply)
    db.session.add_all([mine, theirs])
    db.session.commit()
    return jsonify(messages=[mine.to_dict(), theirs.to_dict()]), 201


@bp.delete("/companion/messages")
@login_required
def clear_messages():
    db.session.execute(delete(ChatMessage).where(ChatMessage.user_id == current_user().id))
    db.session.commit()
    return jsonify(messages=[])
