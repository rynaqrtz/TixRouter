# TixRouter × DeepSeek Harness (dsh)

Point dsh at your TixRouter gateway and every model you configured there becomes available to
your agent — free tiers, fallback chains, quota routing, all of it.

## 1. Run TixRouter

```bash
docker run -d --name tixrouter -p 127.0.0.1:3000:3000 -v tixrouter-data:/data ghcr.io/rynaqrtz/tixrouter:latest
```

Local, no Docker: `pnpm install && pnpm build && pnpm start` (see the root README).

## 2. Configure dsh

In dsh → Settings → Models → add a provider (or drop the preset below into your dsh config):

```json
{
  "name": "TixRouter",
  "api": "openai-completions",
  "baseURL": "http://127.0.0.1:3000/v1",
  "apiKey": "tix-live-your_virtual_key"
}
```

- Create the virtual key in the TixRouter dashboard → API Keys.
- Running dsh on another machine? Set `baseURL` to `https://your-tunnel/v1` and either keep a
  virtual key or enable **Settings → Security → Accept any bearer** on the gateway.
- `GET /v1/models` returns `context_window` and `max_output_tokens` for every model, so dsh
  discovery gets capabilities right without manual edits.

## 3. Verify

```bash
curl -s http://127.0.0.1:3000/v1/models -H "Authorization: Bearer tix-live-…" | head
curl -s http://127.0.0.1:3000/v1/chat/completions -H "Authorization: Bearer tix-live-…" \
  -H "content-type: application/json" \
  -d '{"model":"provider/model","messages":[{"role":"user","content":"hi"}]}'
```

Routing metadata for non-streaming calls comes back as headers:
`x-tixrouter-model`, `x-tixrouter-provider`, `x-tixrouter-cache`, `x-tixrouter-attempts`,
`x-tixrouter-fallback-path`. Streaming calls expose the candidate order up front via
`x-tixrouter-candidates` (the resolved winner is on each chunk's `model` field).

## Shadow Arena (optional)

Mirror a sample of your agent traffic to a cheaper candidate model and let a judge model grade
it against the primary answer. Off by default; enable via `PATCH /v1/settings`:

```bash
curl -X PATCH http://127.0.0.1:3000/v1/settings \
  -H "content-type: application/json" \
  -d '{"settings":{"arena_enabled":"true","arena_sample_pct":"5","arena_candidate_model":"free/model","arena_judge_model":"cheap/model"}}'
```

Win rates per candidate: `GET /v1/settings/arena`. Trials never touch your primary response.
