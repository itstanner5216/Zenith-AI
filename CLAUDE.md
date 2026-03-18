# Zenith-AI — Claude Development Guide

## Repository Overview

TypeScript monorepo (`pnpm` workspaces) for **Zenith-AI**, an AI-powered Obsidian plugin with a companion web platform.

| Package | Description |
|---------|-------------|
| `packages/plugin` | Obsidian plugin (TypeScript, React, esbuild) |
| `packages/web` | Next.js web app (Stripe, Clerk, Vercel) |
| `packages/landing` | Next.js landing page |
| `packages/mobile` | React Native / Expo mobile app (iOS + Android) |
| `packages/release-notes` | Release notes generator |

## Package Manager

Always use `pnpm`. Never use `npm install` or `yarn`. Lockfile is `pnpm-lock.yaml`.

## Build & Test

```bash
pnpm install                          # install all deps
cd packages/plugin && pnpm build      # build Obsidian plugin
cd packages/web && pnpm build:ci      # build web (CI — skips DB migrations)
pnpm test                             # run all tests
```

Set `NODE_OPTIONS='--max-old-space-size=4096'` for full builds.

Plugin tests: `cd packages/plugin && pnpm test` (7 suites, 73 tests).

## Code Style

- TypeScript strict mode across all packages
- Functional React components with hooks only — no class components
- `tsx` for React files, `ts` for pure logic
- Named exports preferred over default exports in utility/service files
- ESLint and TypeScript checks enforced in CI

## Key Architecture

### Plugin UI (CRITICAL)

Plugin runs inside Obsidian — use the **Obsidianite dark neon design system**, not generic web UI:

- Wrap component roots in `StyledContainer`
- Use `tw()` for className merging
- Use Obsidian CSS variables (`var(--text-normal)`, `var(--background-primary)`) — no hardcoded colors
- Depth layers: `#0a0910` → `#100e17` → `#191621` → `#1e1a2e` → `#252136`
- Accents: cyan `#0fb6d6`, pink `#f4569d`

```tsx
import { StyledContainer } from "../../components/ui/utils";
import { tw } from "../../lib/utils";

export function MyComponent() {
  return (
    <StyledContainer>
      <div className={tw("bg-[--background-primary] text-[--text-normal] p-2")}>
        {/* content */}
      </div>
    </StyledContainer>
  );
}
```

### Settings

- Settings class: `packages/plugin/settings.ts`
- Settings UI tabs: `packages/plugin/views/settings/`
- Snapshot test: `packages/plugin/settings.test.ts` — run with `--updateSnapshot` when settings change
- Shared UI primitives: `packages/plugin/views/settings/components.tsx`

### Chatbot Tools (Local Execution Pattern)

Tools are **defined on the server** (schema only, no `execute`) and **executed on the client** (Obsidian API access):

1. Define tool schema in `packages/web/app/api/(newai)/chat/tools.ts`
2. Map handler in `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`
3. Create handler component in `packages/plugin/views/assistant/ai-chat/tool-handlers/`
4. Use `hasFetchedRef` to prevent double execution; call `handleAddResult(JSON.stringify(result))`

### File Upload Flow

- Small files (< 4 MB): direct multipart upload to `/api/transcribe`
- Large files (≥ 4 MB): presigned R2 URL → upload to R2 → notify backend
- Key routes: `create-upload-url`, `record-upload`, `process-file`, `get-upload-status/[id]`

## Security

- **Stripe webhooks** (`packages/web/app/api/webhook/handlers/`) — always validate signatures
- **Clerk auth** — never bypass middleware
- **API keys** — environment variables only, never hardcode
- CodeQL, Semgrep, ESLint security rules are active — do not suppress without justification

## API Backward Compatibility

Accept both old and new parameter formats in API endpoints — we cannot control when users update the plugin. Provide sensible defaults for missing fields.

## Docker

- Dockerfile: `Dockerfile.optimized`
- Image: `jpfong/zenith-ai` on Docker Hub
- Multi-arch: `linux/amd64` + `linux/arm64`
- Triggered by semver tags (`v*.*.*`)

## What to Avoid

- Class-based React components
- `npm` or `yarn` — pnpm only
- Hardcoded colors in plugin UI
- Disabling TypeScript strict mode
- Suppressing ESLint security rules
- DB migration commands in CI build steps (use `build:ci`)

## Further Reading

- Full architecture and patterns: [AGENTS.MD](AGENTS.MD)
- Copilot-specific instructions: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- Obsidianite UI spec: [.github/instructions/obsidianite-ui.instructions.md](.github/instructions/obsidianite-ui.instructions.md)
