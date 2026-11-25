import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture
def app():
    from anchor import create_app
    from anchor.config import TestConfig

    app = create_app(TestConfig)
    yield app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user(client):
    res = client.post(
        "/api/auth/register",
        json={"username": "cary", "password": "password1", "confirmation": "password1", "timezone": "America/Toronto"},
    )
    assert res.status_code == 201, res.get_json()
    return res.get_json()["user"]
