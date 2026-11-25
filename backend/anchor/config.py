import os
from datetime import timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        instance = BACKEND_DIR / "instance"
        instance.mkdir(exist_ok=True)
        return f"sqlite:///{instance / 'anchor.db'}"
    # railway gives postgres:// urls but sqlalchemy needs the driver in the url
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "local-dev-key-only"
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # flask's normal signed cookie sessions (no more flask_session folder)
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "").lower() in {"1", "true", "yes"}

    # frontend sends the token in the X-CSRFToken header
    WTF_CSRF_TIME_LIMIT = None

    FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", REPO_DIR / "frontend" / "dist"))

    # companion uses openrouter. key goes in .env
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
    OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5").strip()
    OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    OPENROUTER_APP_URL = os.environ.get("OPENROUTER_APP_URL", "https://anchor-productivity.up.railway.app")
    COMPANION_MESSAGES_PER_HOUR = int(os.environ.get("COMPANION_MESSAGES_PER_HOUR", "40"))


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    WTF_CSRF_ENABLED = False
    OPENROUTER_API_KEY = ""
