<div align="center">

# Zenith-AI

**An AI-powered vault organizer and development assistant for Obsidian — with a deep space cockpit UI, vault-native intelligence, and self-hostable infrastructure.**

> 🚧 **Active Development** — Zenith-AI is undergoing a major architectural reset. Core infrastructure is functional; scoped modes and flagship features are being built. Expect breaking changes.

</div>

---

## What is Zenith-AI?

Zenith-AI is an Obsidian plugin (with companion web platform and mobile app) built to be your **vault organizer and development assistant**. Its primary goal is helping you manage project vaults and codebases — organizing files intelligently, surfacing relevant context, and keeping your knowledge structured as projects grow.

Instead of one giant assistant that tries to do everything, Zenith-AI uses **scoped modes** — each with its own prompt, tools, retrieval strategy, and UI surface — so behavior stays focused on the task at hand.

The plugin sits inside Obsidian and gives you an AI-powered sidebar with four core tabs: **Organizer**, **Inbox**, **Chat**, and **Context**. It connects to a self-hosted backend or your own API keys to handle file classification, semantic search, embeddings-driven auto-sorting, and conversational planning — all while keeping your vault data local.

### Current State

**Working today:**
- AI chat with streaming responses and vault-local tool execution
- Inbox pipeline — drop files in, get AI-powered classification, tagging, renaming, and folder routing
- Embeddings-driven auto-sort via Vertex Brain vector search
- Organization preferences engine with customizable rules
- Background Scribe service (conversation → TODO synthesis)
- Vault indexer with rate-limited vector upserts
- Project context detection from file paths
- Deep space cockpit theme with glow system, depth layering, and animations
- Self-hosting via Docker with multi-provider AI support
- Mobile app for file capture and upload (iOS + Android)

**Being built next:**
- Mode runtime — declarative manifests that scope prompt, tools, and retrieval per mode
- Background Scribe as a full planning mode (scratchpad → polished plan → task decomposition)
- Cosmic Context — BM25 + optional semantic fallback for same-turn context injection
- Auto-Sort Tuner — dedicated mode for refining embeddings-driven file routing
- Mode-scoped tool allowlists (replacing the current broad tool surface)

---

## Deep Space Cockpit UI

Zenith-AI's visual identity is a **deep space cockpit** — originally inspired by the [Obsidianite theme](https://github.com/bennycode/obsidianite) by Benny Guo.
### Depth & Dimension

The UI uses a five-layer depth system that gives every surface a sense of physical space. Inputs feel recessed into the panel. Cards float above the background. Hover states lift elements with real elevation shadows. Nothing is flat — everything has a place in the z-axis.

### Neon Glow

Two accent colors — **neon cyan** and **hot pink** — don't just tint elements, they *emit light*. Buttons gain a soft halo on hover and pulse when active. The AI typing indicator breathes with a smooth dimming cycle. Streaming responses cast a faint cyan glow along their border. Spinners and loading states carry drop-shadow glows so they feel alive, not static.

### Micro-Interactions

Every interactive element responds to touch. Cards lift and glow on hover, then compress slightly on click. Buttons surge from a subtle resting glow to a brighter one on engagement. New chat messages fade in with a smooth slide animation. User messages carry a pink accent; assistant messages carry cyan — so the conversation has a visual rhythm.

### Gradient Headings & Dividers

Section headings shimmer with a blue-to-lavender gradient sweep. Dividers use a pink-to-transparent fade instead of hard lines. The result is a UI that feels premium and intentional in every detail.

### Animations

Loading indicators pulse with a breathing cyan glow. Skeleton loaders sweep with a highlight shimmer. Success states flash green. Typing dots scale and fade in sequence. Every animation is smooth, purposeful, and tuned to feel responsive without being distracting.

All animations respect `prefers-reduced-motion` for accessibility — users who disable motion get a fully functional, static UI.

### Code Blocks

Code blocks render through Obsidian's native syntax highlighting engine, so they always match the user's installed theme. Each block has a one-click copy button with a brief confirmation flash.

### Theme Compatibility

The entire design system is built on CSS custom properties and scoped styling — no global overrides, no conflicts with other Obsidian themes or plugins. Everything stays isolated and composable.

### Plugin (`packages/plugin/`)

The core Obsidian plugin. Four main views in the sidebar:

| Tab | Purpose |
|-----|---------|
| **Organizer** | AI-powered file classification, tag suggestions, rename recommendations, folder routing |
| **Inbox** | Processing queue with step-by-step logs (preprocess → extract → classify → tag → format → move) |
| **Chat** | Streaming AI chat with vault-local tool execution via `@mentions` for files, folders, and tags |
| **Context** | Project detection, related file discovery via vector similarity, vault structure analysis |

**Key services:**

| Service | What it does |
|---------|-------------|
| `VertexBrainClient` | HTTP client for vector search, embedding, semantic ranking (connects to Vertex Brain at port 8085) |
| `VaultIndexer` | Rate-limited queue that indexes markdown files into vector storage with tag/folder metadata |
| `OrganizationPreferencesService` | Manages vault organization rules via a configurable rules file with 30s caching |
| `BackgroundScribe` | Listens to chat turns, buffers conversation summaries, synthesizes TODOs using vector search for related context |

**Inbox pipeline** processes files through 6 steps with max 5 concurrent tasks, trace IDs for async tracking, and safe file operations (create, rename, copy, move, modify).

**Chat tools** are defined on the server (schema only) and executed locally on the client using Obsidian's vault API. Your vault data never leaves your machine during tool execution.

### Web Backend (`packages/web/`)

Next.js app running at port 3010 (dev). Handles:

- **AI orchestration** — Chat streaming via Vercel AI SDK with multi-step tool execution
- **File processing** — Classification, formatting, folder suggestions, concept extraction
- **Auth** — Clerk-based user management
- **Upload pipeline** — Presigned R2 URLs for large files, status polling, background processing
- **15+ API routes** under `/api/(newai)/` for chat, classify, format, tags, title, vision, and more

Supports multiple AI providers: **OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, Amazon Bedrock**.

### Mobile App (`packages/mobile/`)

React Native / Expo app for iOS and Android:

- Capture files via camera, photo library, or document picker
- Share Sheet integration for receiving files from other apps
- Size-based upload routing (direct for < 4MB, presigned R2 for larger files)
- Offline file queuing with background sync
- iCloud storage support on iOS

### Zeniths-Vectors

Self-hosted **FastAPI gateway** (port 8085) that bridges Obsidian and Google Vertex AI Search:

- Semantic document retrieval via Vertex AI Search
- Grounded generation with Google Search citations
- Vector embeddings via `text-embedding-004`
- MCP protocol support (all endpoints exposed as MCP tools)
- Backed by **pgvector** (PostgreSQL) and **Redis** for caching
- Configurable model tiers: reasoning (`gemini-2.5-pro`), balanced (`gemini-2.5-flash`), fast (`gemini-2.5-flash-lite`)

---

## Self-Hosting

Zenith-AI can be fully self-hosted with Docker:

```yaml
# docker-compose.yml
services:
  app:
    image: jpfong/zenith-ai:latest
    ports:
      - "3000:3000"
    environment:
      - ENABLE_USER_MANAGEMENT=false
      - MODEL_PROVIDER=openai        # openai | anthropic | google | groq | mistral | deepseek
      - MODEL_NAME=gpt-4o-mini
      - OPENAI_API_KEY=sk-...
```

For the full vector search stack (Vertex Brain + embeddings), see `Zeniths-Vectors/docker-compose.yml` which includes Redis, pgvector, the gateway service, and OpenWebUI.

**Multi-arch images** are published to Docker Hub (`jpfong/zenith-ai`) for `linux/amd64` and `linux/arm64`.

---

## Roadmap

Zenith-AI is being reset from a commercial multimedia assistant into a **focused vault organizer and development assistant**. The roadmap, in order:

1. **Aggressive Removal** — Strip monetization flows, media/transcription product branches, and stale assistant behavior. Preserve infrastructure for inbox, embeddings, sync, and dashboard.
2. **Mode Tooling** — Replace the oversized tool surface with per-mode allowlists. Each mode gets only the tools it needs; broad fuzzy tools are retired.
3. **Mode Runtime** — Declarative mode manifests that control prompt, tools, retrieval policy, and activation surface per session. Modes replace the "one giant assistant" model.
4. **Background Scribe** — Flagship planning mode. Listens to conversations, captures decisions and open questions, maintains a live scratchpad, publishes polished plans and task breakdowns into the vault.
5. **Cosmic Context** — Session-scoped context injection using BM25 search (with optional semantic fallback). Finds relevant vault content and injects it into the current turn without blocking chat.
6. **Auto-Sort Tuner** — Dedicated mode for refining embeddings-driven file routing. Explains sort decisions, lets users lock files in place, and tunes organization preferences — without the model micromanaging every move.

Future: Vault QA / Google AI Search tab, planning workspace surfaces, remote artifact intake via sync infrastructure.

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- For Zeniths-Vectors: Docker, Google Cloud credentials

### Quick Start

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Dev — plugin
cd packages/plugin && pnpm dev

# Dev — web backend
cd packages/web && pnpm dev

# Dev — mobile
cd packages/mobile && pnpm start
```

### Build Commands

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Build all packages (via Turborepo) |
| `cd packages/plugin && pnpm build` | Build the Obsidian plugin |
| `cd packages/web && pnpm build:ci` | Build web app (skips DB migrations — use in CI) |
| `pnpm test` | Run tests across all packages |
| `pnpm format` | Format all files with Prettier |

> Set `NODE_OPTIONS='--max-old-space-size=4096'` for full builds.

### Code Style

- TypeScript strict mode across all packages
- Functional React components with hooks only — no class components
- Named exports preferred over default exports
- ESLint + TypeScript checks enforced in CI
- `pnpm` only — never `npm` or `yarn`

## License

MIT — see [LICENSE](LICENSE) for details.

Copyright 2024–2026 Nexus JPF Inc.
