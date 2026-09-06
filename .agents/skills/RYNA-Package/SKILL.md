---
name: rynarouter-packages
description: |
    Comprehensive development skill for the shared core packages in RYNArouter (`packages/*` including `@rynarouter/types`, `@rynarouter/db`, `@rynarouter/executors`, `@rynarouter/translator`, `@rynarouter/constants`, `@rynarouter/providers`, `@rynarouter/pricing`). Use whenever modifying, creating, debugging, or reviewing: shared Zod schemas & snake_case data contracts (@rynarouter/types), SQLite database queries & table schemas (@rynarouter/db), upstream provider executor drivers & SSE stream framing (@rynarouter/executors), pure OpenAI/Anthropic dialect translation (@rynarouter/translator), centralized versioning & provider catalogs (@rynarouter/constants), circuit breakers & OAuth flows (@rynarouter/providers), or token pricing & cost estimators (@rynarouter/pricing).
---

# 📦 RYNArouter — Shared Packages Skill

Development guide and architectural boundaries for shared packages (`packages/*`).

## When To Read References

| Reference | Package | Use When |
| --- | --- | --- |
| `references/types.md` | `@rynarouter/types` | Modifying Zod schemas, data contracts, snake_case validation |
| `references/db.md` | `@rynarouter/db` | Adding/updating SQLite queries, tables, mappers, migrations |
| `references/executors.md` | `@rynarouter/executors` | Building provider drivers, SSE framing, upstream requests |
| `references/translator.md` | `@rynarouter/translator` | Pure OpenAI ↔ Anthropic dialect mapping, schema cleanup |
| `references/constants.md` | `@rynarouter/constants` | Version constants, model lists, provider catalog metadata |
| `references/providers.md` | `@rynarouter/providers` | Circuit breaker logic, OAuth providers, provider registry |
| `references/pricing.md` | `@rynarouter/pricing` | Token pricing, cost calculators, usage estimation |

Read the relevant reference document before modifying that package.

## Core Stack

- TypeScript ESM
- Zod 3 (Contract & schema definitions)
- Native `node:sqlite` (WAL mode, parameterized queries)
- Node.js ≥ 22
- `tsup` (ESM module builds)
- Native `node:test` via `tsx`

## Architecture & Dependency Law

```text
apps/* (api, web, cli)
  ↓ imports
packages/* (types, db, executors, translator, constants, providers, pricing)
```

1. **One-Way Dependency**: Packages are standalone reusable libraries. `apps/*` may import packages, but **packages NEVER import from `apps/*`**.
2. **Pure Translation Law**: `@rynarouter/translator` must remain 100% pure functions (no `fetch`, no filesystem IO, no clocks, no timers, no env variables).
3. **Database Parameterization Law**: Every query in `@rynarouter/db` must be strictly parameterized (`?` placeholders). No string interpolation.
4. **Schema Single Source of Truth**: Data contracts live exclusively in `@rynarouter/types`. TypeScript types must be derived using `z.infer<typeof Schema>`.
5. **No Hardcoded Versions/Catalogs**: Versions (`GLOBAL_VERSION`, `APP_VERSION`, etc.) and provider metadata live exclusively in `@rynarouter/constants`.

## Package Map

```text
packages/
├── constants/    # Single source for versions, provider definitions, model catalogs
├── db/           # SQLite queries, connection pooling, table mappers, migration notes
├── executors/    # Upstream HTTP drivers, BaseExecutor, SSE stream frame parsers
├── pricing/      # Model pricing matrix, token cost calculation, cost estimators
├── providers/    # Circuit breakers, OAuth credential providers, provider registry
├── translator/   # Pure payload/stream transformers (OpenAI ↔ Anthropic)
└── types/        # Canonical snake_case Zod schemas and derived TypeScript types
```

## Verification Gate

Always build and test only the touched package from within its directory:

```bash
cd packages/<package-name> && pnpm run build
cd packages/<package-name> && pnpm test
```
