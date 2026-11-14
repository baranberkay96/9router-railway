# 9Router Self-Hosted AI Router and Gateway: Railway template spec

## Listing

| Field | Value |
|---|---|
| Name | **9Router Self-Hosted AI Router and Gateway** (41 chars; no version label: 9Router is a fast-moving 0.x release, per the naming rule of 2026-11-11) |
| Description | OpenAI-compatible gateway for your own AI provider keys, with fallback. (71 chars) |
| Category | AI/ML |
| Tags | 9router, ai-gateway, llm-router, openai-compatible, claude-code, codex, cursor, llm-proxy, model-fallback, ai-coding |
| Icon | `https://cdn.jsdelivr.net/gh/decolua/9router@v0.5.116/public/favicon.svg` (200, image/svg+xml) |
| Repo | `baranberkay96/9router-railway`, service root `/services/9router` |

Positioning: a self-hosted router/gateway for the user's own provider accounts and API keys. Upstream's "free AI" wording, free-provider lists, multi-account rotation and proxy pools are not mentioned; the README carries the acceptable-use note (own accounts only, provider terms, Railway Fair Use Policy).

## Base market templates

About 29 "9Router" templates exist (checked 2026-11-14). The leader `9router` (4,313 active projects, health 96) uses `decolua/9router:latest`, no healthcheck, an empty `INITIAL_PASSWORD` (upstream then refuses remote login with its default password, so the user is locked out until they set one), and a start command that runs `server.js` directly, which skips upstream's `custom-server.js` client-IP handling. Others pin older digests or build from forks; several have health 0–38.

Improvements over market templates:

- Upstream image pinned by tag **and digest** (reproducible; `latest` moves several times a week).
- Dashboard password and API key generated at deploy; the API key works immediately (no dashboard step needed before the first API call).
- Upstream `custom-server.js` kept, so 9Router sees the real peer and treats proxied requests as remote.
- Healthcheck `/api/health`, dual-stack listener (`HOSTNAME=::`) for the private network, volume at `/app/data`, `HOME` on the volume.
- Rule 29: no variable value can fail the deploy; unsafe passwords lock the login instead.
- Boot self-check logs that remote `/v1/models` without a key returns 401 and with the key returns 200.

## Pinned versions

| Component | Source | Version | Released | Checked |
|---|---|---|---|---|
| 9Router | `decolua/9router:0.5.116@sha256:12086f97857f784ab7762e95595f70d71279a7a60c800af0f100183e8da7ea36` | 0.5.116 (tag commit `1339107e`) | 2026-11-08 (image pushed 2026-11-09) | 2026-11-14 |
| Node.js | in the image (`node:22.23.4-alpine`) | 22.23.4 | — | 2026-11-14 |

Newest upstream tag is `v0.5.119` (2026-11-12), but no image exists for it on Docker Hub (its `package.json` still says 0.5.116), so 0.5.116 is the newest published build. Upstream has no lockfile, so building from source would not be reproducible; using the CI-built image avoids that.

## Architecture

```
Client (Claude Code, Codex, Cursor, OpenAI SDK, curl)        other Railway services
  │ https://{domain}/v1/... + API key                          │ http://9router.railway.internal:20128/v1
  ▼                                                            ▼
Railway edge (TLS, X-Forwarded-For) ───────────► [::]:20128 9Router custom-server.js → Next.js standalone
                                                  │  dashboardGuard: /api/* needs session, /v1 needs key
                                                  │  SQLite /app/data/db/data.sqlite (WAL), backups
railway-start.sh (root: chown volume) → su-exec node → launcher.mjs
    launcher: validate variables → spawn custom-server.js → wait /api/health
              → upsert apiKeys row "railway-managed-key" → self-check via loopback with X-Forwarded-For
```

**Why no extra gate.** Upstream auth is adequate once a strong `INITIAL_PASSWORD` is set: deny-by-default for `/api/*` (JWT cookie, bcrypt password, login lockout), API key required for `/v1` from any non-loopback peer or any request with forwarding headers, loopback-only routes for anything that spawns processes. A reverse proxy in front would put 9Router behind loopback, which is exactly what upstream treats as trusted local access, so a gate would add risk, not remove it.

**Managed API key.** 9Router validates keys by looking them up in `apiKeys` per request (`validateApiKey`), without parsing the key format. The launcher inserts or updates one row with id `railway-managed-key` (name "Railway (NINEROUTER_API_KEY)") through `node:sqlite` with a busy timeout, keeps its `isActive` flag if the user switched it off, removes it when the variable is empty or invalid, and never touches other keys.

## Services

### 9Router

| Setting | Value |
|---|---|
| Source | repo `baranberkay96/9router-railway`, root `/services/9router` (Dockerfile `FROM` the pinned image) |
| Start command | none (image entrypoint `/opt/railway/railway-start.sh`) |
| Healthcheck | `/api/health` on `PORT=20128`, timeout 300 s |
| Public domain | yes, target port 20128 |
| Volume | `/app/data` |
| Restart policy | ALWAYS |
| Replicas | 1 (SQLite on a volume) |

### Variables

| Variable | Default | Notes |
|---|---|---|
| `INITIAL_PASSWORD` | `secret(32, A-Za-z0-9)` | Required. Dashboard password until one is set in the dashboard. Invalid → login locked with a random password. |
| `NINEROUTER_API_KEY` | `sk-` + `secret(48, A-Za-z0-9)` | Managed `/v1` key; empty removes it. |
| `PORT` | 20128 | Listener, healthcheck, domain target. Invalid → 20128. |
| `JWT_SECRET` | `secret(64)` | Session signing. Short → 9Router's own secret file on the volume. |
| `API_KEY_SECRET` | `secret(32)` | Checksum secret for dashboard-created keys. |
| `MACHINE_ID_SALT` | `secret(32)` | Instance id salt. |
| `BASE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | OIDC/SAML callbacks. |
| `NINEROUTER_PUBLIC_BASE_URL`, `NINEROUTER_PRIVATE_BASE_URL` | references | For clients; removed from 9Router's environment. |

Fixed by the launcher: `HOSTNAME=::`, `DATA_DIR=/app/data`, `HOME=/app/data/home`, `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`.

## Resource profile

Measured on Railway (2026-11-14, pre-publish test project):

| State | RAM | CPU |
|---|---|---|
| Idle after boot (model catalog loaded) | 0.09-0.12 GB | ~0 |
| Burst: 600 requests, 20 parallel (`/v1/models` with 5,773 catalog entries, chat completions, `/login`) | 0.20 GB max | 0.39 vCPU max |
| Same burst with a 0.5 GB / 1 vCPU limit (Free plan) | under the limit, all 450 requests answered, 0 restarts | — |

Image: 303 MB compressed (amd64) plus a few KB of launcher, far below the 4 GB Trial/Free cap. Volume: under 10 MB for a fresh instance; grows with usage history. Estimated cost: about $1-2/month idle (0.1 GB RAM), a few dollars with steady use. Minimum plan: Free (0.5 GB) works.

## Verification checklist

1. Build log: 18 launcher tests pass, `v22.23.4`.
2. Deploy log: `[railway] 9Router is up`, `managed API key ... added`, `self-check ... 401 (protected)`, `... -> 200`.
3. `/api/health` 200; `/dashboard` redirects to `/login`; login with `INITIAL_PASSWORD` works; a wrong password returns 401.
4. `/v1/models` without a key → 401; with `NINEROUTER_API_KEY` → 200; `/api/keys` without a session → 401.
5. Redeploy on the same volume: key still valid, settings kept.
6. Invalid `INITIAL_PASSWORD` (e.g. `short`): deploy stays healthy, login refused, log explains.
7. Memory idle and during requests; same under a 0.5 GB limit.

## Open questions

- Railway's edge connects from a small set of addresses, so upstream's per-IP login lockout probably buckets all internet clients together; a burst of wrong passwords from anyone can pause logins for everyone for up to 30 minutes (API keys are unaffected).
- Provider OAuth flows that redirect to `localhost` callbacks (upstream designs several for a local install) may need the manual copy-paste fallback on a hosted instance; not tested.

## Test results

Pre-publish (2026-11-14, probe template id, project deleted afterwards):

- Build: launcher tests 18/18 in the Railway build; deploy SUCCESS, `/api/health` 200. Driver `better-sqlite3`, migration #1 applied.
- Boot log: managed key added; self-check remote `/v1/models` without key 401, with key 200.
- Hands-on over the public domain: `/dashboard` without session 307 to `/login`; `/api/keys` and `/api/settings` without session 401; `/v1/models` without key 401, wrong key 401, managed key 200 (Bearer and `x-api-key`); `POST /v1/chat/completions` without key 401, with key 404 "No active credentials for provider" (no provider connected, as expected); wrong password 401; `INITIAL_PASSWORD` 200 with an `auth_token` cookie (`Secure; HttpOnly; SameSite=lax`); `/dashboard` with the session 200; `/api/keys` lists only "Railway (NINEROUTER_API_KEY)" and it equals the variable.
- Rule 29 on the same volume with `INITIAL_PASSWORD=short` and a 0.5 GB limit: deploy SUCCESS, warning logged, login with `short` refused (401), managed key unchanged and still valid (persistence across redeploy).
