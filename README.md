# Hamava Mobile (هم‌آوا) — giffgaff model for Iran

Community-powered MVNO web app: free SIM ordering, community Q&A that pays points, and a rewards wallet (top-up / cash / charity).
Based on `37_giffgaff.pdf` and the filled business plan in this folder.

- `frontend/` — Next.js 16 (App Router), fa/en (RTL/LTR), light/dark, no UI libraries
- `backend/` — FastAPI, in-memory demo data

## Run

```bash
docker compose up -d --build
# web  → http://localhost:3037
# api  → http://127.0.0.1:8037 (loopback only; the browser goes through the web app's /api proxy)
```

Behind HTTPS, set `HAMAVA_SECURE_COOKIE=1` so the session cookie gets the `Secure` flag.

Local dev: `cd backend && HAMAVA_DOCS=1 uvicorn main:app --port 8037 --no-server-header` (API docs at `/docs` only with `HAMAVA_DOCS=1`) and `cd frontend && npm i && npm run dev`.
Backend check: `cd backend && pytest -q`.

## Security model (MVP)

- Each visitor gets an opaque, server-side session (`sid` cookie: HttpOnly, SameSite=Lax) and a demo profile. Real sign-up (phone + OTP) is required before points or cash-outs carry real value.
- Answer points are paid once per question, never for your own question, and capped at 500 per day.
- Writes must be same-origin JSON (`Sec-Fetch-Site` check, 415 otherwise), bodies are capped at 16 KB, and every client is rate-limited.
- Per-IP limits trust `X-Forwarded-For` from the frontend container. Put a reverse proxy in front that overwrites it with the real client address.
- All data is in memory and bounded (sessions, questions, answers, orders). Orders keep contact details only until the 10,000-order buffer rolls over or the process restarts.

See `AUDIT_REPORT.md` for the full audit.
