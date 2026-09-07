<p align="center">
  <img src="docs/assets/tixrouter-logo.jpg" alt="TixRouter banner" width="100%" />
</p>

<h1 align="center">TixRouter</h1>

<p align="center">
  <strong>Self-hosted multi-provider AI gateway. One endpoint, every model, free tiers included.</strong><br/>
  The open-source alternative to OpenRouter / 9Router that runs on <em>your</em> machine.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-blue" alt="version 1.3.0" />
  <img src="https://img.shields.io/badge/node-%E2%89%A522-green" alt="node >= 22" />
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="MIT" />
  <img src="https://img.shields.io/badge/providers-57%2B-purple" alt="57+ providers" />
  <img src="https://img.shields.io/badge/free%20tiers-3-success" alt="free tiers" />
</p>

---

## Why TixRouter

Every AI tool wants a different endpoint, a different key, a different bill. TixRouter collapses all of it into **one OpenAI-compatible endpoint on your own hardware** — with your keys, your logs, your rules.

```
Claude Code · Cline · Codex · any OpenAI SDK
                 │
                 │  http://localhost:3000/v1  (one virtual key: tix-live-…)
                 ▼
          ┌───────────────┐
          │  TixRouter   │  failover · pools · cache · token saver
          └───────────────┘
                 │
    ┌────────────┼──────────────┬─────────────────┐
    ▼            ▼              ▼                 ▼
 OpenAI      Anthropic      DeepSeek         free tiers
 Gemini      Groq           Mistral          (dsfree · mfree · zen)
 Ollama      57+ more       …                no API key needed
```

| | OpenRouter / 9Router | TixRouter |
|---|---|---|
| Hosting | Their cloud | **Self-hosted** (localhost / Docker) |
| API keys | They manage | You bring your own / OAuth / **free tiers** |
| Cost | Their margin | **Free software, direct to providers** |
| Privacy | Requests hit their servers | **Everything stays local** (SQLite on your disk) |

## ✨ Highlights

- **One endpoint, 57+ providers** — OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Ollama, and many more behind a single `/v1` API with virtual keys (`tix-live-…`), quotas, and per-key usage tracking.
- **Built-in free tiers, zero keys**
  - `dsfree/*` — DeepSeek (V3, R1, V4-flash, V4-pro) via device login: email+password, vision upload, automatic 401 re-login, **multi-account pool** with 60s cooldown rotation.
  - `mfree/mistral-large` — Mistral Le Chat anonymous access, streaming, web search.
  - `zen/*` — OpenCode Zen free models.
- **Failover cascade** — seed rules route `dsfree → mfree → zen` (and back) on 429/5xx. Toggle it in Settings → Gateway. Custom rules with wildcards and priorities live in the Combo page.
- **Response cache** — identical requests served from memory for 60s. One toggle.
- **Failure webhook** — POST a JSON alert to Discord/Telegram/anything when a model's whole chain dies.
- **Savings tracker** — the dashboard shows how much list-price money your free-tier traffic saved you.
- **Token saver** — compress tool outputs and prompts before they hit the provider (tests: 34 translator cases).
- **Admin dashboard** — logs, costs, latency, fallback paths, provider health, key quotas.
- **Cloudflare tunnel built in** — expose your gateway without port forwarding.

## 🚀 Quick start

### 1. Run it

```bash
git clone https://github.com/rynaqrtz/TixRouter.git
cd TixRouter
pnpm install
pnpm build
pnpm --filter api start
```

Or with Docker:

```bash
docker run -d -p 3000:3000 -v ryna-data:/data ghcr.io/rynaqrtz/tixrouter:latest
```

The gateway is now at `http://localhost:3000/v1`, dashboard at `http://localhost:3000`.

### 2. Connect a tool

Point any OpenAI-compatible tool at your gateway:

| Tool | Base URL | Key |
|---|---|---|
| Claude Code | `http://localhost:3000` | your `tix-live-…` key |
| Codex CLI | `http://localhost:3000/v1` | your `tix-live-…` key |
| Cline / any SDK | `http://localhost:3000/v1` | your `tix-live-…` key |

The dashboard's **CLI Tools** page generates copy-paste configs for each tool.

### 3. Use a free model right now

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dsfree/deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

If the DeepSeek connection is configured, this just works — and if it's rate-limited, the request automatically lands on `mfree/mistral-large`.

## 🔧 Configuration

Manage everything from the dashboard (Providers, Settings, Combo, Keys):

| What | Where |
|---|---|
| Add a provider (API key / OAuth / free tier) | Dashboard → Providers |
| DeepSeek free pool: `email:pass;email2:pass2` in the key field | Dashboard → Providers |
| Toggle failover cascade / cache / webhook | Settings → Gateway → Server Features |
| Custom fallback rules (wildcards, priority) | Dashboard → Combo |
| Virtual keys + quotas | Dashboard → Keys |
| Expose via Cloudflare tunnel | Settings → Tunnel |

Environment variables (see `.env.example`): `PORT`, `TixRouter_DATA_DIR`, and friends.

## 📦 Project structure

```
TixRouter/
├── apps/
│   ├── api/        Hono 4 gateway + admin API (node:sqlite, Zod)
│   └── web/        React 19 dashboard (TanStack Router/Query, Tailwind v4)
└── packages/
    ├── types/        Zod schemas — the wire contract
    ├── constants/    provider catalog, versions
    ├── db/           all SQLite queries (parameterized)
    ├── executors/    one class per provider + free-tier engines
    ├── pricing/      cost estimation from models.dev data
    ├── providers/    executor registry
    └── translator/   payload/stream translation, token saver
```

Architecture law: `routes → controllers → logic → services/packages`. Packages never import apps. Details in [AGENTS.md](AGENTS.md).

## 🧪 Development

```bash
pnpm install
pnpm build                 # turbo, cached
cd apps/api && pnpm test   # node:test via tsx
cd apps/web && pnpm lint   # eslint
```

Per-package verification only — never run the whole monorepo suite at once (see AGENTS.md).

## 🗺️ Roadmap

- [x] Multi-provider gateway with virtual keys
- [x] DeepSeek free engine (login, vision, pool)
- [x] Mistral free engine
- [x] Free-tier failover cascade
- [x] Savings tracker
- [x] Response cache
- [x] Failure webhook
- [ ] Streaming cache / semantic cache
- [ ] More free-tier engines (community PRs welcome)

## 🤝 Contributing

PRs are welcome — read [AGENTS.md](AGENTS.md) first so your code matches the house rules (no comments, minimal diffs, stdlib first). By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

[MIT](LICENSE) — free as in speech, and as in the free tiers.

<p align="center">
  <img src="docs/assets/tixrouter-logo.jpg" alt="TixRouter" width="64" />
</p>
