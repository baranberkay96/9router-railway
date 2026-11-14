# NOTICE: 9Router Self-Hosted AI Router and Gateway template

## Software in the image

| Component | Version | Source | Licence | How it is used |
|---|---|---|---|---|
| 9Router | 0.5.116 (git tag `v0.5.116`, commit `1339107e624d1ab150c6a0c2c2ee22caa7e9db2f`, 2026-11-08) | Docker Hub `decolua/9router:0.5.116@sha256:12086f97857f784ab7762e95595f70d71279a7a60c800af0f100183e8da7ea36` (multi-arch index; amd64 manifest `sha256:5830ef4e…1099c`), built by upstream CI from that tag | MIT, Copyright (c) 2024-2026 decolua and contributors. Third-party npm packages bundled by upstream keep their own licences. | Unmodified base image; its `custom-server.js` is started by our launcher |
| Node.js | 22.23.4 | Part of the upstream image (`node:22.23.4-alpine`) | MIT and bundled third-party licences | Runs 9Router and the launcher |
| Alpine Linux packages (incl. `su-exec`, `ffmpeg`) | as in the pinned image | Part of the upstream image | Various | Unchanged |

The MIT licence text of 9Router is reproduced below as required.

```
MIT License

Copyright (c) 2024-2026 decolua and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Written for this template

All files in this package were written for this template: `services/9router/Dockerfile`, the launcher in `services/9router/railway/` (`railway-start.sh`, `launcher.mjs`, `lib/*.mjs`, `test/*.mjs`), and `template.json`, `TEMPLATE.md`, `README.md` and this file. No code or text was copied from 9Router, from market templates or from other authors' templates. The launcher writes one row to 9Router's `apiKeys` table using the column layout of 9Router's own schema (`src/lib/db/schema.js` at `v0.5.116`); the unit tests recreate that table layout to test against.

The icon is 9Router's own `public/favicon.svg` from the upstream repository at tag `v0.5.116`, referenced by URL on jsDelivr. It identifies the software the template deploys.

## Upstream sources checked (2026-11-14, read only, nothing executed locally)

- Source tarball of tag `v0.5.116` and of `v0.5.119` (newest tag, no image published for it yet): `Dockerfile`, `DOCKER.md`, `docker-compose.yml`, `.env.example`, `CLAUDE.md`, `custom-server.js`, `src/proxy.js`, `src/dashboardGuard.js` (public paths, API-key check for `/v1`, loopback-only routes), `src/app/api/auth/login/route.js` (INITIAL_PASSWORD, default `123456`, remote login refused while the default is in use), `src/lib/auth/{dashboardSession,trustedPeer,loginLimiter}.js`, `src/lib/db/{driver,paths,schema}.js`, `src/lib/db/repos/{apiKeysRepo,settingsRepo}.js` (key lookup per request, default settings), `src/shared/utils/{apiKey,machineId}.js`, `src/lib/dataDir.js`, `src/app/layout.js` (Google Analytics tag).
- Docker Hub tags and registry manifest/config of `decolua/9router:0.5.116` (entrypoint, env, layer sizes: 303 MB compressed for amd64; revision label matches the tag).

## Market templates reviewed

| Template | Source | Use |
|---|---|---|
| `9router` ("9Router") | image `decolua/9router:latest` | Read for comparison only (config and README). Nothing copied. |
| `9router-gateway`, `9router-ai-gateway`, `9router-7`, `9router-3` | images `decolua/9router` (latest or older digests) | Compared configuration only. Nothing copied. |

## Names, affiliation and acceptable use

9Router is a name of its respective owners. Provider and tool names (OpenAI, Anthropic, Claude Code, Codex, Cursor, Google, OpenRouter, Ollama and others) belong to their owners and are used only to describe compatibility. This is a community template; it is not affiliated with, sponsored or endorsed by the 9Router authors, any AI provider or Railway.

Users must only connect accounts and API keys they are entitled to use and must follow each provider's terms, which may restrict using consumer subscriptions through third-party tools or sharing them. Railway's Fair Use Policy (https://railway.com/legal/fair-use) forbids using Railway to evade usage limits and to operate proxy or anonymization services. The template does not advertise or enable any feature for sharing accounts or circumventing provider limits; upstream defaults are left unchanged.
