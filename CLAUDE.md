# Zenith-AI — Claude Instructions

> For full architectural guidance, patterns, and development workflows see **[AGENTS.MD](./AGENTS.MD)**.

## Repository Overview
TypeScript monorepo (`pnpm` workspaces) for **Zenith-AI**, an AI-powered Obsidian plugin with a companion web platform.

| Package | Description |
|---|---|
| `packages/plugin` | Obsidian plugin (TypeScript, React, Vite) |
| `packages/web` | Next.js web app — Stripe billing, Clerk auth, Vercel |
| `packages/landing` | Next.js marketing / landing page |
| `packages/mobile` | React Native / Expo mobile app (iOS + Android) |
| `packages/release-notes` | Release notes generator |

## Package Manager
**Always use `pnpm`.** Never suggest `npm install` or `yarn`. Lockfile: `pnpm-lock.yaml`.

## Key Commands
```bash
pnpm install                          # install all deps from root
cd packages/plugin && pnpm build      # build plugin (esbuild)
cd packages/web    && pnpm build:ci   # build web — skips DB migrations
pnpm test                             # run all tests from root
```
Set `NODE_OPTIONS='--max-old-space-size=4096'` for full builds.

## Code Style
- TypeScript strict mode across all packages
- Functional React components with hooks only — no class components
- `tsx` for React files, `ts` for pure logic
- Named exports preferred over default exports in utilities/services
- ESLint + TypeScript checks run in CI — code must pass before merge

## Security
- Stripe webhooks: always validate signatures, never log raw payloads
- Clerk auth: never bypass middleware
- API keys: always use environment variables, never hardcode
- CodeQL, Semgrep, and ESLint security rules are active — do not suppress without justification

## Plugin UI
- Wrap all new plugin components in `StyledContainer`
- Use the `tw()` helper for `className` merging
- Use Obsidian CSS variables (e.g. `var(--text-normal)`) — never hardcode colors
- Chat UI lives in `packages/plugin/views/assistant/ai-chat/`

## API Backward Compatibility
Old plugin versions cannot be force-updated. When changing `packages/web/app/api/` endpoints:
- Accept both old and new parameter formats
- Provide sensible defaults for missing fields
- Wait 3+ months before removing deprecated fields

## What to Avoid
- Do not suggest `npm` / `yarn`
- Do not add `node_modules` to version control
- Do not disable TypeScript strict mode
- Do not suppress ESLint security rules
- Do not add DB migration commands to CI build steps (use `build:ci`)
