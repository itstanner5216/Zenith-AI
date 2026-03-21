<div align="center">

# Zenith-AI

**A mode-based vault workspace Obsidian plugin with a self-hosted companion web app.**

> 🚧 **Active Development** — Major architectural rebuild in progress. Expect breaking changes.

</div>

---

## What is Zenith-AI?

Zenith-AI is an Obsidian plugin built to be a mode-based vault copilot. Instead of one giant assistant, it uses **scoped modes** — each with its own prompt, tools, retrieval strategy, and UI — so behavior stays focused on the task at hand.

It connects to a self-hosted backend (Docker, Postgres, Drizzle) or direct API keys.

---

## Packages

- **`packages/plugin`** — Obsidian plugin (TypeScript, React, esbuild)
- **`packages/web`** — Self-hosted Next.js companion API + web app (Postgres/Drizzle, Docker standalone)
- **`Zeniths-Vectors`** — FastAPI gateway bridging Obsidian and Vertex AI Search (port 8085)

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Quick Start

```bash
pnpm install
cd packages/plugin && pnpm dev
cd packages/web && pnpm dev
```

### Build Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `cd packages/plugin && pnpm build` | Build the Obsidian plugin |
| `cd packages/web && pnpm build:self-host` | Build web app for self-hosting |
| `cd packages/web && pnpm build:ci` | Build web app (skips DB migrations) |
| `pnpm test` | Run tests |

### Deletion Protocol

After removing any symbol, file, or feature — run the verification script:

```bash
./scripts/verify-deletion.sh "SymbolName" "OtherSymbol"
```

Not done until it exits 0.

---

## License

MIT — see [LICENSE](LICENSE) for details.
