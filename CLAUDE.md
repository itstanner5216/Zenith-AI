# Zenith-AI — Claude Instructions

> Full architectural guidance and deletion protocol: **[AGENTS.md](./AGENTS.md)**
> Read AGENTS.md before doing any work in this repo. It contains mandatory rules.

## Repository Overview
TypeScript monorepo (`pnpm` workspaces). Two active packages:

| Package | Description |
|---|---|
| `packages/plugin` | Obsidian plugin (TypeScript, React, esbuild) |
| `packages/web` | Self-hosted Next.js API + web app (Postgres/Drizzle, Docker) |

**Only two packages exist: `packages/plugin` and `packages/web`. Do not add, reference, or restore any other package. Do not add any external auth, billing, analytics, cloud storage, or media processing infrastructure.**

## Package Manager
**Always use `pnpm`.** Never `npm` or `yarn`. Lockfile: `pnpm-lock.yaml`.

## Key Commands
```bash
pnpm install                                  # install all deps from root
cd packages/plugin && pnpm build              # build plugin (esbuild)
cd packages/web    && pnpm build:self-host    # build web (skips migrations)
cd packages/plugin && pnpm test              # run plugin tests
npx tsc --noEmit                             # typecheck (run from package dir)
./scripts/verify-deletion.sh "Symbol" ...   # mandatory after ANY deletion
```

## Code Style
- Functional React components with hooks only — no class components
- `tsx` for React files, `ts` for pure logic
- Named exports preferred in utilities/services
- No generation/sampling params (`temperature`, `max_tokens`, etc.) unless explicitly requested
- Use Obsidian CSS variables (`var(--text-normal)`) — never hardcode colors

## Deletion Protocol (mandatory — read AGENTS.md for full detail)
When removing any symbol, file, or feature:
1. Delete the definition AND every import, usage, re-export, string literal, comment, and doc mention
2. Delete from `dist/` too — rebuild with `rm -rf dist && pnpm build`
3. Run `./scripts/verify-deletion.sh "symbol"` — task is NOT done until this exits 0
4. Include the script output in your completion report

## What to Avoid
- Do not suggest `npm` / `yarn`
- Do not reference deleted packages or infrastructure
- Do not comment out code instead of deleting it
- Do not stub deleted symbols — remove the usage too
- Do not declare a deletion complete without running verify-deletion.sh
