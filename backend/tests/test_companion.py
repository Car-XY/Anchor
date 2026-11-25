from datetime import date, datetime

import pytest

from anchor.services import companion as c
from anchor.services.demo import demo_habits, demo_reflections
from anchor.services.metrics import HabitData, ReflectionData, overview

TODAY = date(2026, 11, 24)


def demo_overview(scale=1.0):
    habits = [HabitData(id=i + 1, title=h["title"], notes=h["notes"], start=h["start"], end=h["end"],
                        color=h["color"], done=h["done"]) for i, h in enumerate(demo_habits(TODAY, rate_scale=scale))]
    refs = [ReflectionData(id=i + 1, title=r["title"], day=r["date"], content=r["content"])
            for i, r in enumerate(demo_reflections(TODAY))]
    return overview(habits, refs, TODAY)


def test_context_mentions_real_data():
    ov = demo_overview()
    text = c.build_context(ov, datetime(2026, 11, 24, 21, 5), "America/Toronto")
    assert "Read 20 pages" in text
    assert "Steadier than I expected" in text
    assert "Sea state:" in text
    # 14 day marks per habit line
    line = next(l for l in text.splitlines() if l.startswith("- Morning run"))
    assert len(line.rsplit(" ", 1)[1]) == 14


def test_system_prompt_has_safety_and_identity():
    p = c.system_prompt("Pip", "seal")
    assert "Pip" in p and "harbour seal" in p
    assert "988" in p
    assert "not a licensed professional" in p


@pytest.mark.parametrize("hour", [7, 13, 21])
@pytest.mark.parametrize("scale", [1.0, 0.2])
def test_local_nudges_are_short_and_present(hour, scale):
    tips = c.local_nudges(demo_overview(scale), hour)
    assert tips
    assert all(len(t) < 160 for t in tips)


def test_storm_gets_a_gentle_tip():
    ov = demo_overview(0.1)
    assert ov["summary"]["sea_state"] == "storm"
    assert any("smallest habit" in t for t in c.local_nudges(ov, 10))


def test_nudge_key_changes_with_progress():
    ov = demo_overview()
    k1 = c.nudge_key(ov, 10, "seal", "Pip")
    ov["habits"][3]["done_today"] = True
    assert c.nudge_key(ov, 10, "seal", "Pip") != k1


def test_openrouter_requires_key():
    with pytest.raises(c.CompanionUnavailable):
        c.openrouter_chat([], api_key="", model="x")


def test_openrouter_parses_reply(monkeypatch):
    class Res:
        status_code, ok = 200, True

        def json(self):
            return {"choices": [{"message": {"content": " Hello there "}}]}

    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, auth=headers["Authorization"], model=json["model"])
        return Res()

    monkeypatch.setattr(c.requests, "post", fake_post)
    assert c.openrouter_chat([{"role": "user", "content": "hi"}], api_key="k", model="m") == "Hello there"
    assert seen == {"url": "https://openrouter.ai/api/v1/chat/completions", "auth": "Bearer k", "model": "m"}


def test_openrouter_maps_errors(monkeypatch):
    class Res:
        status_code, ok = 401, False

    monkeypatch.setattr(c.requests, "post", lambda *a, **k: Res())
    with pytest.raises(c.CompanionError, match="rejected"):
        c.openrouter_chat([], api_key="bad", model="m")
