# Draft comment for dsh discussion #2529

Post this from your own GitHub account (edit the parts in brackets):

---

If anyone wants a gateway behind dsh today, [TixRouter](https://github.com/rynaqrtz/TixRouter)
works with the OpenAI-compatible config from this thread:

```json
{ "name": "TixRouter", "api": "openai-completions", "baseURL": "http://127.0.0.1:3000/v1", "apiKey": "tix-live-…" }
```

It's a self-hosted multi-provider gateway (failover chains, free-tier pools, quota routing) and
I just shipped the wishlist items from this discussion:

- `GET /v1/models` now returns `context_window` + `max_output_tokens` for every model, so dsh's
  `discoverModels` gets capabilities right instead of the 262k/32k defaults
- optional-bearer mode (Settings → accept any bearer) for trusted LAN setups
- `x-tixrouter-*` response headers showing resolved provider/model, cache hit, attempts, and the
  full fallback path — useful for debugging agent runs

Setup: [integrations/dsh](https://github.com/rynaqrtz/TixRouter/tree/main/integrations/dsh).
Happy to maintain a first-class `dsh.bundle.patch` if the `packages/llm` split lands.
