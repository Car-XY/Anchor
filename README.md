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

## The AI companion

- Each request sends the model your habits, the last 14 days of logs for each one, your streaks and hold rates, today's status, the sea state and your 3 latest reflections (see `services/companion.py → build_context`).
- The persona is written as an experienced habit coach who listens like a counsellor: motivational interviewing, CBT, ACT and behaviour design. It doesn't present itself as a therapist. It tells people to get professional help when something is bigger than habits, and it points to 988 / 911 if someone mentions self-harm or danger.
- Floating tips are cached per user until the data changes, so they don't cost a model call on every page load. Without a key, tips come from local rules that use the same data.
- Chat is limited to 40 per user.