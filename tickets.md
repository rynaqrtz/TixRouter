# TixRouter — Ticket Board

Rencana induk upgrade total. Urutan = prioritas eksekusi. Setiap ticket dikerjakan satu commit/push terpisah agar mudah di-revert. Status: ☐ todo · ◐ jalan · ✅ selesai.

## ✅ T-001 — Rebrand RYNArouter → TixRouter (P0, release v1.2.0) — SELESAI

Repo `rynaqrtz/TixRouter` · scope `@tixrouter/*` · env `TIXROUTER_*` · prefix kunci `tix-live-` · migrasi data otomatis (`~/.tixrouter`, `tixrouter.db`, Docker `/data`) · logo + banner baru · versi 1.2.0 · `DB-MIGRATION.md`.

---

## 🎨 UI/UX — 3 tahap (semua data sudah ada di API, tinggal ditampilkan)

### T-008 — UI/UX Foundation (P2, ~1 minggu)
- [x] Command palette (Ctrl+K): navigasi cepat ke semua halaman
- [x] Log detail: rincian cache/reasoning tokens, status retried, feedback klien
- [ ] Design system refresh: logo TixRouter di sidebar + auth, token OKLCH baru (warna, radius, spacing), tipografi konsisten, dark/light polish
- [ ] Home dashboard: kartu ringkasan real-time — request hari ini, error rate, biaya, penghematan cache + token saver, provider aktif
- [ ] Onboarding wizard 3 langkah: tambah provider pertama → buat virtual key → tes request sukses (target < 2 menit)
- [ ] Command palette (Ctrl+K): navigasi cepat ke semua halaman + aksi (buat key, enable provider, flush cache)
- [ ] Empty & error states yang jelas di semua halaman (bukan halaman kosong bingung)
- [ ] Mobile-responsive pass menyeluruh
- **Acceptance:** Lighthouse ≥ 90 · onboarding < 2 menit sampai request pertama sukses

### T-009 — UI/UX Ops Views (P2, ~1 minggu)
- [x] Halaman Routing Health: outcome stats per model (Wilson score), cache affinity per provider, Shadow Arena verdicts
- [x] Log viewer v2 (parsial): filter model/provider, kolom cache + retried + feedback
- [ ] Halaman Provider Health: latency p50/p95 per driver, status circuit breaker, error rate, sisa kuota per akun
- [ ] Quota planner: visual kuota free-tier per akun, proyeksi tanggal habis, ambang alert
- [ ] Log viewer v2: filter (model/provider/status/latensi/rentang waktu) + drill-down per request — jalur fallback lengkap, rincian token (cache/reasoning), biaya, tombol "replay as curl"
- [ ] Alerts: notifikasi (webhook/ntfy/Telegram) saat provider down, kuota mau habis, atau error rate naik
- **Acceptance:** Insiden 429/down bisa dideteksi dari dashboard tanpa buka log mentah

### T-010 — UI/UX Power Features (P2, ~2 minggu)
- [x] Analytics: biaya/token/hit/error rate harian, top model & client, tabel per model (endpoint `/v1/logs/analytics`)
- [x] Playground: chat streaming dari dashboard + compare 2 model berdampingan
- [ ] Analytics export CSV
- [ ] Playground: chat langsung dari dashboard ke `/v1` sendiri (streaming), pilih model/compare 2 model berdampingan
- [ ] Model catalog browser: telusuri 1200+ model dengan filter (gratis, context window, harga, provider), favorit
- [ ] Fallback chain editor visual: urutkan target, trigger status, uji simulasi rantai tanpa trafik nyata
- [ ] Keys UX upgrade: picker allowed-models, gauge credit_limit vs usage, contoh kode per tool (Claude Code/Cline/Codex/dsh)
- **Acceptance:** semua fitur gateway bisa dipakai penuh dari UI tanpa sentuh SQLite manual

---

## ⚙️ Backend / Infra

### ✅ T-002 — dsh-Readiness (P1) — SELESAI (v1.3.0)
Jadikan TixRouter gateway paling ramah DeepSeek Harness (215k★) — checklist wishlist dsh #2529:
- Header response `x-tixrouter-*` (upstream provider, attempt, fallback path, cache status)
- Bearer auth opsional (mode lokal tanpa key)
- `GET /v1/models` menyertakan `context_window` + `max_output_tokens` dari katalog constants
- **Acceptance:** `dsh` dengan `baseURL: http://localhost:3000/v1` mendeteksi model + capability benar tanpa konfigurasi manual

### ◐ T-003 — Plugin dsh (P1) — scaffold selesai, publish menunggu verifikasi SDK
- Bundle `dsh.bundle.patch`: adapter TixRouter + panel kuota/fallback di Web UI dsh
- Publish ke npm + topic `dsh-plugin`, komentar di dsh #2529
- **Dampak:** eksposur langsung ke 215k pengguna dsh — jendela "gateway first-class pertama"

### ◐ T-004 — Shadow Arena (P1) — core selesai (v1.3.0); worktree validator menyusul via plugin dsh
Fitur yang tidak ada di gateway mana pun (agentgateway punya shadow traffic tapi tanpa loop belajar):
- Mirror sampling 5% trafik coding-agent ke model kandidat lebih murah
- Validasi hasil deterministik di git worktree (patch apply + test)
- Tabel promosi model: kandidat naik jadi fallback kalau lolos ambang
- Kuota free-tier surplus dipakai sebagai bahan bakar arena
- **Acceptance:** gateway membuktikan "model X == model Y untuk tugas ini, 4× lebih murah" dari data sendiri

### ✅ T-005 — Cascade-with-Verifier (P1) — SELESAI (v1.4.0)
FrugalGPT productionized:
- Model gratis bikin draft → verifier murah menilai (yes/no) → eskalasi hanya kalau gagal
- Toggle `cascade_verifier_enabled` di settings (kill-switch) + retry-detect dari log sesi
- **Acceptance:** test suite `routing.test.ts` hijau; hemat biaya terukur di log (`estimated_cost`)

### ✅ T-006 — Outcome-Feedback Routing v1 (P2) — SELESAI (v1.4.0)
Sinyal sisi klien saja (jujur, bukan sulap):
- Kolom log baru: `prompt_hash`, `retried`, `explicit_feedback` (+ index outcome)
- Wilson lower-bound scoring per model → reorder kandidat sebelum resolve
- Endpoint `POST /v1/logs/feedback` + kill-switch `outcome_routing_enabled`
- **Acceptance:** urutan kandidat berubah dari data nyata, bisa dimatikan tanpa deploy ulang

### ✅ T-007 — Afinitas Prefix-Cache Antar Provider (P2) — SELESAI (v1.4.0)
- Telemetri `cached_tokens` per (provider, model) via `affinityHook` di registry (dependency injection, package tetap bersih)
- Kandidat diurutkan ulang ke provider dengan cache-hit terbukti
- Kill-switch `cache_affinity_enabled`
- **Acceptance:** rasio cache-hit naik terukur pada trafik agent berulang

---

## 🚀 Gateway Upgrades v1.5.0 (berbasis riset pasar: state-of-ai-gateways-2026, Braintrust/Portkey/LiteLLM comparison, agentgateway)

### ✅ T-012 — Smart Response Cache (SELESAI, v1.5.0)
- [x] Mode `cache_mode`: exact (default) / fuzzy (normalisasi whitespace+case, prefix fingerprint)
- [x] TTL bisa diatur `cache_ttl_seconds` (default 60s) + toggle UI di settings
- **Diverifikasi:** test `gateway-upgrades.test.ts`

### ✅ T-013 — RPM Rate Limit per Virtual Key (SELESAI, v1.5.0)
- [x] Kolom `rate_limit` kini benar-benar di-enforce (sliding window 60 detik, anchor DB `rate_window_start/count`)
- [x] HTTP 429 `rate_limit_error` + header `Retry-After` saat limit tercapai
- [x] Admin session & loopback bypass tidak terpengaruh (hanya key virtual)
- **Diverifikasi:** test sliding window reset + block

### ✅ T-014 — Alerts v2 (SELESAI, v1.5.0)
- [x] Cooldown per event (bukan global): provider_failure 5m, budget 1 jam
- [x] Channel Telegram Bot + webhook JSON, filter event `notify_events` (empty = semua)
- [x] Kill-switch `budget_alerts_enabled` + UI settings (chat ID, bot token, filter)
- **Diverifikasi:** build + test state latching

### ✅ T-015 — Budget Alert (SELESAI, v1.5.0)
- [x] Notifikasi saat virtual key melewati `credit_limit` / `quota_limit` (sebelumnya cuma blok diam-diam)
- [x] Sink DI di package db (`setBudgetAlertSink`), latch per key di DB (`credit_alerted/quota_alerted`)
- [x] Cooldown 1 jam per key, reset otomatis saat key di-top-up
- **Diverifikasi:** test sink fired-once + latch reset

### ✅ T-016 — Live Event Stream /v1/events/stream (SELESAI, v1.5.0)
- [x] SSE `request.completed` (log lengkap per request) untuk admin, sink multi-subscriber di package db (`SubscribeLogEvents`)
- [x] Sink ter-attach hanya saat ada klien SSE aktif, heartbeat 30 detik, auto-cleanup
- **Diverifikasi:** test subscriber lifecycle

### ✅ T-017 — /v1/models + Harga (SELESAI, v1.5.0)
- [x] Field `pricing` (USD per 1M token: input/output/cached) di setiap model dari katalog pricing
- [x] Model free → 0; model tanpa entri katalog → tanpa field (tidak menyesatkan)
- **Diverifikasi:** test enrichment

### ✅ T-018 — Fix Retry-Detect Streaming (SELESAI, v1.5.0)
- [x] Bug: retry-detect (`retried` marking) hanya jalan di path non-streaming — agen streaming (mayoritas) tidak terhitung di outcome stats
- [x] `FindRecentFailureDB` + `markLogRetriedDB` kini juga di `ProcessStreamingCompletion`
- **Dampak:** skor Wilson outcome routing jadi akurat untuk trafik streaming

---

## 📦 Distribusi

### T-011 — Docs & Distribusi (P3)
- [x] Workflow Docker: trigger manual tersedia (workflow_dispatch)
- [ ] Landing docs (features, self-host guide, per-tool recipes: Claude Code / Cline / Codex / dsh / opencode)
- [ ] Publish image `ghcr.io/rynaqrtz/tixrouter` otomatis via tag (workflow sudah ada)
- [ ] README multi-bahasa (EN + ID)

---

## 💡 Pool ide (belum dijadwalkan — pilih kalau mau)

- i18n dashboard (EN + ID)
- Multi-user / tim + RBAC (admin vs viewer)
- Status page publik untuk instance
- Marketplace template combo/rantai fallback (import/export JSON)
- Virtual key scopes (read-only logs, admin-only keys)
