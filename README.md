# Hamava Mobile (هم‌آوا) — giffgaff model for Iran

Community-powered MVNO web app: free SIM ordering, community Q&A that pays points, and a rewards wallet (top-up / cash / charity).
Based on `37_giffgaff.pdf` and the filled business plan in this folder.

- `frontend/` — Next.js 16 (App Router), fa/en (RTL/LTR), light/dark, no UI libraries
- `backend/` — FastAPI, in-memory demo data

## Run

```bash
docker compose up -d --build
# web  → http://localhost:3037
# api  → http://localhost:8037/docs
```

Local dev: `cd backend && uvicorn main:app --port 8037` and `cd frontend && npm i && npm run dev`.
Backend check: `cd backend && pytest -q`.
