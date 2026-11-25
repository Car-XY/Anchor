from __future__ import annotations

import logging

from flask import Flask, abort, jsonify, request, send_from_directory
from flask_wtf.csrf import CSRFError
from sqlalchemy import event
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException

from .config import BACKEND_DIR, Config
from .extensions import csrf, db, migrate


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):
    # sqlite has foreign keys off by default, so ON DELETE CASCADE does nothing without this
    if type(dbapi_conn).__module__.startswith("sqlite3"):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()


def create_app(config: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config)
    if not app.config["SECRET_KEY"] or app.config["SECRET_KEY"] == "local-dev-key-only":
        logging.getLogger(__name__).warning("SECRET_KEY is not set; using an insecure development key.")

    db.init_app(app)
    migrate.init_app(app, db, directory=str(BACKEND_DIR / "migrations"))
    csrf.init_app(app)

    from . import models  # noqa: F401 - models have to be imported before create_all
    from .api import bp as api_bp
    from .auth import ApiError
    from .auth import bp as auth_bp
    from .cli import register_cli

    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    register_cli(app)

    with app.app_context():
        # makes the tables on first run. for schema changes after that use
        # flask db migrate + flask db upgrade
        db.create_all()

    @app.errorhandler(ApiError)
    def _api_error(err: ApiError):
        return jsonify(error=err.message, field=err.field), err.status

    @app.errorhandler(CSRFError)
    def _csrf_error(err):
        return jsonify(error="Your session expired. Refresh the page and try again."), 400

    @app.errorhandler(HTTPException)
    def _http_error(err: HTTPException):
        if request.path.startswith("/api/"):
            return jsonify(error=err.description), err.code
        return err

    @app.after_request
    def _headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    # serve the built frontend
    dist = app.config["FRONTEND_DIST"]

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def spa(path: str):
        if path.startswith("api/"):
            abort(404)
        if path and (dist / path).is_file():
            resp = send_from_directory(dist, path)
            if path.startswith("assets/"):  # vite hashes these names so they can be cached forever
                resp.cache_control.max_age = 31536000
                resp.cache_control.immutable = True
            return resp
        if (dist / "index.html").is_file():
            resp = send_from_directory(dist, "index.html")
            resp.cache_control.no_cache = True
            return resp
        return (
            "<h1>Anchor</h1><p>The frontend hasn't been built yet. Run <code>npm run build</code> "
            "in the project root, or use <code>npm run dev</code> and open http://localhost:5173.</p>",
            503,
        )

    return app
