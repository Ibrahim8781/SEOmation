# SEOmation Full Stack Guide

SEOmation is split into three apps:

- `ai/`: FastAPI service for topics, content, SEO hints, and image generation
- `backend/`: Express + Prisma API for auth, onboarding, drafts, publishing, and scheduling
- `frontend/`: React + Vite app for the user-facing product

## Current stack

- Frontend: React 19, Vite 7, TypeScript, React Router
- Backend: Node.js, Express, Prisma, PostgreSQL
- AI: FastAPI, Google Gemini, Groq fallback, Qdrant/Cohere optional, live web research

## Run locally

Start the services in this order.

### 1. AI service

```powershell
cd SEOmation/ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

Health check:

```powershell
curl http://127.0.0.1:8001/health
```

### 2. Backend

```powershell
cd SEOmation/backend
npm install
npx prisma generate
npm run dev
```

Health check:

```powershell
curl http://localhost:3000/health
```

### 3. Frontend

```powershell
cd SEOmation/frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

## Environment variables

### `backend/.env`

Required core values:

```ini
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/seomation?schema=public"
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
AI_SERVICE_URL="http://127.0.0.1:8001"
PORT=3000
NODE_ENV=development
```

Optional but supported:

```ini
AI_MOCK=false
APP_BASE_URL=http://localhost:3000
INTEGRATION_CALLBACK_BASE=http://localhost:3000
PUBLIC_ASSET_BASE_URL=http://localhost:3000
ASSET_PUBLIC_PATH=/media
ASSET_STORAGE_DIR=
AI_TOPIC_TIMEOUT_MS=60000
AI_CONTENT_TIMEOUT_MS=360000
AI_IMAGE_TIMEOUT_MS=450000
AI_SEO_TIMEOUT_MS=30000
```

### `ai/.env`

Main active values:

```ini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite-preview
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
SERPAPI_KEY=...
SERPER_API_KEY=...
EMBEDDER=cohere
COHERE_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
DATABASE_URL=postgresql+psycopg2://postgres:<password>@localhost:5432/seomation
IMAGE_PROVIDER_ORDER=together,kie,huggingface,placeholder
TOGETHER_API_KEY=...
KIE_API_KEY=...
HUGGINGFACE_API_KEY=...
LOG_LEVEL=info
```

### `frontend/.env`

```ini
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_TIMEOUT_MS=360000
```

## Useful commands

### Frontend

```powershell
npm run dev
npm run build
npm run lint
```

### Backend

```powershell
npm run dev
npm test
npm run test:coverage
```

### AI

```powershell
uvicorn main:app --reload --port 8001
python -m pytest ai/tests/test_rag_strategy.py
```

## Testing notes

- Frontend build is the main local safety check for routing/UI changes.
- Backend tests require a dedicated test database.
- The backend test suite refuses to wipe a non-test database by design.
- Point `DATABASE_URL` at a local test database name containing `test`, `jest`, or `ci`, or set `ALLOW_TEST_DATABASE_RESET=true` only if you know exactly what you are doing.

Example safe backend test database:

```ini
DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/seomation_test?schema=public"
```

## Current app behavior

- Topic suggestions use indexed memory plus optional live trend research.
- Content generation uses live research first and only uses indexed RAG when the topic matches the user's niche.
- Draft SEO scoring is backend-driven and stays aligned with saved draft fields.
- Generated images are persisted by the backend and served from `/media/...`.
- Publishing and scheduling are handled by the backend service layer.

## Important repo notes

- There is now a root `.gitignore`; do not commit local `.env` files, `__pycache__`, build output, or generated media.
- `backend/storage/` contains runtime media assets and should stay local.
- If you change Prisma schema, create and commit the migration files.

## Troubleshooting

### Refresh sends me to the wrong page

- Restart the frontend after route changes.
- Clear browser `sessionStorage` if an old route was saved.
- Make sure onboarding state is loaded before route guards are evaluated.

### AI content fails even though search worked

- Check Gemini quota logs first.
- Groq is only a fallback and can rate-limit independently.
- Search success does not mean the LLM provider chain succeeded.

### Images generate but do not render

- Make sure backend is serving `/media`.
- Confirm `PUBLIC_ASSET_BASE_URL` or `APP_BASE_URL` matches how the browser reaches the backend.
- Check the stored image URL in the draft and verify it loads directly.

## Deployment reminder

This repo does not currently have a backend build step that emits `dist/` for Node. The backend runs directly from `src/server.js`.

For production:

- run the AI app with `uvicorn`
- run the backend with `node src/server.js` or a process manager
- build the frontend with `npm run build` and host `frontend/dist`
