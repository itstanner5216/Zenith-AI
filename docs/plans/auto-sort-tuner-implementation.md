# Auto-Sort Tuner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing embeddings-driven file sorting infrastructure into a narrowly scoped tuning mode where embeddings do the routing and the model only helps align that routing with the user’s organizational preferences.

**Architecture:** Auto-sorting remains primarily embeddings-driven through the inbox pipeline. The model is only used in the tuner mode to adjust preferences, explain routing, and lock files in place when asked. This keeps sorting reliable and prevents the chat assistant from micromanaging every move.

**Tech Stack:** Obsidian plugin TypeScript, existing inbox pipeline, existing `OrganizationPreferencesService`, existing Vertex Brain / embeddings path.

---

### Task 1: Audit The Existing Auto-Sort Pipeline

**Files:**
- Inspect: `packages/plugin/inbox/index.ts`
- Inspect: `packages/plugin/services/organization-preferences.ts`
- Inspect: `packages/plugin/settings.ts`

**Step 1: Map the current embeddings-first path**

Document and preserve the current behavior around:
- `recommendFolderWithEmbeddingsStep`
- threshold settings
- `projectsPath`
- `pinnedTag`
- fallback to model-assisted folder selection

**Step 2: Mark what becomes tuner-only**

The model should only remain responsible for:
- preference tuning
- rules updates
- lock/pin actions
- explanations

It should not remain the primary router.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 2: Create Auto-Sort Tuner Mode Manifest

**Files:**
- Create: `packages/plugin/modes/auto-sort-tuner-mode.ts`
- Modify: `packages/plugin/modes/mode-registry.ts`

**Step 1: Add a narrow prompt**

Prompt should instruct the model to:
- understand the current org scheme
- update preferences and rules
- respect pinned/locked files
- avoid broad chat behavior

**Step 2: Keep tool surface minimal**

Allow only:
- read current org preferences
- update org preferences
- lock/unlock a file
- inspect why a route was chosen

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 3: Split Sorting From Tuning In The Inbox Pipeline

**Files:**
- Modify: `packages/plugin/inbox/index.ts`
- Modify: `packages/plugin/services/organization-preferences.ts`

**Step 1: Strengthen embeddings-first sorting**

Ensure high-confidence routing can proceed without model intervention.

**Step 2: Restrict model invocation points**

Only call model logic when:
- tuning preferences
- explicit explanation requested
- embeddings confidence falls below a deliberate fallback threshold

**Step 3: Keep lock behavior explicit**

Preserve and harden pinned/locked file skips.

**Step 4: Verify**

Manual expectation:
- high-confidence inbox items route without model help
- pinned files do not move

Then run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 4: Add Tuner UX

**Files:**
- Modify: `packages/plugin/views/assistant/view.tsx`
- Create if needed: `packages/plugin/views/assistant/auto-sort-tuner/*`
- Modify if needed: `packages/plugin/views/settings/customization-tab.tsx`

**Step 1: Expose the tuner as a scoped activation surface**

This can be:
- a dedicated mode in chat
- a slash command
- or a small dedicated tab

Choose one and keep it explicit. Do not make it ambient.

**Step 2: Let users lock files and refine org preferences**

Support:
- lock current file in place
- inspect current org preferences
- save preference refinements

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 5: Add Routing Diagnostics

**Files:**
- Create if needed: `packages/plugin/services/auto-sort-diagnostics.ts`
- Modify: `packages/plugin/inbox/index.ts`
- Modify: `packages/plugin/views/assistant/inbox-logs.tsx`

**Step 1: Capture why a route happened**

Record:
- confidence
- matched neighbors
- chosen folder
- whether model fallback was used
- whether a lock prevented movement

**Step 2: Surface those diagnostics cleanly**

Do not dump raw embedding data. Show human-readable routing reasons.

**Step 3: Verify**

Manual check:
- process an inbox item
- inspect the routing reason in logs or diagnostics UI

---

### Task 6: Final Verification

**Files:**
- Whole auto-sort surface

**Step 1: Manual smoke test**

Verify:
- embeddings-only routing
- low-confidence fallback behavior
- preference update flow
- file lock behavior

**Step 2: Typecheck**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- exit code `0`

**Step 3: Commit**

```bash
git add docs/plans packages/plugin
git commit -m "feat: add scoped auto-sort tuner mode"
```
