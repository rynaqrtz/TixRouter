# DB Migration Notes

## v1.3.0 — Shadow Arena

New table `arena_trials` (id, created_at, source_model, candidate_model, judge_model,
prompt_hash, verdict, latency_ms, candidate_cost) plus two indexes. Created automatically by
`initDatabase()` on first start — no data migration needed.

## v1.2.0 — TixRouter rebrand (data path migration)

No schema changes. Storage locations were renamed; migration happens automatically on the first
process start after upgrading, before the database is opened:

| Old (v1.1.0)                     | New (v1.2.0)                   |
| -------------------------------- | ------------------------------ |
| `~/.rynarouter/`                 | `~/.tixrouter/`                |
| `~/.rynarouter/rynarouter.db`    | `~/.tixrouter/tixrouter.db`    |
| `/data/rynarouter.db` (Docker)   | `/data/tixrouter.db` (Docker)  |

Rules:

- `~/.rynarouter` is renamed to `~/.tixrouter` only when `~/.tixrouter` does not exist yet.
- `rynarouter.db` (+ `-wal`/`-shm` sidecars) is renamed to `tixrouter.db` only when the target
  does not exist yet — an existing `tixrouter.db` always wins, nothing is overwritten.
- A `DATABASE_PATH` explicitly pointing at `rynarouter.db` keeps working in place.
- The cwd-based legacy fallbacks (`./rynarouter.db`, `./apps/api/rynarouter.db`) keep working
  unchanged.

Rolling back to v1.1.0 after the automatic rename: rename the directory/file back manually.

## v1.1.0 — api_keys credits

- `api_keys.credit_limit REAL DEFAULT 0`, `usage_cost REAL DEFAULT 0` added via `ensureColumns`.
