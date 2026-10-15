# HamAva security, performance and UI/UX audit

Date: 2026-10-16. Scope: this repository and its two services running on localhost (backend `127.0.0.1:8037`, frontend production build `127.0.0.1:3037`). All live testing was against the owner's own local instance.

## 1. Outcome

All 18 findings from the code review and live testing are fixed (12 backend, 6 frontend), along with 3 high-severity dependency advisories. Each fix was re-tested live through the frontend proxy. The backend has one automated test per fix (10 tests, all passing before the last one-line refactor). The frontend was checked in headless Chrome in both languages and both themes, with no CSP violations, hydration errors or console errors other than the favicon, which is now added.

Two verification steps are **still pending** because this machine ran out of memory and Claude Code stopped them:

- a production rebuild that picks up the last four small frontend edits (a darker light-theme green for contrast, a dashboard skeleton matching the real layout, no scroll-fade on community list rows, and the new app icon);
- a re-run of the backend tests, bandit and semgrep after a one-line refactor of the points rule. The refactor gives the same results for every input.

Run these before merging:

```bash
cd backend && .venv/bin/python -m pytest -q
cd ../frontend && npm run build
```

## 2. Method and skills used

| Skill | How it was used |
| --- | --- |
| `red-team-tactics`, `red-team-tools` | Attacker goals per OWASP Top 10 and MITRE ATT&CK. Each one was tried live with curl against localhost before and after the fix. Scanners such as nmap and nikto were not installed; the attack surface is two HTTP ports and 9 routes, so targeted requests covered it. |
| `security-auditor`, `security-scanning-security-sast` | Line-by-line review of every source file, plus bandit, semgrep (security-audit, owasp-top-ten, python, typescript, react, nextjs rulesets), `npm audit` and `pip-audit`. |
| `attack-tree-construction` | Section 3. |
| `apple-design` | UI/UX pass in section 6. |
| `ponytail:ponytail`, `ponytail-review` | Smallest correct diff, stdlib and platform features first, no new runtime dependencies. Review result in section 7. |
| `graphify` | Knowledge graph of the codebase in `graphify-out/` (section 8). |
| `security-audit` | Launched as a separate background agent. It stopped early on an API rate limit and produced no findings. |

A multi-agent re-verification workflow (independent red-team retest, code review and UI review agents) was blocked by a safety classifier. As instructed, it was skipped rather than retried on another model. The manual live re-test in section 4 covers the same ground.

## 3. Attack tree

Root goal: **abuse HamAva for value or disruption.** Every branch is OR.

```
Abuse HamAva
├── Mint value from nothing
│   ├── Farm answer points by re-answering            [was open]  -> once per question, none on own question, 500/day cap
│   ├── Turn points into spendable credit via "cash"  [was open]  -> cash becomes a pending payout, never credit
│   └── Stuff votes on a question                     [was open]  -> one vote per member, repeats are no-ops
├── Act on or read another member's data
│   ├── One shared global member for all callers      [was open]  -> per-visitor opaque session, server-side state
│   └── Forge a request from another site (CSRF)      [partial]   -> SameSite=Lax + Sec-Fetch-Site check + JSON-only (415)
├── Exhaust the service
│   ├── Flood writes                                  [was open]  -> per-member / per-IP token buckets, 429 + Retry-After
│   ├── Huge bodies                                   [parsed]    -> 16 KB cap before parsing (413), also for chunked
│   └── Unbounded in-memory growth                    [was open]  -> caps on sessions, buckets, questions, answers, orders
├── Mislead other members
│   ├── Bidi-override text in titles and answers      [was open]  -> overrides and control chars stripped, dir="auto"
│   └── Junk tags or numbers                          [was open]  -> tag enum; canonical Iranian mobile number
├── Attack the browser
│   ├── Script injection                              [low]       -> React escaping + nonce CSP with strict-dynamic
│   └── Framing / clickjacking                        [was open]  -> frame-ancestors 'none' + X-Frame-Options DENY
└── Reach internals
    ├── Public API docs reveal the schema             [was open]  -> docs off unless HAMAVA_DOCS=1
    ├── Backend port open on every interface          [was open]  -> bound to 127.0.0.1 in compose
    ├── Known framework CVEs                          [3 high]    -> next 16.4.0, npm audit fix (0 left)
    └── Container breakout aids                       [root user] -> non-root, read-only FS, cap_drop ALL, no-new-privileges
```

## 4. Findings and fixes

Severity is the pre-fix rating. "Verified" means the request that showed the problem was replayed after the fix and now fails safely.

### Backend (`backend/main.py`)

| # | Sev | Finding (observed before) | Fix | Verified after |
| --- | --- | --- | --- | --- |
| B1 | High | No identity. `/api/me` returned the one shared member, phone included, to anyone, and anyone could spend its points. | Per-visitor session. The `sid` cookie is HttpOnly and SameSite=Lax, holds a 24-byte random id, and keeps its state server-side with LRU eviction. | Two visitors get different ids. Visitor A redeems 1000 points and visitor B's balance is unchanged. |
| B2 | High | Five answers to one question earned 250 points. | Points are paid once per question, never for your own question, with a 500/day cap. | Repeat answers earn 0. An answer on your own question earns 0. |
| B3 | Med | Five votes from one caller added 5. | One vote per member per question. | Four votes leave the count unchanged after the first. |
| B4 | Med | "cash" redeem added spendable wallet credit. | Cash goes to a new `cash_pending` field; credit is unchanged. | Credit is the same, and pending rises by 10,000 toman. |
| B5 | Med | 200 of 200 rapid posts were accepted. A 3 MB body was parsed before rejection. | Pure ASGI guard with O(1) token buckets (burst 10 writes, then 1 per 2 s; 60 reads, then 20/s), a 16 KB body cap, and bounded stores. | 36 of 40 flood writes get 429. A 3 MB body gets 413 in 0.2 s. |
| B6 | Med | Compose published the backend on all interfaces, bypassing the frontend. | `127.0.0.1:8037:8000`. | Config only; Docker was not run on this host. |
| B7 | Low | `/docs`, `/redoc` and `/openapi.json` were public. | Enabled only with `HAMAVA_DOCS=1`. | 404 directly and through `/api/..` traversal attempts. |
| B8 | Low | No security headers; `server: uvicorn` banner. | nosniff, `Referrer-Policy: no-referrer`, frame denial, CORP, `default-src 'none'` CSP, `no-store` by default, `--no-server-header`. | Headers present; banner gone. |
| B9 | Low | `+1 555 555 5555`, `1234567890` and 10-digit numbers were accepted. | Persian and Arabic digits normalized, then an Iranian mobile regex; stored as `09xxxxxxxxx`. | Bad numbers get 422. `۰۹۱۲۳۴۵۶۷۸۹` is stored as `09123456789`. |
| B10 | Low | Tag was any string, for example `<b>weird</b>`. | `Literal` enum. | 422. |
| B11 | Low | Orders with contact details were kept forever. | Bounded buffer of 10,000 orders; retention noted in the README. | Config only. |
| B12 | Low | Container ran as root; uvicorn unpinned. | `USER nobody`, `uvicorn[standard]==0.53.0`, read-only FS, `cap_drop: ALL`, `no-new-privileges`, tmpfs. | Config only. |
| New | Low | Cross-site writes relied on the browser alone. | Writes need `Sec-Fetch-Site` same-origin (or absent) and `application/json`. | `cross-site` gets 403; `text/plain` gets 415. |

### Frontend (`frontend/`)

| # | Sev | Finding | Fix | Verified after |
| --- | --- | --- | --- | --- |
| F1 | Med | No CSP or other security headers; `X-Powered-By: Next.js`. | Per-request nonce CSP in `proxy.ts` (`script-src 'nonce' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`). Static headers in `next.config.ts`; `poweredByHeader: false`. | All 11 page scripts carry the nonce, and it changes per request. Zero CSP violations in Chrome across 16 page, language and theme combinations. |
| F2 | Dep | `next` 16.3.6, `sharp` and `source-map-js` had high advisories. | `next@16.4.0` pinned, `npm audit fix`. | `npm audit`: 0 vulnerabilities. |
| F3 | Low | Bidi override characters could spoof text direction. | Stripped server-side (Persian ZWNJ is kept). User text renders with `dir="auto"`. | Title returns with the override removed. |
| F4 | Low | `api()` assumed `detail` is a string. A failed fetch left skeletons forever. | Error messages normalized with status codes. `useApi` gains a retry, and every page shows an error with a retry button. | Type-checked in the production build. |
| F5 | Low | `aria-label="vote"` and `"tabs"`; no `aria-current`; heading levels skipped. | Localized labels that include the count; `aria-current="page"`; h1 then h2 order. | Lighthouse accessibility: community 93 to 95, dashboard 94 to 96. |
| F6 | Low | Frontend container ran as root. | `USER node`; read-only FS with tmpfs for `.next/cache`. | Config only. |

### Scanner results

| Tool | Before | After |
| --- | --- | --- |
| bandit | 7 Low (asserts in tests only) | Same: tests only |
| semgrep, 6 rulesets | 0 | 0 |
| npm audit | 3 high | 0 |
| pip-audit (`requirements.txt`) | 0 | 0. The full venv scan could not reach PyPI. |

## 5. Performance

Every security control was chosen for near-zero runtime cost:

- The guard is pure ASGI rather than `BaseHTTPMiddleware`, so there is no extra task or response buffering.
- Rate limiting is an O(1) dict bucket, and dict insertion order doubles as the LRU.
- Regexes are compiled once.
- The CSP adds one `randomUUID` per HTML request, and pages were already dynamic.
- Plans and stats are now browser-cacheable (`max-age` 300 s and 30 s). Fonts are cached immutable for a year and preloaded per language.

The biggest win came from removing permanent animations: aurora drift, gradient shimmer, the spinning plan border, the floating SIM card and chips, and the pulsing badge. Blur is now limited to floating chrome.

Lighthouse, mobile profile, production build:

| Page | Score | FCP | LCP | TBT | Main-thread work |
| --- | --- | --- | --- | --- | --- |
| Home | 60 → 66 | 2.0 → 1.3 s | 3.3 → 3.1 s | 1,900 → 1,970 ms | 9.1 → 6.3 s |
| Community | 79 → 82 | 1.4 → 1.1 s | 3.2 → 2.8 s | 520 → 550 ms | 3.2 → 2.9 s |
| Dashboard | 56 → 84 | 1.5 → 1.1 s | 3.6 → 2.8 s | 6,860 → 350 ms | 12.2 → 3.2 s |
| Join | 86 → 89 | 1.4 → 1.1 s | 2.8 → 2.6 s | 370 → 310 ms | 2.1 → 1.7 s |

Dashboard layout shift rose from 0.079 to 0.106. The skeleton had five blocks for a four-card layout; that is fixed in source and waits for the pending rebuild. Home total blocking time is mostly hydration of one large client component. Moving the static sections to server components is the next step there.

Back/forward cache stays disabled because dynamic, nonce-protected pages send `no-store`. That is the documented Next.js trade-off for a nonce CSP.

## 6. UI/UX (`apple-design`)

- **Response.** Hover lifts now apply only on devices that can hover, so they no longer stick on touch. Press feedback is unchanged.
- **Direct manipulation and interruptibility.** The mobile "ask" sheet has a grabber and tracks the finger 1:1, keeping the grab offset. It can be caught mid-animation from its on-screen position. Dragging up rubber-bands. Release uses Apple's momentum projection (`d = 0.998`): a flick or a drag past half dismisses it, keeping the finger's velocity. Otherwise it springs back.
- **Spatial consistency.** The sheet leaves the way it came in: down on mobile, fade and scale on desktop. Escape, the backdrop and Cancel all animate.
- **Motion.** Slow forever-loops near 0.15 Hz and full-viewport moving backgrounds are gone. Entrances animate only transform and opacity. Reduced-motion and reduced-transparency settings are still honored.
- **Materials.** Translucent blur is only on floating chrome (nav, tab bar, toasts, sheet). Content cards are solid-ish surfaces, and answers inside questions are solid, so translucent layers no longer stack.
- **Feedback.** Fields validate when you leave them, and errors are announced via `aria-live`. Every load failure shows a message with a retry button. Rate limits show a "wait a moment" message. Answers that earn nothing say "answer posted" instead of "+0 points". "Copied" appears only when the copy actually worked.
- **Wayfinding and accessibility.** The current tab is marked, nav landmarks are localized, heading order is fixed, and tag and green text pass AA contrast.
- **Copy.** New Persian strings follow the owner's UX vocabulary, for example «در انتظار پرداخت» for pending payment, «تلاش دوباره» and «دریافت اطلاعات انجام نشد». The generic "Home" label was kept: the vocabulary has no better term, and familiarity outweighs specificity here.

## 7. Ponytail review of this diff

- `backend/main.py` points rule: shrink, two assignments into one `min()` expression. Applied.
- No new runtime dependencies. The limiter, sessions, headers and CSP use stdlib and platform features.
- No abstractions with a single caller were added beyond the one requested gesture hook.
- `ponytail:` comments mark the known ceilings: in-process limiter, in-memory store, demo profile per visitor, and the tag-pinned base image.

Result: lean already, apart from the one shrink.

## 8. Knowledge graph (`graphify`)

`graphify-out/` holds `graph.html`, `graph.json` and `GRAPH_REPORT.md`: 222 nodes, 403 edges, 9 communities. The most connected nodes are `useApp`, `useApi`, `LoadError`, `Guard` and the test `client()` helper. The surprising connections link each `HANDOFF.md` finding to the code that now fixes it, for example `Guard` to B8 and `SimOrder` to B9.

Health warning: 15 edges from the docs point at code symbol names the AST extractor spelled differently. Those links are missing from the graph, but the code graph itself is complete. The folder is generated and is not committed.

## 9. Residual risks and owner decisions

1. **No real sign-up yet.** Every visitor gets a demo profile with 2,350 points, so anyone can create many sessions and inflate the public charity totals. No money moves. Before points or cash-outs carry real value, add phone and OTP sign-up and pay out only to verified members.
2. **Rewards are paid per answer** (once per question, with a daily cap), matching the product copy. Paying only for accepted answers would be a stronger anti-farming rule, but it is a business decision.
3. **Client IP depends on headers.** Next passes a client-supplied `X-Forwarded-For` through unchanged, so per-IP limits can be dodged. Per-member limits and memory caps still hold. In production, put a reverse proxy in front that overwrites the header with the real address.
4. **`style-src-attr 'unsafe-inline'`** is required by React `style` props. Moving the remaining inline styles to classes would remove it.
5. **Base images are pinned by tag only.** Pin them by digest once a registry is reachable from CI. The vendored `backend/wheels/` folder is not in git, so a clean clone needs `pip download -r requirements.txt -d wheels` before `docker compose build`.
6. **Licenses.** The bundled fonts (Inter and Vazirmatn) are under the SIL Open Font License. Add their license texts next to the files when redistributing.
