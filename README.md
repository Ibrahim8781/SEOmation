# SEOmation – Full Stack Guide

This guide covers the full workflow for running and developing the SEOmation project now that the AI, backend, and frontend are integrated. Follow the sections in order—each layer depends on the previous one being healthy.

---

## 1. Architecture Overview

| Layer     | Tech stack | Purpose |
|-----------|------------|---------|
| Backend   | Node.js (Express), Prisma ORM, PostgreSQL | Auth, onboarding profile storage, AI orchestration, topic/content persistence |
| AI Service| FastAPI (Python), Groq / Cohere / Qdrant integrations | Topic suggestions, blog/caption generation, SEO hinting |
| Frontend  | React + Vite + TypeScript | User onboarding, dashboard, topic curation, blog writer UI |

All three services talk locally during development:

- Backend exposes REST APIs on `http://localhost:3000/api`.
- AI FastAPI listens on `http://127.0.0.1:8000`.
- Frontend points to the backend via `VITE_API_BASE_URL`.
- PostgreSQL can run either on the host or within Docker as long as it’s reachable on `localhost:<port>`.

---

## 2. Prerequisites

Install these locally before attempting to run anything:

- **Node.js** ≥ 20.19.0 (Vite build issues warnings on older 20.x releases).
- **npm** (bundled with Node).
- **Python** ≥ 3.10 (the AI service uses FastAPI + async clients).
- **PostgreSQL** 13+ (local install or Docker container published on a host port).
- **Git**, **PowerShell** (on Windows), **Make** or similar optional command helpers.

Optional but recommended:

- `psql` CLI or pgAdmin for database checks.
- Docker Desktop if you prefer containerised Postgres/Qdrant.

---

## 3. Repository Layout

```
SEOmation/
├── ai/          # Python FastAPI service
├── backend/     # Node/Express API, Prisma schema
├── frontend/    # React + Vite application
└── README.md    # This document
```

Each subproject has its own `.env` file. Do **not** commit real secrets.

---

## 4. Environment Variables

### Backend (`SEOmation/backend/.env`)

```ini
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/seomation?schema=public"
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
AI_SERVICE_URL="http://127.0.0.1:8000"
AI_MOCK=false
PORT=3000
NODE_ENV=development
```

Adjust credentials to match your Postgres instance (or Docker container). `AI_MOCK=true` returns fake responses without calling FastAPI but skips real generation.

### AI service (`SEOmation/ai/.env`)

```
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDER=cohere
COHERE_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
DATABASE_URL=postgresql+psycopg2://postgres:<password>@localhost:5432/seomation
APP_PORT=8000
```

Fill in whichever external providers you actually use; unset keys fall back to mock behaviour depending on the service.

### Frontend (`SEOmation/frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## 5. Installation Steps

Perform these once per machine (or whenever dependencies change).

### 5.1 AI dependencies

```powershell
cd SEOmation/ai
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
# If you’re using pgvector extensions:
pip install -r requirements-pgvector.txt
```

### 5.2 Backend dependencies

```powershell
cd SEOmation/backend
npm install
npx prisma generate
```

### 5.3 Frontend dependencies

```powershell
cd SEOmation/frontend
npm install
```

---

## 6. Database Setup

1. Ensure PostgreSQL is running (`net start postgresql-x64-*` on Windows or check `docker ps` if containerised).
2. Verify credentials with `psql -h localhost -p <port> -U <user> -d <database>`.
3. Create the database if needed:
   ```sql
   CREATE DATABASE seomation;
   ```
4. Apply the schema:
   ```powershell
   cd SEOmation/backend
   npx prisma migrate deploy
   ```

If you want seed data, create it manually or extend Prisma with seeding scripts.

---

## 7. Start the Stack (Development)

> Use separate terminals (or tabs) so logs remain readable.

1. **AI service**
   ```powershell
   cd SEOmation/ai
.venv\Scripts\activate
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```
   Health check: `curl http://127.0.0.1:8000/health`

2. **Backend API**
   ```powershell
   cd SEOmation/backend
   npm run dev
   ```
   Health check: `curl http://localhost:3000/api/health`

3. **Frontend**
   ```powershell
   cd SEOmation/frontend
   npm run dev
   ```
   Visit the URL shown (default `http://localhost:5173`).

The correct start order is AI → backend → frontend. The backend needs the AI service for live generation, and the frontend needs the backend for auth, topics, and content.

---

## 8. Typical Workflow / Features to Test

1. **Auth**
   - Register a user via the frontend.
   - Confirm `/api/auth/register` and `/api/users/me` succeed (check backend logs).

2. **Onboarding**
   - Complete the onboarding form once; data persists via `users/preferences.onboarding`.
   - The dashboard loads afterwards without redirecting back to `/onboarding`.

3. **Dashboard**
   - Use “Refresh topics” to hit `/api/topics/generate`.
   - Suggested topics include trend tags, focus keywords, and metadata.
   - Selecting “Craft outline” routes to the writer with the topic pre-filled.

4. **Blog Writer**
   - With a topic selected, click “Send Prompt” to call `/api/content/generate`.
   - Check that the response includes blog HTML/plain text, optional LinkedIn/Instagram variants, and SEO score/hints.
   - Try a custom prompt (without `topicId`) to confirm the fallback branch works.

5. **SEO Hints**
   - The writer automatically calls `/api/content/:id/seo-hints`; verify the score and suggestions change when the focus keyword is missing.

6. **Database verification (optional)**
   - `npx prisma studio` or direct `psql` to inspect `topic` and `content` tables.

---

## 9. Production Builds

Once you’re ready to ship:

- **AI service**: run via `uvicorn main:app --host 0.0.0.0 --port 8000`. Consider using gunicorn/uvicorn workers, proper logging, and environment-specific configs.
- **Backend**:
  ```powershell
  cd SEOmation/backend
  npm run build     # transpiles to dist/
  npm run start     # uses node dist/server.js
  ```
- **Frontend**:
  ```powershell
  cd SEOmation/frontend
  npm run build
  npm run preview   # or serve dist/ with nginx/Vercel/etc.
  ```

Remember to copy the frontend `dist/` output to your static hosting solution. The Vite build warns when bundles exceed 500 kB; adjust `build.chunkSizeWarningLimit` or introduce code-splitting if necessary.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Authentication failed against database` | Wrong Postgres credentials or container not published on host port | Update `DATABASE_URL`, restart container, ensure `psql` can connect |
| Backend logs show `FastAPI connection error` | AI service not running or wrong `AI_SERVICE_URL` | Start `uvicorn`, verify `http://127.0.0.1:8000/health` |
| Blog drafts look like short social captions | Platform value wasn’t normalised (`BLOG` vs `blog`) | Restart backend (already fixed in `fastapi.service.js`) |
| Frontend build warns about Node version | Node < 20.19.0 | Upgrade Node (e.g. via nvm-windows) |
| JWT errors after refresh | Old tokens cached | Clear browser storage (localStorage + sessionStorage) |
| 401s on protected routes | Missing/expired tokens | Log back in; backend refresh endpoint will rotate tokens |

---

## 11. Useful Commands Reference

```powershell
# Prisma
npx prisma migrate deploy
npx prisma studio

# FastAPI (with live reload)
uvicorn main:app --reload --port 8000

# Backend lint/tests (if configured)
npm run lint
npm test

# Frontend type check & lint
npm run typecheck
npm run lint
npm run build
```

---

## 12. Contributing Tips

- Keep `.env` secrets out of version control.
- Run `npm run build` in frontend before pushing to ensure TypeScript passing.
- When touching Prisma schema, run `prisma migrate dev` (for local iterations) and commit the migration files.
- Keep AI responses predictable in development by toggling `AI_MOCK` or setting smaller target lengths while prototyping.
- Document any external API limits (Groq, Cohere, Qdrant) the team should be aware of.

---

## 13. Support / Next Steps

- If you add a new AI provider, extend `ai/services/llm_service.py` and update backend transformations accordingly.
- For production hardening, add HTTPS termination, rate limiting (already stubbed in backend middleware), and centralised logging.
- Consider containerising all services with Docker Compose once development flows stabilise.

Happy building! If you run into any new blockers, start with the troubleshooting table and then inspect the relevant service logs.***
