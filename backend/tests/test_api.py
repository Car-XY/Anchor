# api tests against an in-memory sqlite db
# run from the project root: python -m pytest backend/tests
from datetime import date, timedelta


def today_iso(client):
    return client.get("/api/overview").get_json()["today"]


def test_session_and_auth_flow(client):
    assert client.get("/api/session").get_json()["user"] is None
    res = client.post("/api/auth/register", json={"username": "a", "password": "short", "confirmation": "short"})
    assert res.status_code == 400 and res.get_json()["field"] == "password"
    res = client.post("/api/auth/register", json={"username": "a", "password": "password1", "confirmation": "password1"})
    assert res.status_code == 201
    assert client.get("/api/session").get_json()["user"]["username"] == "a"
    client.post("/api/auth/logout")
    assert client.get("/api/overview").status_code == 401
    assert client.post("/api/auth/login", json={"username": "A", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "A", "password": "password1"}).status_code == 200


def test_duplicate_username(client, user):
    client.post("/api/auth/logout")
    res = client.post("/api/auth/register", json={"username": "CARY", "password": "password1", "confirmation": "password1"})
    assert res.status_code == 409


def test_habit_crud_and_logs(client, user):
    today = today_iso(client)
    start = (date.fromisoformat(today) - timedelta(days=5)).isoformat()
    res = client.post("/api/habits", json={"title": "Run", "start": start, "color": "#5ec8e5"})
    assert res.status_code == 201
    hid = res.get_json()["habits"][0]["id"]
    assert res.get_json()["habits"][0]["color"] == "#5EC8E5"

    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    for day in (yesterday, today):
        ov = client.put(f"/api/habits/{hid}/logs/{day}", json={"done": True}).get_json()
    assert ov["habits"][0]["streak"] == 2
    assert ov["summary"]["all_done"] is True

    ov = client.put(f"/api/habits/{hid}/logs/{today}", json={"done": False}).get_json()
    assert ov["habits"][0]["done_today"] is False

    tomorrow = (date.fromisoformat(today) + timedelta(days=1)).isoformat()
    assert client.put(f"/api/habits/{hid}/logs/{tomorrow}", json={"done": True}).status_code == 400

    # moving the start date later should drop the older logs
    res = client.patch(f"/api/habits/{hid}", json={"title": "Run far", "start": today, "color": "#5EC8E5"})
    assert res.get_json()["habits"][0]["done"] == []

    assert client.patch(f"/api/habits/{hid}", json={"title": "x", "start": today, "end": start}).status_code == 400
    assert client.delete(f"/api/habits/{hid}").get_json()["habits"] == []


def test_cannot_touch_other_users_habits(client, user):
    hid = client.post("/api/habits", json={"title": "Mine", "start": today_iso(client)}).get_json()["habits"][0]["id"]
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"username": "other", "password": "password1", "confirmation": "password1"})
    assert client.delete(f"/api/habits/{hid}").status_code == 404


def test_reflections(client, user):
    ov = client.post("/api/reflections", json={"title": "Day 1", "date": today_iso(client), "content": "Good"}).get_json()
    rid = ov["reflections"][0]["id"]
    ov = client.patch(f"/api/reflections/{rid}", json={"title": "Day one", "date": ov["today"], "content": "Fine"}).get_json()
    assert ov["reflections"][0]["title"] == "Day one"
    assert client.delete(f"/api/reflections/{rid}").get_json()["reflections"] == []


def test_companion_without_key(client, user):
    assert client.get("/api/companion").get_json()["configured"] is False
    nudge = client.get("/api/companion/nudge").get_json()
    assert nudge["source"] == "local" and nudge["text"]
    assert client.post("/api/companion/messages", json={"content": "hi"}).status_code == 503


def test_companion_chat_with_mocked_model(app, client, user, monkeypatch):
    from anchor.api import companion as api

    app.config["OPENROUTER_API_KEY"] = "test"
    calls = []

    def fake(messages, **kwargs):
        calls.append(messages)
        return "How did today go?"

    monkeypatch.setattr(api, "openrouter_chat", fake)
    res = client.post("/api/companion/messages", json={"content": "Debrief my day"})
    assert res.status_code == 201
    assert [m["role"] for m in res.get_json()["messages"]] == ["user", "assistant"]
    assert calls[0][0]["role"] == "system" and "Anchor" in calls[0][0]["content"]
    assert len(client.get("/api/companion/messages").get_json()["messages"]) == 2
    assert client.delete("/api/companion/messages").get_json()["messages"] == []


def test_account_preferences(client, user):
    res = client.patch("/api/account", json={"companion": {"animal": "shark", "name": "Finn", "roam": False}})
    assert res.get_json()["user"]["companion"] == {"animal": "shark", "name": "Finn", "roam": False}
    assert client.patch("/api/account", json={"companion": {"animal": "dragon"}}).status_code == 400
    assert client.patch("/api/account", json={"timezone": "Mars/Base"}).status_code == 400


def test_spa_fallback_and_api_404(client):
    assert client.get("/api/nope").get_json()["error"]
    assert client.get("/api/health").get_json() == {"ok": True}
