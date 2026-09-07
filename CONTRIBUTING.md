# Contributing to TixRouter

Thank you for your interest in contributing to **TixRouter**! We welcome contributions from the community to help make TixRouter the most reliable, high-performance, multi-provider AI gateway.

---

## 🧭 Code of Conduct

Please treat everyone with respect, kindness, and professionalism. Constructive feedback and inclusive collaboration are core values of this project.

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: `v22+` or `v24+` (Native SQLite `node:sqlite` required)
- **pnpm**: `v10+` (`corepack enable pnpm`)
- **Git**

### Installation

1. **Fork and Clone**:

    ```bash
    git clone https://github.com/<your-username>/TixRouter.git
    cd TixRouter
    ```

2. **Install Dependencies**:

    ```bash
    pnpm install
    ```

3. **Start Development Environment**:
    ```bash
    pnpm dev
    ```
    This launches:
    - **Backend API**: `http://localhost:3000` (Hono Server & SQLite WAL)
    - **Frontend Dashboard**: `http://localhost:5173` (Vite + React 19 + TanStack Router)
    - **OAuth Listener**: `http://localhost:1455` (Automated PKCE Session Exchange)

---

## 🧪 Testing & Code Quality

Before submitting a Pull Request, ensure all tests and builds pass:

```bash
# Run all monorepo unit and integration tests
pnpm test

# Verify type safety and frontend bundle compilation
pnpm build

# Format codebase
pnpm exec prettier --write "**/*.{ts,tsx,json,md,css}"
```

---

## 📂 Project Architecture

```
TixRouter/
├── apps/
│   ├── api/             # Hono REST API server & OAuth controllers
│   └── web/             # Modern Dashboard UI (TanStack Router, React 19)
├── packages/
│   ├── constants/       # Global constants, presets & model catalogs
│   ├── db/              # SQLite repository layer (node:sqlite)
│   ├── executors/       # Upstream protocol drivers (Antigravity, Kiro, Codex, etc.)
│   ├── pricing/         # Model token pricing calculators
│   ├── providers/       # Multi-provider runtime coordinator & registry
│   ├── translator/      # OpenAI <-> Anthropic protocol transformers
│   └── types/           # Shared TypeScript interfaces & Zod schemas
└── turbo.json           # Turborepo build orchestration pipeline
```

---

## 📝 Commit Convention

We use **Conventional Commits** for clear, automated changelogs:

- `feat:` A new feature or capability
- `fix:` A bug fix
- `docs:` Documentation updates
- `refactor:` Code restructuring without behavioral changes
- `test:` Adding or updating automated tests
- `perf:` Performance optimizations
- `chore:` Maintenance, dependencies, or tooling adjustments

_Example:_ `feat(quota): add live quota tracking for upstream accounts`

---

## 🚀 Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Commit your changes following conventional commit syntax.
3. Verify that `pnpm test` and `pnpm build` pass with 0 errors.
4. Push to your fork and open a Pull Request against `main`.
5. Clearly describe the motivation, changes, and testing steps in your PR description.

---

## 📄 License

By contributing to TixRouter, you agree that your contributions will be licensed under the [MIT License](LICENSE).
