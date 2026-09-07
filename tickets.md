# TixRouter — Ticket Board

Rencana induk upgrade total. Urutan = prioritas eksekusi. Setiap ticket dikerjakan satu commit/push terpisah agar mudah di-revert. Status: ☐ todo · ◐ jalan · ✅ selesai.

## 🔴 T-001 — Rebrand TixRouter → TixRouter (P0, release v1.2.0)

**Cakupan:**
- [x] Download logo baru → `docs/assets/tixrouter-logo.jpg`
- [ ] Rename repo GitHub `rynaqrtz/TixRouter` → `rynaqrtz/TixRouter`
- [ ] Nama package: root `tixrouter`, scope `@tixrouter/*` → `@tixrouter/*` (8 package + 2 app), semua import ikut
- [ ] Semua brand string: `TixRouter`/`TixRouter`/`TixRouter` → `TixRouter` (UI, header `X-Powered-By`, OAuth, User-Agent, README, SECURITY.md)
- [ ] Env var: `TIXROUTER_*` → `TIXROUTER_*` (`ADMIN_PASSWORD`, `SECURE_COOKIES`, `CORS_ORIGINS`, `SETUP_TOKEN`) — clean break, didokumentasikan
- [ ] Path data: `~/.tixrouter/` → `~/.tixrouter/`, `tixrouter.db` → `tixrouter.db`, **migrasi otomatis saat startup** (rename dir + file db + sidecar WAL)
- [ ] Docker: `DATABASE_PATH=/data/tixrouter.db` + auto-migrate `/data/tixrouter.db` lama
- [ ] localStorage theme key `tixrouter-theme` → `tixrouter-theme`
- [ ] Logo web: timpa `apps/web/public/logo.jpg` + favicon, README banner pakai aset lokal `docs/assets/tixrouter-logo.jpg`
- [ ] Versi bump 1.2.0 (semua package.json + `version.ts`), alias `TIXROUTER_VERSION` dihapus (0 pemanggil)
- [ ] Catatan migrasi di `DB-MIGRATION.md`
- **Acceptance:** build semua package hijau, API suite 167 test hijau, grep case-insensitive `ryna` tinggal sisa `rynaqrtz` (username GitHub) & `.agents/` (skill lokal, untracked).

## 🟠 T-002 — dsh-Readiness (P1, 1–2 hari)

Jadikan TixRouter gateway paling ramah DeepSeek Harness (215k★) — checklist wishlist diskusi dsh #2529:
- Header response `x-tixrouter-*` (upstream provider, attempt, fallback path, cache status)
- Bearer auth opsional (mode lokal tanpa key)
- `GET /v1/models` menyertakan `context_window` + `max_output_tokens` dari katalog constants
- **Acceptance:** `dsh` dengan `baseURL: http://localhost:3000/v1` mendeteksi model + capability benar tanpa konfigurasi manual.

## 🟠 T-003 — Plugin dsh Resmi (P1, 3–5 hari, butuh T-002)

- Bundle `dsh.bundle.patch`: adapter TixRouter + panel kuota/fallback di Web UI dsh
- Publish ke npm + topic `dsh-plugin`, komentar di dsh #2529
- **Dampak:** eksposur langsung ke 215k pengguna dsh — jendela "gateway first-class pertama"

## 🟡 T-004 — Shadow Arena (P1, identitas produk, 1–2 minggu)

Fitur yang tidak ada di gateway mana pun (agentgateway punya shadow traffic tapi tanpa loop belajar):
- Mirror sampling 5% trafik coding-agent ke model kandidat lebih murah
- Validasi hasil deterministik di git worktree (patch apply + test)
- Tabel promosi model: kandidat naik jadi kandidat fallback kalau lolos ambang
- Kuota free-tier surplus dipakai sebagai bahan bakar arena
- **Acceptance:** gateway membuktikan "model X == model Y untuk tugas ini, 4× lebih murah" dari data sendiri.

## 🟡 T-005 — Cascade-with-Verifier (P1, 3–5 hari)

FrugalGPT productionized (riset 2023, belum ada di gateway open-source mana pun):
- Model gratis bikin draft → verifier murah mengecek (self-consistency / judge model) → eskalasi hanya kalau gagal
- Budget cap + kebijakan eskalasi per virtual key
- **Acceptance:** hemat biaya terukur di log (`estimated_cost`) tanpa penurunan kualitas pada suite validator.

## 🟡 T-006 — Outcome-Feedback Routing v1 (P2, 1 minggu)

Versi jujur yang tidak berbohong — sinyal sisi klien saja (bukan sulap):
- Skema log tambah: `retry_within_session`, `abandoned`, `explicit_feedback`
- Scoring per (task-type, model) → menata-ulang urutan `ResolveCandidates`
- Kill-switch di settings; terinspirasi Wilson-bound `free-best-router` tapi level tugas agent (belum ada yang punya)
- **Acceptance:** urutan kandidat berubah dari data nyata, bisa dimatikan tanpa deploy ulang.

## 🟢 T-007 — Afinitas Prefix-Cache Antar Provider (P2, 1 minggu)

llm-d melakukannya di dalam satu cluster k8s; belum ada yang antar provider:
- Telemetri `cached_tokens` per (provider, akun) → routing preference ke tempat prefix sudah ter-cache
- Cached input ~10× lebih murah — langsung kelihatan di savings tracker
- **Acceptance:** rasio cache-hit naik terukur pada trafik agent berulang.

## 🟢 T-008 — Overhaul UI/UX Dashboard (P2, 1–2 minggu)

- Identitas visual baru TixRouter (logo, OKLCH token refresh, tipografi)
- Onboarding wizard: tambah provider pertama → buat virtual key → tes endpoint (3 langkah)
- Halaman Provider Health: latency p95, circuit breaker state, error rate per driver
- Quota planner: visualisasi sisa kuota free-tier per akun + proyeksi habis
- Log viewer: filter model/provider/status + drill-down per request
- Mobile-responsive pass menyeluruh
- **Acceptance:** Lighthouse ≥ 90, alur onboarding < 2 menit sampai request pertama sukses.

## 🟢 T-009 — Docs & Distribusi (P3)

- Landing docs (features, self-host guide, per-tool recipes: Claude Code / Cline / Codex / dsh / opencode)
- Publish image `ghcr.io/rynaqrtz/tixrouter` otomatis via tag (workflow sudah ada)
- README multi-bahasa (EN + ID)
