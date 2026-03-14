# Zenith-AI

> ⚠️ **Actively in development.** This project is a work in progress. Things will break, change, and be incomplete.

---

## What this is

Zenith-AI is an AI-powered Obsidian plugin and supporting toolset for organizing, transcribing, and chatting with your vault. This monorepo contains:

- **`packages/plugin`** — Obsidian plugin (desktop only, v3.6.11). The core product.
- **`packages/web`** — Next.js web app (auth, billing, AI processing backend). In development.
- **`packages/landing`** — Next.js landing/marketing site. In development.
- **`packages/mobile`** — React Native / Expo mobile app (iOS + Android). In development.
- **`Zeniths-Vectors/`** — Python/FastAPI gateway bridging Google Vertex AI Search and the Obsidian Local REST API. Separate subsystem with its own Docker Compose setup.

---

## Plugin

**`packages/plugin`** — Obsidian plugin, desktop only, v3.6.11.

Registered commands:
- Open Organizer Tab
- Open Inbox Tab
- Open Chat Tab
- Process Inbox Now
- Add Selection to Chat
- Restore Default Templates

Active internal services:
- `VaultIndexer` — indexes vault content for search and organization
- `VertexBrainClient` — optional vector intelligence layer (requires `enableVectorAutoSort` + `vertexBrainUrl` settings)
- `BackgroundScribe` — background transcription processing
- `OrganizationPreferencesService` — manages file organization preferences

Supported file types: images (png, jpg, jpeg, gif, svg, webp), audio (mp3, mp4, mpeg, mpga, m4a, wav, webm), pdf, md, txt.

The plugin creates and ignores a `_ZenithAI` system folder in your vault.

The default backend URL is `https://app.notecompanion.ai` (the current upstream API endpoint). You can override this with a self-hosted server URL in plugin settings.

---

## Zeniths-Vectors

A separate Python/FastAPI subsystem in `Zeniths-Vectors/`. It bridges Google Vertex AI Search with the Obsidian Local REST API, enabling vector-based note search and retrieval. Includes a LiteLLM config, Docker Compose deployment, and pytest suite. See [`Zeniths-Vectors/README.md`](Zeniths-Vectors/README.md) for details.

---

## Monorepo

- Package manager: `pnpm` (v10.8.1)
- Build orchestration: Turborepo (v2.4.4)
- Language: TypeScript 5.8.2 across all packages

```
pnpm install       # install all dependencies
pnpm build         # build all packages via Turborepo
```

---

## License

MIT — see [LICENSE](LICENSE).
