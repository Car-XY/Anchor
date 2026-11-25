"""Entry point for gunicorn (`wsgi:app`), `flask --app wsgi`, and Electron."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root (one level up) or from backend/.
for candidate in (Path(__file__).resolve().parent.parent / ".env", Path(__file__).resolve().parent / ".env"):
    if candidate.is_file():
        load_dotenv(candidate)
        break

from anchor import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("ANCHOR_PORT", "5000")))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="127.0.0.1", port=port, debug=debug)
