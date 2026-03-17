# Mode Tooling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current oversized assistant tool surface with a tiny, mode-scoped tool system that only exposes the minimum reliable tools each feature actually needs.

**Architecture:** Modes should present a narrow allowlist to the model, while retrieval and other orchestration-heavy behavior move into runtime services instead of model tools. Existing file primitives are reused where they are already solid, broad fuzzy tools are retired, and a few new mode-specific wrappers are added for Background Scribe and Auto-Sort Tuner. `deleteFiles` is explicitly retained, but always user-confirmed and defaulted to trash.

**Tech Stack:** Obsidian plugin TypeScript, React tool confirmation UIs, existing chat tool registry in `packages/web/app/api/(newai)/chat/tools.ts`, existing client dispatcher in `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`.

---

## Hard-Scoped Tool Matrix

### Background Scribe

**Present to model:**
- `upsertScratchpadNote` (NEW)
- `publishPlanNote` (NEW)
- `decomposePlanNote` (NEW)
- `deleteFiles` (REUSED, guarded) only for cleanup of model-created scratch artifacts

**Runtime-only, not tools:**
- conversation capture
- turn summarization
- plan state tracking

### Cosmic Context

**Present to model:**
- none

**Runtime-only, not tools:**
- BM25 lookup
- optional semantic fallback
- same-turn snippet injection

### Auto-Sort Tuner

**Present to model:**
- `getOrganizationPreferences` (NEW)
- `updateOrganizationPreferences` (NEW, or narrow wrapper over existing rules infra)
- `lockFileInPlace` (NEW)
- `unlockFile` (NEW)
- `explainSortDecision` (NEW)
- `deleteFiles` (REUSED, guarded) for cleanup only when explicitly asked

**Runtime-only, not tools:**
- embeddings-based routing
- automatic folder movement
- threshold evaluation

### Vault QA / Google AI Search

**Present to model:**
- `openFile` (REUSED)
- `saveAnswerToNote` (NEW, optional)

**Runtime-only, not tools:**
- Google AI vector search
- answer retrieval over vault contents

### General Project Copilot

**Present to model:**
- `searchByName` (REUSED)
- `openFile` (REUSED)
- `getFileMetadata` (REUSED)
- `getBacklinks` (REUSED)
- `getOutgoingLinks` (REUSED)
- `getHeadings` (REUSED)
- `createNewFiles` (REUSED, hardened)
- `renameFiles` (REUSED, hardened)
- `editDocument` (NEW unified editing tool)
- `updateFrontmatter` (REUSED, hardened)
- `deleteFiles` (REUSED, guarded)

**Runtime-only, not tools:**
- session state hydration
- current-file / context assembly

### Web Search Modifier

**Present to model:**
- no Obsidian tools directly

**Runtime-only, not tools:**
- web-search enablement
- prompt fragment append

## Explicit Retire / Hide List

These should stop being presented to the model in the new system:

- `getSearchQuery`
- `generateSettings`
- `analyzeVaultStructure`
- `moveFiles` as a general chat tool
- `executeActionsOnFileBasedOnPrompt`
- `addTextToDocument`
- `appendContentToFile`
- `modifyDocumentText`
- `getLastModifiedFiles`
- `getTaggedFiles`
- `addTags`
- `extractHighlights`
- `mergeFiles`
- `createTemplate`
- `bulkFindReplace`
- `exportToFormat`
- `findBrokenLinks`

Some of these may remain in the codebase temporarily as internal helpers or dormant handlers, but they should no longer be part of the model-facing mode allowlists.

---

### Task 1: Add Tool Capability Types And Mode Allowlist Registry

**Files:**
- Create: `packages/plugin/modes/tool-capabilities.ts`
- Create: `packages/plugin/modes/tool-allowlists.ts`
- Modify: `packages/plugin/modes/mode-types.ts`
- Modify: `packages/plugin/modes/mode-registry.ts`
- Inspect: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Create shared tool capability types**

Add a typed tool id union and capability metadata:

```ts
export type ToolId =
  | "searchByName"
  | "openFile"
  | "getFileMetadata"
  | "getBacklinks"
  | "getOutgoingLinks"
  | "getHeadings"
  | "createNewFiles"
  | "renameFiles"
  | "updateFrontmatter"
  | "deleteFiles"
  | "editDocument"
  | "upsertScratchpadNote"
  | "publishPlanNote"
  | "decomposePlanNote"
  | "getOrganizationPreferences"
  | "updateOrganizationPreferences"
  | "lockFileInPlace"
  | "unlockFile"
  | "explainSortDecision"
  | "saveAnswerToNote";

export interface ToolCapability {
  id: ToolId;
  destructive: boolean;
  requiresConfirmation: boolean;
  modeScoped: boolean;
}
```

**Step 2: Create per-mode allowlists**

Define explicit arrays for:
- `projectCopilotTools`
- `backgroundScribeTools`
- `cosmicContextTools`
- `autoSortTunerTools`
- `vaultQaTools`

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- typecheck passes
- mode registry can reference tool ids without stringly-typed drift

---

### Task 2: Prune The Server Tool Registry To The New Core Surface

**Files:**
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Remove retired tools from the exported registry**

Delete or stop exporting:
- `getSearchQuery`
- `generateSettings`
- `analyzeVaultStructure`
- `moveFiles`
- `executeActionsOnFileBasedOnPrompt`
- `addTextToDocument`
- `appendContentToFile`
- `modifyDocumentText`
- `getLastModifiedFiles`
- `getTaggedFiles`
- `addTags`
- `extractHighlights`
- `mergeFiles`
- `createTemplate`
- `bulkFindReplace`
- `exportToFormat`
- `findBrokenLinks`

**Step 2: Keep only the reusable primitives**

Retain:
- `searchByName`
- `openFile`
- `getFileMetadata`
- `getBacklinks`
- `getOutgoingLinks`
- `getHeadings`
- `createNewFiles`
- `renameFiles`
- `updateFrontmatter`
- `deleteFiles`

Add placeholders or real schema definitions for:
- `editDocument`
- `upsertScratchpadNote`
- `publishPlanNote`
- `decomposePlanNote`
- `getOrganizationPreferences`
- `updateOrganizationPreferences`
- `lockFileInPlace`
- `unlockFile`
- `explainSortDecision`
- `saveAnswerToNote`

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "getSearchQuery|generateSettings|executeActionsOnFileBasedOnPrompt|appendContentToFile|modifyDocumentText" packages/web/app/api/'(newai)'/chat/tools.ts
```

Expected:
- removed tools no longer exist in exported registry

---

### Task 3: Align The Client Dispatcher With The New Registry

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/types.ts`

**Step 1: Remove dead handlers from the dispatcher map**

Stop dispatching retired model-facing handlers:
- `SearchHandler`
- `DateRangeHandler`
- `LastModifiedHandler`
- `SettingsUpdateHandler`
- `OnboardHandler`
- `MoveFilesHandler`
- `SearchRenameHandler`
- `ExecuteActionsHandler`
- `AddTextHandler`
- `ModifyTextHandler`
- `TagsHandler`
- `TaggedFilesHandler`
- `ExtractHighlightsHandler`
- `MergeFilesHandler`
- `CreateTemplateHandler`
- `BulkFindReplaceHandler`
- `ExportToFormatHandler`
- `BrokenLinksHandler`
- `UpdateVaultStructureHandler` as a generic tool entry

**Step 2: Add new mode-safe handlers**

Register:
- `EditDocumentHandler`
- `UpsertScratchpadNoteHandler`
- `PublishPlanNoteHandler`
- `DecomposePlanNoteHandler`
- `GetOrganizationPreferencesHandler`
- `UpdateOrganizationPreferencesHandler`
- `LockFileInPlaceHandler`
- `UnlockFileHandler`
- `ExplainSortDecisionHandler`
- `SaveAnswerToNoteHandler`

**Step 3: Replace the global processed set with session-safe tracking**

Move away from module-global `processedToolCallIds` and make duplicate suppression scoped to the chat/session lifecycle.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "processedToolCallIds|ExecuteActionsHandler|SettingsUpdateHandler|OnboardHandler" packages/plugin/views/assistant/ai-chat/tool-handlers
```

Expected:
- dead generic handlers are no longer dispatched
- duplicate suppression is no longer global across the whole module lifetime

---

### Task 4: Replace Fragmented Editing With One Unified `editDocument` Tool

**Files:**
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/edit-document-handler.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/modify-text-handler.tsx`
- Modify or reuse: `packages/plugin/views/assistant/ai-chat/tool-handlers/create-files-handler.tsx`
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Define a single editing contract**

Create a new schema like:

```ts
editDocument: z.object({
  path: z.string().optional(),
  operation: z.enum(["replace", "insert_before", "insert_after", "append"]),
  target: z.string().optional(),
  content: z.string(),
  reason: z.string(),
})
```

**Step 2: Reuse the current review/apply UX**

Lift the best parts of `ModifyTextHandler`:
- diff preview
- apply / discard flow
- explicit human review

Do not keep three separate overlapping edit tools exposed to the model.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Manual expectation:
- a single tool can handle normal note rewrites and insertions with review

---

### Task 5: Keep `deleteFiles`, But Harden It Behind Explicit Permission Scope

**Files:**
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/delete-files-handler.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/resolve-file.ts`
- Modify if needed: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`

**Step 1: Keep deletion model-facing, but require stronger arguments**

Extend schema to include:

```ts
deleteFiles: z.object({
  filePaths: z.array(z.string()),
  reason: z.string(),
  scope: z.enum(["model_created", "explicit_user_request", "cleanup"]),
  permanentDelete: z.boolean(),
})
```

**Step 2: Enforce safety rules in the handler**

Rules:
- always require a confirmation UI
- default to trash, never permanent delete unless explicitly requested by user intent
- display exact files and count
- reject deletion if the tool call does not include a clear `reason`
- optionally restrict `scope === "model_created"` to files created during the active session

**Step 3: Preserve cleanup value**

This tool is intentionally kept so the model can clean up plan/scratchpad artifacts or undo its own generated clutter with human approval.

**Step 4: Verify**

Manual checks:
- delete one generated scratch note
- cancel deletion
- confirm trash delete
- verify permanent delete still requires explicit request semantics

Then run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 6: Build Background Scribe’s Three Narrow Tools

**Files:**
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/upsert-scratchpad-note-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/publish-plan-note-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/decompose-plan-note-handler.tsx`
- Modify: `packages/plugin/services/background-scribe.ts`
- Modify: `packages/plugin/views/assistant/organizer/chunks.tsx`
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Implement `upsertScratchpadNote`**

This tool should:
- create or update one session-linked scratchpad note
- avoid duplicates
- return the final path

**Step 2: Implement `publishPlanNote`**

This tool should:
- take structured planning content
- create or update a polished implementation plan note
- link back to the scratchpad if present

**Step 3: Implement `decomposePlanNote`**

This tool should:
- reuse the atomic-notes / chunking infrastructure where possible
- break a plan into actionable sub-notes or task notes

**Step 4: Verify**

Manual flow:
- create scratchpad
- update scratchpad
- publish plan
- decompose plan

Then run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 7: Build The Auto-Sort Tuner Tool Set

**Files:**
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/get-organization-preferences-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/update-organization-preferences-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/lock-file-in-place-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/unlock-file-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/explain-sort-decision-handler.tsx`
- Modify: `packages/plugin/services/organization-preferences.ts`
- Modify: `packages/plugin/inbox/index.ts`
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Build read/write preference tools**

`getOrganizationPreferences` should return current rules in a model-friendly structured form.

`updateOrganizationPreferences` should update rules narrowly instead of accepting a giant freeform “settings blob.”

**Step 2: Build explicit lock/unlock tools**

These should leverage the existing pinned/locked file concept, not invent a second lock system.

**Step 3: Build `explainSortDecision`**

This should surface:
- selected folder
- confidence
- nearest neighbors or matched cues
- whether a lock prevented movement

**Step 4: Verify**

Manual flow:
- inspect preferences
- update one preference
- lock a file
- explain a sort decision

Then run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 8: Treat Cosmic Context And Vault QA As Runtime Capabilities, Not Tool Bundles

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Modify: `packages/plugin/views/assistant/context/index.tsx`
- Modify: `packages/plugin/services/background-scribe.ts` only if mode wiring overlaps
- Modify: `packages/plugin/modes/tool-allowlists.ts`

**Step 1: Ensure Cosmic Context has an empty tool allowlist**

Do not give the model “context tools” for this mode.

**Step 2: Ensure Vault QA relies on retrieval backend, not generic Obsidian mutation tools**

If `saveAnswerToNote` is not yet needed, keep the mode read-only at first.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- these modes compile with tiny or empty tool allowlists

---

### Task 9: Final Residue Sweep And Verification

**Files:**
- Whole tooling surface

**Step 1: Search for retired tool names**

Run:
```bash
rg -n "getSearchQuery|generateSettings|analyzeVaultStructure|executeActionsOnFileBasedOnPrompt|appendContentToFile|modifyDocumentText|addTextToDocument|mergeFiles|createTemplate|bulkFindReplace|exportToFormat" packages/plugin packages/web
```

Classify remaining matches as:
- intentionally dormant
- internal helper still to be removed
- bug / missed cleanup

**Step 2: Verify mode allowlists are minimal**

Create a quick checklist:
- Background Scribe: 3 tools + guarded delete
- Cosmic Context: 0 tools
- Auto-Sort Tuner: 5 tools + guarded delete
- Vault QA: 0-2 tools
- Project Copilot: no more than 10 tools

**Step 3: Final verification**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- exit code `0`

**Step 4: Commit**

```bash
git add docs/plans packages/plugin packages/web
git commit -m "refactor: scope tools by assistant mode"
```
