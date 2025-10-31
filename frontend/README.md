# SEOmation Frontend

React + TypeScript single-page application for the SEOmation platform. It consumes the existing Express backend to drive authentication, onboarding, topic generation, and dashboard analytics.

## Key Features
- **Authentication** — Login & signup flows validated with `zod`, wired to `/api/auth/*` endpoints (`src/pages/Auth`).
- **First-login onboarding** — Collects company niche, platforms, tone, cadence, and persists to both backend (`/api/users/me`) and local profile store (`src/pages/Onboarding`).
- **Personalized dashboard** — Sidebar workspace shell, metrics, analytics chart (`recharts`), calendar, and topic suggestion cards that hydrate from `/api/topics` with smart fallbacks (`src/pages/Dashboard`).
- **Shared infrastructure** — Axios client with automatic refresh-token handling, React context for auth + onboarding state, reusable UI components (buttons, inputs, cards).

## Getting Started
1. Ensure Node.js ≥ **20.19** (Vite warns on older versions).
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Configure API base URL in `.env`:
   ```
   VITE_API_BASE_URL=http://localhost:3000/api
   ```
   Defaults to the local backend if omitted.
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Production build & type-check:
   ```bash
   npm run build
   ```

## Project Structure
```
frontend/
├── public/                 # Static assets
├── src/
│   ├── api/                # Axios clients for backend resources
│   ├── components/         # Reusable UI + dashboard widgets
│   ├── contexts/           # Auth & onboarding providers
│   ├── hooks/              # Convenience hooks
│   ├── pages/              # Route-level views (Auth, Onboarding, Dashboard)
│   ├── utils/              # Constants, storage helpers, error parsing
│   └── validation/         # zod schemas for forms
└── vite.config.ts          # Vite + path alias configuration
```

## Backend Integration Notes
- Auth routes expect and return `accessToken` & `refreshToken`; the client stores them in localStorage and rotates refresh tokens automatically (`src/api/client.ts`).
- Business profile data is cached in localStorage per user id to keep onboarding state across sessions (`src/contexts/OnboardingContext.tsx`).
- Topic cards render backend results when available, otherwise generate niche-aware fallbacks so the dashboard stays populated on first run.

Happy building!
