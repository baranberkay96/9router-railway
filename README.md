# Deploy and Host 9Router with Railway

9Router is an open-source AI router and gateway. It gives your coding tools and apps one OpenAI-compatible endpoint (plus Anthropic- and Gemini-style routes) and forwards each request to the provider accounts and API keys you connect, with format translation, model fallback and usage tracking. This template runs 9Router 0.5.116 with a password-protected dashboard and a ready-made API key.

## About Hosting 9Router

9Router is a Next.js dashboard and routing engine in one Node.js process that stores its state in SQLite. This community template runs the upstream image pinned by digest on a Railway volume, so every deploy runs the same bytes and your providers, keys and settings survive redeploys. Security is on from the first boot: the dashboard password and an API key are generated at deploy, the `/v1` API rejects every request without a valid key, and a boot self-check logs that it does. Invalid values in the deploy form never fail the deploy; they fall back safely and the log says what to fix.

## Common Use Cases

- One base URL and key for Claude Code, Codex CLI, Cursor, Cline, Continue and other OpenAI- or Anthropic-compatible clients, backed by your own provider accounts
- Fallback chains ("combos") that move to another provider or model when one fails, with request format translation between OpenAI, Anthropic and Gemini styles
- A shared AI gateway for internal tools and agents on Railway's private network, with usage and cost tracking
- Mixing hosted APIs (OpenAI, Anthropic, Google, OpenRouter and many others) with self-hosted models (Ollama, or any OpenAI-compatible server added as a custom provider)

## Dependencies for 9Router Hosting

- 9Router 0.5.116, the official `decolua/9router` image (included)
- A Railway volume at `/app/data` for the SQLite database (included)
- Your own provider accounts or API keys, connected in the dashboard after deploy

### Deployment Dependencies

- 9Router source, docs and releases: https://github.com/decolua/9router
- Railway Fair Use Policy: https://railway.com/legal/fair-use
- Railway private networking: https://docs.railway.com/guides/private-networking

### Implementation Details

| Service | Source | Purpose |
|---|---|---|
| 9Router | `services/9router` (upstream image `decolua/9router:0.5.116` by digest, plus a small launcher) | Dashboard and API on `PORT` 20128, public domain, `/api/health` healthcheck, volume `/app/data` |

**First login.** Open the public domain and sign in with the password from the `INITIAL_PASSWORD` variable (Variables tab). Set your own password under Settings; from then on the stored password applies and `INITIAL_PASSWORD` is ignored. Sessions last 24 hours. After 5 wrong passwords, login pauses for 30 seconds, then longer.

**Connect providers.** In the dashboard, add the providers you use (API keys, or sign-ins the provider allows) and optionally build combos for fallback. Requests use 9Router model ids such as `{provider-prefix}/{model}` or a combo name; `GET /v1/models` lists what is available to your key.

**Use the API.** The key is in `NINEROUTER_API_KEY` and the base URL in `NINEROUTER_PUBLIC_BASE_URL` (`https://{your-domain}/v1`). Send the key as `Authorization: Bearer`, `x-api-key` or `x-goog-api-key`.

```bash
curl https://{your-domain}/v1/chat/completions \
  -H "Authorization: Bearer {NINEROUTER_API_KEY}" -H "Content-Type: application/json" \
  -d '{"model": "{model-id}", "messages": [{"role": "user", "content": "Hello"}]}'
```

- OpenAI SDKs, Codex CLI, Cursor, Cline: base URL `https://{your-domain}/v1`, API key `{NINEROUTER_API_KEY}`.
- Claude Code: `ANTHROPIC_BASE_URL=https://{your-domain}` and `ANTHROPIC_AUTH_TOKEN={NINEROUTER_API_KEY}`.
- Other Railway services in this project: reference `${{9Router.NINEROUTER_PRIVATE_BASE_URL}}` and `${{9Router.NINEROUTER_API_KEY}}`. This uses the private network and adds no egress.

**Authentication model.** Upstream 9Router protects everything except `/api/health`, the login and a few public status routes. The dashboard and its API need the login session. `/v1`, `/v1beta`, `/responses` and `/codex` need an API key for every request that comes through Railway's proxy or the private network. The launcher adds `NINEROUTER_API_KEY` to 9Router's key list at every boot (shown as "Railway (NINEROUTER_API_KEY)"). Change the variable and redeploy to rotate it, or empty it to remove that key. Keys created in the dashboard are never touched. Routes that install software or read local tool files are limited to loopback by upstream and are not reachable from the internet.

**Fail-safe values.** An `INITIAL_PASSWORD` that is empty, shorter than 12 or longer than 128 characters locks password login with a random password instead of using upstream's public default `123456`. Fix the variable and redeploy. A short `JWT_SECRET` is replaced by a secret 9Router keeps on the volume. An invalid `PORT` falls back to 20128, and an invalid `NINEROUTER_API_KEY` removes the managed key. Each case is logged as `[railway] WARNING`.

**Data.** The SQLite database (`/app/data/db/data.sqlite`, with automatic backups in `db/backups`) holds providers, OAuth tokens, keys, combos, settings and usage. Treat the volume and its backups as secrets. `HOME` also points into the volume, so nothing 9Router writes there is lost.

**Resources.** Measured on Railway: about 0.1 GB RAM idle and 0.2 GB at most during a burst of 600 API and page requests (20 in parallel), with near-zero CPU at idle. It ran the same burst under a 0.5 GB limit without errors or restarts, so every plan works, including Trial (1 GB) and Free (0.5 GB). The image is about 0.3 GB compressed. Keep one replica: the SQLite volume cannot be shared. Responses sent through the public domain count as egress; use the private URL from other Railway services.

**Pinning and upgrades.** The image is pinned by tag and digest in `services/9router/Dockerfile`. To upgrade, change it to a newer `decolua/9router` release digest, read the upstream changelog and redeploy; the volume carries your data over (9Router migrates its database on start). Optional extras such as the Headroom token-saver sidecar can be added as another service and pointed to with `HEADROOM_URL`.

**Privacy notes.** The upstream dashboard page loads Google Analytics. 9Router's optional cloud sync to 9router.com is off by default; leave it off to keep credentials on your volume. Request logging and observability are also off by default.

**Acceptable use.** Use 9Router only with accounts and API keys you are entitled to use, and follow each provider's terms. Some providers do not allow their consumer subscriptions to be used through third-party tools or shared with others; check before you connect one. Railway's Fair Use Policy forbids using Railway to evade usage limits and to operate proxy or anonymization services, so do not use this deployment to share accounts, resell access or get around provider limits. This is a community template; it is not affiliated with or endorsed by the 9Router authors or any AI provider.

### Why Deploy 9Router on Railway?

Railway gives 9Router an HTTPS domain, a persistent volume and private networking to your other services, with usage-based billing and nothing to administer. Your tools get one always-on, key-protected endpoint for the provider accounts you already have.
