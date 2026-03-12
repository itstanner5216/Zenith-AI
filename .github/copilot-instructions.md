# Zenith-AI — Copilot Agent Instructions

## Repository Overview
This is a TypeScript monorepo (`pnpm` workspaces) for **Zenith-AI**, an AI-powered Obsidian plugin with a companion web platform. The stack includes:
- `packages/plugin` — Obsidian plugin (TypeScript, React, Vite)
- `packages/web` — Next.js web app with Stripe billing, Clerk auth, and Vercel deployment
- `packages/landing` — Next.js landing page
- `packages/mobile` — React Native / Expo mobile app (iOS + Android)
- `packages/release-notes` — Release notes generator

## Package Manager
Always use `pnpm`. Never suggest `npm install` or `yarn` for this repo. The lockfile is `pnpm-lock.yaml`.

## Build Commands
- Install all deps: `pnpm install` (from root)
- Build plugin: `cd packages/plugin && pnpm build`
- Build web: `cd packages/web && pnpm build:ci` (use `build:ci` in CI — skips DB migrations)
- Run tests: `pnpm test` (from root)
- Node memory: always set `NODE_OPTIONS='--max-old-space-size=4096'` for full builds

## Code Style
- TypeScript strict mode is expected across all packages
- React components use functional components with hooks only — no class components
- Use `tsx` for React files, `ts` for pure logic
- ESLint and TypeScript checks run in CI — code must pass both before merge
- Prefer named exports over default exports in utility/service files

## Security Posture
This repo handles sensitive data:
- **Stripe webhooks** in `packages/web/app/api/webhook/handlers/` — always validate webhook signatures, never log raw payloads
- **Clerk authentication** — never bypass auth middleware
- **API keys** — never hardcode, always use environment variables
- CodeQL, Semgrep, and ESLint security rules are all active — do not suppress security warnings without explicit justification

## CI/CD Pipeline
- **Build**: `build.yml` — runs on every push/PR to master
- **Security**: `codeql.yml` (CodeQL Advanced), `semgrep.yml` (Semgrep with configured token), `eslint.yml` (ESLint + TS checks)
- **Dependency safety**: `dependency-review.yml` — blocks PRs with moderate+ severity vulnerabilities
- **Docker**: `docker-publish.yml` — multi-arch (amd64 + arm64) publish to Docker Hub on semver tags
- **Cron**: Daily Vercel redeploy, monthly token reset

## Monorepo Conventions
- Each package has its own `package.json` — changes to one package should not require touching others unless explicitly needed
- Shared types or utilities should live in the appropriate package, not duplicated
- When adding new dependencies, always scope them to the correct package — avoid adding to root unless it's a dev tooling dep used across all packages

## Docker
- Dockerfile is `Dockerfile.optimized`
- Images publish to `jpfong/zenith-ai` on Docker Hub
- Multi-arch: `linux/amd64` and `linux/arm64` via native runners
- Triggered by semver tags (`v*.*.*` or `*.*.*`)

## What to Avoid
- Do not suggest class-based React components
- Do not suggest `npm` or `yarn` — pnpm only
- Do not suggest adding `node_modules` to version control
- Do not suggest disabling TypeScript strict mode
- Do not suppress or ignore ESLint security rules
- Do not add database migration commands to CI build steps — use `build:ci` for web package
