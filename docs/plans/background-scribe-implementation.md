# Background Scribe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Background Scribe as the flagship conversation-first planning feature that listens in the background, captures decisions and open questions, and writes structured planning artifacts into the vault.

**Architecture:** Background Scribe is a dedicated mode with its own prompt, narrow tool set, and session-scoped state. It runs alongside foreground chat but does not hijack the main assistant role. It maintains a living scratchpad, then publishes a polished plan or task document on demand.

**Tech Stack:** Obsidian plugin TypeScript, React, Zustand, existing `BackgroundScribe`, chat history/session state, vault write APIs.

---

### Task 1: Audit And Narrow The Existing Background Scribe Service

**Files:**
- Modify: `packages/plugin/services/background-scribe.ts`
- Inspect: `packages/plugin/index.ts`
- Inspect: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Document current responsibilities**

Identify what `BackgroundScribe` does today and remove any responsibilities unrelated to:
- decision capture
- scratchpad upkeep
- plan publishing

**Step 2: Define the narrow runtime contract**

Service should expose a small API like:
- `arm(sessionId)`
- `disarm(sessionId)`
- `recordTurn(sessionId, turn)`
- `publishPlan(sessionId, destination)`
- `getScratchpad(sessionId)`

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- service remains type-safe

---

### Task 2: Add Session-Scoped Background Scribe State

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/services/chat-history-manager.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/use-context-items.ts`
- Create if needed: `packages/plugin/services/background-scribe-types.ts`

**Step 1: Add state fields**

Per session store:
- `armed`
- `scratchpadPath`
- `lastPublishedPlanPath`
- `decisionLog`
- `openQuestions`
- `pendingTasks`

**Step 2: Add helper methods**

Implement session helpers instead of global mutable state.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- state persists and restores cleanly

---

### Task 3: Create The Scribe Mode Prompt And Tool Policy

**Files:**
- Create: `packages/plugin/modes/background-scribe-mode.ts`
- Modify: `packages/web/lib/prompts/chat-prompt.ts` only if shared base instructions must be trimmed
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Write a narrow scribe prompt**

The prompt should instruct the model to:
- listen
- extract decisions
- capture constraints
- maintain structure
- avoid premature execution

It should not instruct the model to broadly organize files, browse the whole vault, or opportunistically edit unrelated notes.

**Step 2: Limit tools hard**

Allowed tools should start minimal:
- create/update scratchpad note
- create/update plan note
- maybe append decision log entry

Do not expose large editing or organizer tool surfaces here.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- scribe mode compiles and resolves its allowlist cleanly

---

### Task 4: Build The Scratchpad Artifact Flow

**Files:**
- Create if needed: `packages/plugin/services/background-scribe-artifacts.ts`
- Modify: `packages/plugin/services/background-scribe.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Define the artifact shapes**

Support:
- live scratchpad note
- polished implementation plan
- optional TODO / task breakdown note

**Step 2: Make writes idempotent**

The scribe should update known files instead of creating duplicates every turn.

**Step 3: Trigger updates in the background**

Foreground chat should not stall waiting on a perfect artifact write every turn.

**Step 4: Verify**

Manual expectation:
- arm scribe
- have a planning conversation
- inspect evolving scratchpad note

Then run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 5: Connect Atomic Notes As Plan Decomposition Infrastructure

**Files:**
- Modify: `packages/plugin/views/assistant/organizer/chunks.tsx`
- Create if needed: `packages/plugin/services/plan-decomposition.ts`

**Step 1: Reframe Atomic Notes**

Keep the infrastructure, but adapt the UX language from “parse document into atomic notes” toward:
- break plan into executable notes
- split implementation plan into task units

**Step 2: Support scribe-generated plans as input**

The decomposition flow should work cleanly on a Background Scribe plan note, not only arbitrary documents.

**Step 3: Verify**

Manual check:
- generate a plan note
- run decomposition
- confirm discrete task notes are created in the intended folder

---

### Task 6: Add Minimal Arm / Publish UX

**Files:**
- Modify: `packages/plugin/views/assistant/view.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Create if needed: `packages/plugin/views/assistant/background-scribe/*`

**Step 1: Add a minimal control surface**

Support:
- arm/disarm
- inspect scratchpad
- publish plan

Keep it light. Do not build a huge new dashboard first.

**Step 2: Persist the mode cleanly**

Switching sessions should restore whether Background Scribe was armed for that session.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- state survives session switches

---

### Task 7: Final Verification

**Files:**
- Whole feature verification

**Step 1: Manual smoke test**

Verify:
- normal chat without scribe
- armed chat with scribe
- scratchpad updates over multiple turns
- publish final plan into vault
- decompose published plan into task notes

**Step 2: Typecheck**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- exit code `0`

**Step 3: Commit**

```bash
git add docs/plans packages/plugin packages/web
git commit -m "feat: add background scribe planning workflow"
```
