# Anchor 2

Anchor 2 is the ULTIMATE rebuild of the Anchor's frontend and backend. The original CS50 app and writeup is available to find on my Github.

The concept: a **habit compass**. Each habit is a ring around the anchor and each segment is one of the last 14 days. Behind everything is a live ocean, and its **sea state follows your last 7 days**. If you held 75% or more of your due habits, it's a calm harbour; between 45% and 75%, open water; under 45%, a storm with high swells, foam and rain. The sky follows your clock (dawn, daylight, dusk, night). Your **companion** (a seal, fish, shark, turtle or octopus) swims around the screen with tips from your data. Its mood follows the sea, and it runs your end-of-day **Debrief** in its own tab.

## Project layout

```
backend/
  wsgi.py                 entry point (gunicorn, flask CLI, Electron)
  anchor/
    app.py                app factory: extensions, error handlers, serves frontend/dist
    config.py             settings from environment variables (.env)
    models.py             SQLAlchemy models: User, Habit, HabitLog, Reflection, ChatMessage
    repository.py         database reads → plain data for the services
    auth.py               session login/register/logout, login_required, CSRF token
    api/                  JSON API: habits, logs, reflections, account, companion
    services/
      metrics.py          streaks, hold rates, sea state, overview payload (pure Python)
      companion.py        companion persona, data context, local tips, OpenRouter client
      demo.py             sample data for `flask seed-demo`
    cli.py                `import-legacy` and `seed-demo` commands
  tests/                  pytest: services and the full API on in-memory SQLite
frontend/
  index.html
  src/
    main.js               boot, router, theme, sea state
    api.js                fetch wrapper (sends the CSRF token)
    state.js              app state + subscribe
    ocean/ocean.js        WebGL ocean shader (no libraries)
    components/compass.js the habit compass (SVG)
    companion/            animal SVGs and the floating companion
    views/                today, habits, reflections, timeline, debrief, settings, auth
    styles/main.css       Tailwind v4 + design tokens
vite.config.js            Vite builds frontend/ → frontend/dist
main.js                   Electron shell
```

## Run it locally (Windows, PowerShell)

```powershell
# 1. Python backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Frontend
npm install
npm run build

# 3. Settings
copy .env.example .env      # then edit .env (OPENROUTER_API_KEY can stay empty)

# 4. Bring over your old data (optional, once)
cd backend
flask --app wsgi import-legacy goal_tracker.db
#   or try it with sample data:
flask --app wsgi seed-demo --username demo --password demo1234
cd ..

# 5. Run
python backend\wsgi.py      # http://127.0.0.1:5000
npm run electron            # or as the desktop app
```

**Frontend development with hot reload:** run `python backend\wsgi.py` in one terminal and `npm run dev` in another, then open http://localhost:5173. Vite forwards `/api` to Flask.

**Tests:** `python -m pytest backend/tests`

## The AI companion

The companion uses [OpenRouter](https://openrouter.ai). Set `OPENROUTER_API_KEY` in `.env` (and in Railway's variables) and restart. `OPENROUTER_MODEL` picks the model.

- Each request sends the model your habits, the last 14 days of logs for each one, your streaks and hold rates, today's status, the sea state and your 3 latest reflections (see `services/companion.py → build_context`).
- The persona is written as an experienced habit coach who listens like a counsellor: motivational interviewing, CBT, ACT and behaviour design. It doesn't present itself as a therapist. It tells people to get professional help when something is bigger than habits, and it points to 988 / 911 if someone mentions self-harm or danger.
- Floating tips are cached per user until the data changes, so they don't cost a model call on every page load. Without a key, tips come from local rules that use the same data.
- Chat is limited to `COMPANION_MESSAGES_PER_HOUR` (default 40) per user.

## Database

SQLAlchemy models with foreign keys, cascades, unique constraints and indexes. It uses SQLite locally (`backend/instance/anchor.db`) and Postgres when `DATABASE_URL` is set. Tables are created on first run. For later schema changes, use Flask-Migrate:

```powershell
cd backend
flask --app wsgi db init                  # once
flask --app wsgi db stamp head            # once, if the tables already exist
flask --app wsgi db migrate -m "describe the change"
flask --app wsgi db upgrade
```