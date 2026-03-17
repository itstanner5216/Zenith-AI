# Product Reset Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement linked plans task-by-task.

**Goal:** Reset Zenith-AI around a development-vault copilot vision by aggressively removing dead product branches, preserving repurposable infrastructure, and then rebuilding around scoped modes.

**Architecture:** The plugin should stop behaving like a commercial multimedia vault assistant and instead become a mode-based vault workspace. Shared infrastructure stays in place for chat/session/history, embeddings, inbox routing, sync transport, and future planning surfaces, while prompts, tools, and UI become mode-scoped.

**Tech Stack:** Obsidian plugin TypeScript, React, Zustand, existing Vertex Brain / embeddings services, existing inbox pipeline.

---

## Product Decisions Locked In

- Keep and harden:
  - `packages/plugin/services/background-scribe.ts`
  - `packages/plugin/services/organization-preferences.ts`
  - `packages/plugin/inbox/index.ts`
  - `packages/plugin/views/assistant/context/index.tsx`
  - `packages/plugin/views/assistant/organizer/chunks.tsx`
  - `packages/plugin/views/assistant/synchronizer/sync-tab.tsx`
  - `packages/plugin/views/assistant/dashboard/*` as dormant infrastructure only
- Hide or deactivate for now:
  - dashboard view registration and command
  - sync tab UI exposure until it is repurposed
- Remove aggressively:
  - monetization / account / top-up / upgrade flows
  - media / audio / image / transcription / YouTube product branch
  - default-model / local-LLM framing
  - stale prompt and tool instructions tied to removed features
- Build next:
  - mode-scoped tooling surface
  - mode runtime
  - Background Scribe as flagship feature
  - Cosmic Context
  - Auto-Sort Tuner
  - later Vault QA / Google AI Search tab

## Recommended Order

1. Execute [2026-03-14-aggressive-removal-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-aggressive-removal-implementation.md)
2. Execute [2026-03-14-mode-tooling-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-mode-tooling-implementation.md)
3. Execute [2026-03-14-mode-runtime-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-mode-runtime-implementation.md)
4. Execute [2026-03-14-background-scribe-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-background-scribe-implementation.md)
5. Execute [2026-03-14-cosmic-context-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-cosmic-context-implementation.md)
6. Execute [2026-03-14-auto-sort-tuner-implementation.md](/home/tanner/Projects/Zenith-AI/docs/plans/2026-03-14-auto-sort-tuner-implementation.md)

## Guardrails

- Do not delete:
  - `packages/plugin/views/assistant/dashboard/*`
  - `packages/plugin/views/assistant/synchronizer/*`
  - `packages/plugin/views/assistant/organizer/chunks.tsx`
  - `packages/plugin/services/background-scribe.ts`
  - `packages/plugin/services/organization-preferences.ts`
  - auto-sort / inbox routing code in `packages/plugin/inbox/index.ts`
- Do not keep any feature just because it is “potentially useful later” if it does not fit the new product identity.
- Prompts and tool allowlists must be rewritten after removals so dead behavior does not keep leaking back in.
- Run the mode-tooling plan before the broader mode runtime so prompt, tool, and handler scope are already reduced when mode switching lands.

## Success State

- The plugin no longer presents itself as a paid multimedia organizer.
- The codebase no longer carries audio/image/video/transcription and monetization product surfaces.
- Dashboard and sync infrastructure remain available for future repurposing but consume near-zero attention and runtime footprint.
- The remaining architecture is ready for scoped modes rather than one giant assistant.
