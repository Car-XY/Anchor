# step 1: build the frontend with node
FROM node:22-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
# skip install scripts, electron's downloads the desktop app which the site doesn't need
RUN npm ci --ignore-scripts
COPY vite.config.mjs ./
COPY frontend ./frontend
RUN npm run build

# step 2: the actual app, just python + the built frontend
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY --from=frontend /app/frontend/dist ./frontend/dist
# shell form so railway's $PORT gets filled in
CMD gunicorn --chdir backend --bind 0.0.0.0:${PORT:-8000} wsgi:app
