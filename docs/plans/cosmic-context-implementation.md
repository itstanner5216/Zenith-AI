# Cosmic Context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tab-gated, session-scoped Cosmic Context that uses BM25 by default, optional semantic fallback, and never blocks or breaks chat.

**Architecture:** A global `CosmicContextEngine` owns the BM25 index and optional embedding fallback. Session-local activation and snippet state live in chat history, while the active UI mirrors the current session state through the Zustand context store. Same-turn injection happens in the chat send path, not from the post-response event.

**Tech Stack:** Obsidian plugin TypeScript, Zustand, existing `VertexBrainClient`, existing chat/session manager.

---

### Task 1: Prove The Same-Turn Hook

**Files:**
- Inspect: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Inspect: installed AI SDK typings or runtime behavior if available
- Test note: local scratch verification only, no committed file required unless needed

**Step 1: Verify whether `experimental_prepareRequestBody` can safely await async work**

Check the current hook usage in:
- `packages/plugin/views/assistant/ai-chat/chat.tsx`

Determine one of two outcomes:
- Outcome A: hook can be async and return a promise of request body
- Outcome B: hook must stay sync

**Step 2: Record the chosen same-turn strategy in code comments or implementation notes**

If Outcome A:
- do retrieval directly in `experimental_prepareRequestBody`

If Outcome B:
- move retrieval to the send path immediately before request submission
- store the computed snippet in a ref/state that `experimental_prepareRequestBody` can read synchronously

**Step 3: Verify no behavior changes yet**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- pass with exit code `0`

---

### Task 2: Add Shared Cosmic Context Types

**Files:**
- Create: `packages/plugin/services/cosmic-context-types.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/services/chat-history-manager.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/use-context-items.ts`

**Step 1: Create shared types**

Add:
- `CosmicSnippet`
- `CosmicContextSessionState`
- `CosmicContextSearchOptions`

Keep these pure types only. No logic.

**Step 2: Extend `ChatSession` with session-scoped Cosmic Context state**

In `chat-history-manager.ts`, add:
- `cosmicContext?: CosmicContextSessionState`

Add helper methods:
- `getCosmicContextState(sessionId)`
- `updateCosmicContextState(sessionId, patch)`
- `resetCosmicContextState(sessionId)`

Default state:
```ts
{
  armed: false,
  messageCounter: 0,
  lastConversationSummary: "",
  lastSnippet: null,
}
```

**Step 3: Extend Zustand store for active snippet mirroring only**

In `use-context-items.ts`, add:
- `cosmicSnippet`
- `setCosmicSnippet`

This is display state only, not the source of truth.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- pass with exit code `0`

---

### Task 3: Build The BM25 Index

**Files:**
- Create: `packages/plugin/services/bm25-index.ts`
- Test: `packages/plugin/services/bm25-index.test.ts` if the repo already has a compatible test pattern nearby

**Step 1: Write a failing test or minimal local verification fixture**

Cover:
- indexing multiple docs
- top-ranked match for obvious keyword query
- remove/update behavior

If there is no nearby test harness pattern, create a minimal focused test file matching the existing plugin test setup.

**Step 2: Implement BM25**

Include:
- tokenizer
- stopword removal
- light stemming
- IDF recomputation
- ranked search

Keep file I/O out of this class.

**Step 3: Verify**

Run the focused test if created, then:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- test passes
- typecheck passes

---

### Task 4: Build The Cosmic Context Engine

**Files:**
- Create: `packages/plugin/services/cosmic-context-engine.ts`
- Modify: `packages/plugin/services/vertex-brain-client.ts` only if a timeout helper or result normalization must be reused

**Step 1: Implement global index lifecycle**

Add:
- `indexAll()`
- `upsertFile(file)`
- `removeFile(filePath)`
- `renameFile(oldPath, file)`

All file reads must be async.

**Step 2: Implement retrieval logic**

`findRelevantSnippet(query, options)` must:
- search BM25 first
- inspect top 3 candidates
- extract best section locally
- return immediately on strong BM25 result
- only attempt embedding fallback if enabled
- wrap embedding fallback in timeout
- catch and log errors, then return `null`

**Step 3: Implement best-section extraction**

Split by heading blocks and choose the best-scoring section locally.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- pass with exit code `0`

Optional local verification:
- manually instantiate engine against a few markdown files and confirm a snippet returns

---

### Task 5: Decouple Vertex Brain Initialization From Vector Auto-Sort

**Files:**
- Modify: `packages/plugin/index.ts`

**Step 1: Initialize `vertexBrainClient` from `vertexBrainUrl` alone**

Rework current logic so:
- `vertexBrainClient` is created when `vertexBrainUrl` exists
- health is checked
- unhealthy client becomes `null`

**Step 2: Keep vector-auto-sort behavior gated separately**

Only initialize:
- `vaultIndexer`
- `backgroundScribe`

when:
- `enableVectorAutoSort` is true
- and `vertexBrainClient` is healthy

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- pass with exit code `0`

Manual expectation:
- `vertexBrainClient` can exist even when vector auto-sort is off

---

### Task 6: Wire Cosmic Context Engine Into Plugin Lifecycle

**Files:**
- Modify: `packages/plugin/index.ts`

**Step 1: Add engine property and initialization**

Add:
- `cosmicContextEngine: CosmicContextEngine | null = null`

Initialize it after `vertexBrainClient` setup.

**Step 2: Extend vault listeners**

Update listeners to keep the BM25 index in sync:
- modify
- delete
- rename

Do not block UI on these listeners.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- pass with exit code `0`

---

### Task 7: Add Cosmic Context Settings

**Files:**
- Modify: `packages/plugin/settings.ts`
- Modify: `packages/plugin/views/settings/experiment-tab.tsx`

**Step 1: Add tuning settings**

Add only:
- snippet length
- update frequency
- BM25 threshold
- semantic fallback toggle
- similarity threshold
- semantic timeout

Do not add a global auto-inject setting.

**Step 2: Add settings UI**

Add the tuning controls in the Integrations section.

Include copy that makes the activation model explicit:
- Cosmic Context is armed per chat from the Cosmic Context tab
- normal chat is unchanged unless armed

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Manual verify:
- settings render
- settings persist

---

### Task 8: Restore Session-Scoped State On Chat Switch

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: On active chat change, restore session Cosmic Context state**

When loading a session:
- mirror `session.cosmicContext.lastSnippet` into `useContextItems.setCosmicSnippet`

When no active chat or a new empty session:
- clear active snippet UI

**Step 2: On message/session save, persist current session Cosmic Context state**

Ensure `chatHistoryManager.updateSession(...)` writes the new session field cleanly.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Manual expectation:
- switching chats restores the right snippet state

---

### Task 9: Implement Same-Turn Injection

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Add session-aware retrieval to the send pipeline**

Using the strategy proven in Task 1:
- read active session cosmic state
- if disarmed, skip
- if armed:
  - increment message counter
  - build conversation summary
  - reuse cached snippet on skipped turns
  - otherwise call engine and save result

**Step 2: Inject snippet into `newUnifiedContext` only when present**

Use a clearly delimited block:

```text
--- Cosmic Context (session-armed) ---
File: ...
Section: ...

...
--- End Cosmic Context ---
```

**Step 3: Guarantee failure safety**

Any error in this path must:
- log warning
- omit snippet
- continue chat request normally

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Manual verify:
- armed session affects same turn
- disarmed session sends unchanged context

---

### Task 10: Rewrite The Cosmic Context Tab

**Files:**
- Modify: `packages/plugin/views/assistant/context/index.tsx`

**Step 1: Replace event-driven retrieval with session-driven UI**

Tab responsibilities:
- show armed/disarmed state for active chat
- arm/disarm the current chat session
- display latest snippet
- allow manual refresh from stored `lastConversationSummary`

**Step 2: Keep the UI compact and non-invasive**

Required states:
- disarmed
- armed/no activity yet
- armed/no result
- armed/result
- loading

**Step 3: Keep file opening behavior**

Clicking the snippet file opens that note in the workspace.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Manual verify:
- tab controls activation
- refresh works
- file links open

---

### Task 11: Final Verification

**Files:**
- No new files

**Step 1: Full plugin typecheck**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- exit code `0`

**Step 2: Manual BM25-only flow**

Expected:
- with no healthy gateway, armed chat still works
- snippet injection is local-only
- no chat failure

**Step 3: Manual semantic fallback flow**

Expected:
- with `vertexBrainUrl` healthy and vector auto-sort off, fallback can still work
- disabling semantic fallback keeps the flow BM25-only

**Step 4: Manual session isolation**

Expected:
- chat A can be armed
- chat B remains disarmed
- switching restores the correct snippet state

---

### Task 12: Commit

**Step 1: Review diff**

Run:
```bash
git diff -- packages/plugin
```

**Step 2: Commit once everything is verified**

Example:
```bash
git add packages/plugin docs/plans/2026-03-14-cosmic-context-implementation.md
git commit -m "feat: add session-scoped cosmic context"
```

