# Mode Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the “one giant assistant” model with a scoped mode runtime where each mode controls its own prompt, tools, retrieval policy, and activation surface.

**Architecture:** Shared chat/session/runtime infrastructure stays centralized. Modes are declarative manifests that provide prompt builders, allowed tools, context strategy, and output contract. Optional modifiers, like web search, layer on top without redefining the mode.

**Tech Stack:** Obsidian plugin TypeScript, React, Zustand, existing chat/session infrastructure, existing web tool registry and prompt pipeline.

---

### Task 1: Define Shared Mode Contracts

**Files:**
- Create: `packages/plugin/modes/mode-types.ts`
- Create: `packages/plugin/modes/modifier-types.ts`
- Inspect: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Create mode interfaces**

Define:
- `AssistantModeId`
- `AssistantModeManifest`
- `AssistantModifierId`
- `ModePromptContext`
- `ModeToolPolicy`
- `ModeRetrievalPolicy`

Core manifest fields should include:
- `id`
- `displayName`
- `buildSystemPrompt()`
- `allowedTools`
- `retrievalPolicy`
- `activationSurface`
- `supportsBackgroundRun`

**Step 2: Keep these files declarative**

No concrete mode behavior yet. Only shared types and helper signatures.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- typecheck passes

---

### Task 2: Add A Mode Registry

**Files:**
- Create: `packages/plugin/modes/mode-registry.ts`
- Create: `packages/plugin/modes/modifier-registry.ts`
- Create: `packages/plugin/modes/index.ts`

**Step 1: Implement a static registry**

Register placeholder or early manifests for:
- `project-copilot`
- `background-scribe`
- `cosmic-context`
- `auto-sort-tuner`

Add modifiers:
- `web-search`

**Step 2: Ensure registry is pure configuration**

No UI logic in the registry.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- registry imports cleanly

---

### Task 3: Add Session-Scoped Mode State

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/services/chat-history-manager.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/use-context-items.ts`

**Step 1: Extend session state**

Each chat session should store:
- active mode
- enabled modifiers
- mode-local metadata bucket

Do not store one giant shared assistant persona blob.

**Step 2: Add helpers**

Implement helpers like:
- `getActiveMode(sessionId)`
- `setActiveMode(sessionId, modeId)`
- `toggleModifier(sessionId, modifierId)`
- `updateModeState(sessionId, patch)`

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- state changes serialize and hydrate with chat history

---

### Task 4: Route Prompt Building Through The Active Mode

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Modify: `packages/web/lib/prompts/chat-prompt.ts`
- Create if needed: `packages/plugin/modes/build-mode-prompt.ts`

**Step 1: Split prompt assembly**

Prompt composition order should become:
1. base runtime instructions
2. active mode prompt
3. enabled modifier prompt fragments
4. turn-specific injected context

**Step 2: Remove giant prompt assumptions**

The prompt builder should stop assuming one assistant is responsible for all tasks.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- chat still builds a valid request body

---

### Task 5: Add Mode-Scoped Tool Allowlists

**Files:**
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`
- Create if needed: `packages/plugin/modes/resolve-allowed-tools.ts`

**Step 1: Resolve tools from active mode + modifiers**

Instead of exposing the whole tool universe every turn, derive a turn allowlist from:
- active mode
- active modifiers

**Step 2: Fail closed**

If a tool is not allowed in the current mode, it should not appear in the request and should not be invocable client-side.

**Step 3: Verify**

Run a focused residue check:
```bash
rg -n "toolInvocations|processedToolCallIds|tools:" packages/plugin packages/web
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- typecheck passes
- tool selection is clearly mode-based

---

### Task 6: Add Minimal Mode Switching UI

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/model-selector.tsx`
- Modify: `packages/plugin/views/assistant/view.tsx`
- Create if needed: `packages/plugin/views/assistant/ai-chat/mode-selector.tsx`
- Create if needed: `packages/plugin/views/assistant/ai-chat/modifier-toggle.tsx`

**Step 1: Replace the old model-centric selector**

The visible control should choose mode first, not “default model.”

**Step 2: Keep modifier UI minimal**

Start with:
- web search toggle

Avoid exposing five toggles at once.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- UI builds and mode choice persists per session

---

### Task 7: Final Verification

**Files:**
- Whole runtime verification

**Step 1: Verify basic flows**

Manual checks:
- open chat
- switch modes
- toggle web search modifier
- send a message
- restore a previous chat session

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
git commit -m "feat: add scoped assistant mode runtime"
```
