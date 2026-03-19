# Plan B: Chat + Tools + Sidebar Cleanup

> **Agent:** CLI Copilot (Claude CLI)
> **Worktree:** `.worktrees/cleanup-phase2b`
> **Branch:** `cleanup/phase-2b` (created from `master`)
> **Working directory:** `/home/tanner/Projects/Zenith-AI/.worktrees/cleanup-phase2b`
> **Scope:** `packages/plugin/` — chat UI, tool handlers, sidebar view, model selector, background scribe
> **Commit to:** `cleanup/phase-2b` branch ONLY. Do NOT push to master. Do NOT touch any other branch.

---

## GIT SETUP (EXACT COMMANDS)

```bash
cd /home/tanner/Projects/Zenith-AI
git worktree add .worktrees/cleanup-phase2b -b cleanup/phase-2b master
cd .worktrees/cleanup-phase2b
```

**All work happens inside `/home/tanner/Projects/Zenith-AI/.worktrees/cleanup-phase2b/`.**
**All commits go to the `cleanup/phase-2b` branch.**
**NEVER** `cd` to the main worktree or run `git checkout` on a different branch.

---

## ENFORCEMENT RULES

Copy of rules from the master plan. **Read and obey every one.**

### NAMING
- Every name in this plan is **exact and final**. Do NOT rename anything unless this plan explicitly says to.

### DELETIONS
- "Delete" means **remove from the codebase entirely**. Not comment out. Not mark as deprecated. Not wrap in `if (false)`. **Delete the code. Remove the lines. They do not exist anymore.**
- After deleting, grep the entire `packages/plugin/` directory for the deleted symbol. If any reference remains, delete that too. Zero references is the only acceptable state.
- If deleting a symbol causes a TypeScript error in a file that is NOT being deleted, fix the error by removing the usage — do NOT add a stub or dummy value.

### SCOPE
- Do NOT add new features, new abstractions, new files, or new utilities unless this plan explicitly says to create them.
- Do NOT refactor surrounding code "while you're in there." Touch only what this plan specifies.
- Do NOT add comments explaining what was removed. The git history is sufficient.

### CRITICAL: FILES YOU MUST NOT TOUCH
These files are being edited by **Plan A in a parallel worktree**. If you touch them, the merge will conflict.

```
DO NOT EDIT:
  packages/plugin/settings.ts
  packages/plugin/views/settings/main.tsx
  packages/plugin/views/settings/general-tab.tsx
  packages/plugin/views/settings/advanced-tab.tsx
  packages/plugin/index.ts
  packages/plugin/fileUtils.ts
  packages/plugin/settings.test.ts
```

If removing something from chat.tsx or view.tsx references a setting that still exists in settings.ts (because Plan A hasn't run yet), **just delete the reference**. The setting will be removed by Plan A. Your job is to remove the USAGE, not the definition.

---

## B1: Delete Tool Handler Files

```bash
cd packages/plugin

git rm -f views/assistant/ai-chat/tool-handlers/append-content-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/date-range-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/broken-links-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/backlinks-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/outgoing-links-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/export-to-format-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/metadata-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/frontmatter-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/tags-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/create-template-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/execute-actions-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/settings-update-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/extract-highlights-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/onboard-handler.tsx
git rm -f views/assistant/ai-chat/tool-handlers/search-annotation-handler.tsx

# Entire organizer directory
git rm -rf views/assistant/organizer/
```

**Do NOT delete** these tool handlers (they survive):
- `search-handler.tsx`, `last-modified-handler.tsx`, `open-file-handler.tsx`
- `move-files-handler.tsx`, `rename-files-handler.tsx`, `search-rename-handler.tsx`
- `add-text-handler.tsx`, `modify-text-handler.tsx`, `tagged-files-handler.tsx`
- `create-files-handler.tsx`, `delete-files-handler.tsx`, `merge-files-handler.tsx`
- `bulk-find-replace-handler.tsx`, `headings-handler.tsx`
- `tool-invocation-handler.tsx`, `types.ts`, `resolve-file.ts`

---

## B2: Clean `tool-invocation-handler.tsx`

File: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`

### B2a. Remove these imports (delete the entire import line for each):
- `DateRangeHandler` from `"./date-range-handler"`
- `SettingsUpdateHandler` from `"./settings-update-handler"`
- `AppendContentHandler` from `"./append-content-handler"`
- `OnboardHandler` from `"./onboard-handler"`
- `ExecuteActionsHandler` from `"./execute-actions-handler"`
- `MetadataHandler` from `"./metadata-handler"`
- `FrontmatterHandler` from `"./frontmatter-handler"`
- `TagsHandler` from `"./tags-handler"`
- `BacklinksHandler` from `"./backlinks-handler"`
- `OutgoingLinksHandler` from `"./outgoing-links-handler"`
- `ExtractHighlightsHandler` from `"./extract-highlights-handler"`
- `CreateTemplateHandler` from `"./create-template-handler"`
- `ExportToFormatHandler` from `"./export-to-format-handler"`
- `BrokenLinksHandler` from `"./broken-links-handler"`
- `UpdateVaultStructureHandler` from `"./update-vault-structure-handler"` (if it exists)

### B2b. Remove these entries from the `getToolTitle()` object:
- `getNotesForDateRange`
- `askForConfirmation`
- `generateSettings`
- `appendContentToFile`
- `analyzeVaultStructure`
- `executeActionsOnFileBasedOnPrompt`
- `onboardUser`
- `getFileMetadata`
- `updateFrontmatter`
- `addTags`
- `getBacklinks`
- `getOutgoingLinks`
- `extractHighlights`
- `createTemplate`
- `exportToFormat`
- `findBrokenLinks`
- `update_vault_structure`

### B2c. Remove the matching entries from the `handlers` object (same tool names as B2b, wherever they appear as handler mappings).

---

## B3: Clean `chat.tsx`

File: `packages/plugin/views/assistant/ai-chat/chat.tsx`

### B3a. Remove these imports:
```
import { SearchAnnotationHandler } from "./tool-handlers/search-annotation-handler";
```
And any import for `isSearchResultsAnnotation` or `SearchResultsAnnotation` from `"./types/annotations"`.

### B3b. Remove all JSX and logic referencing `SearchAnnotationHandler` and `isSearchResultsAnnotation`.

### B3c. Remove all references to `plugin.settings.showLocalLLMInChat`. Wherever it gates behavior, remove the gate entirely — the behavior it was gating should now always be active.

### B3d. Remove the `"Cloud"` display label. The model field sends the literal `plugin.settings.selectedModel` value — display it as-is.

### B3e. Remove references to `plugin.settings.backgroundScribeEnabled`. The `backgroundScribe` instance variable and the `"zenith-ai:background-scribe-changed"` event listener **STAY** — they will be rewired to tab-based activation in B5.

---

## B4: Clean `model-selector.tsx`

File: `packages/plugin/views/assistant/ai-chat/model-selector.tsx`

### B4a. Delete the `MODEL_DISPLAY_NAMES` mapping (the one that maps `gpt-4o-mini` → `"Cloud"`).
### B4b. Show the literal value of `selectedModel` as the display name.
### B4c. Remove all references to `plugin.settings.showLocalLLMInChat`. The model selector is always interactive — no gate.
### B4d. **KEEP** the `"custom"` model option and inline editing of `customModelName`.

---

## B5: Clean `view.tsx` — Sidebar Tabs

File: `packages/plugin/views/assistant/view.tsx`

### B5a. Change Tab type to: `type Tab = "chat" | "scribe";`
### B5b. Remove imports:
- `AssistantView` (from organizer)
- `InboxLogs`
- `SectionHeader` (if only used by removed tabs)
- `ProjectContextTab`
- `InboxService`
- `Sparkles` icon (from lucide)
- `Inbox` icon (from lucide)
- `Compass` icon (from lucide)

### B5c. Remove the Organizer tab button, Inbox tab button, and Context tab button from the tab bar.
### B5d. Remove Organizer/Inbox/Context content rendering from the `TabContent` component or equivalent switch/conditional.
### B5e. Remove `processingCount` state and the interval/event listener that polls `InboxService` for count.
### B5f. Add a "Scribe" tab button (use `Bot` icon from lucide-react, or `PenTool` — pick whichever is already imported or simplest). When Scribe tab is active, it should activate `BackgroundScribe` on the plugin instance.
### B5g. Remove command registrations for `open-organizer-tab` and `open-inbox-tab` from `AssistantViewWrapper`.
### B5h. `activateTab` only accepts `"chat" | "scribe"`.

---

## B6: Modify `background-scribe.ts`

File: `packages/plugin/services/background-scribe.ts`

### B6a. Remove the `if (!this.plugin.settings.backgroundScribeEnabled) return false;` guard from `activate()`.
### B6b. Hardcode output path to `"TODO.md"` (replaces `this.plugin.settings.backgroundScribeOutputFile`).
### B6c. Hardcode `"Projects"` as project root (replaces `this.plugin.settings.projectsPath`).
### B6d. The `VertexBrainClient` import/type reference — if the import breaks because Plan A deleted the file, change the constructor parameter type to `any` and guard all `this.client` calls with null checks. The service is non-functional until embedding infra is rebuilt — that's intentional.

---

## B7: Verification

### B7a. Run `npx tsc --noEmit` in `packages/plugin/`
- Pre-existing errors (AI SDK v4, radix, rust-tree-sitter) = acceptable
- New errors in files listed under "DO NOT TOUCH" = acceptable (Plan A fixes them)
- New errors in YOUR files = fix them

### B7b. Grep for deleted symbols:
```bash
for sym in showLocalLLMInChat appendContentToFile getNotesForDateRange askForConfirmation generateSettings analyzeVaultStructure executeActionsOnFileBasedOnPrompt onboardUser getFileMetadata updateFrontmatter addTags getBacklinks getOutgoingLinks extractHighlights createTemplate exportToFormat findBrokenLinks SearchAnnotationHandler DateRangeHandler SettingsUpdateHandler AppendContentHandler OnboardHandler ExecuteActionsHandler MetadataHandler FrontmatterHandler TagsHandler BacklinksHandler OutgoingLinksHandler ExtractHighlightsHandler CreateTemplateHandler ExportToFormatHandler BrokenLinksHandler AssistantView InboxLogs ProjectContextTab; do
  count=$(grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/ | grep -v "phase-2" | grep -v "post-cleanup" | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "WARN: $sym still has $count references"
    grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/
  fi
done
```
References found ONLY in Plan A's files (index.ts, settings.ts, etc.) are acceptable. References in YOUR files = fix them.

### B7c. Commit:
```bash
git add -A && git commit -m "refactor(plan-b): remove 15 chat tools, clean sidebar to chat+scribe, remove Cloud label, clean model selector"
```

---

## FILES TOUCHED BY THIS PLAN (complete list)

**Deleted:**
- `views/assistant/ai-chat/tool-handlers/append-content-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/date-range-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/broken-links-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/backlinks-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/outgoing-links-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/export-to-format-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/metadata-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/frontmatter-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/tags-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/create-template-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/execute-actions-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/settings-update-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/extract-highlights-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/onboard-handler.tsx`
- `views/assistant/ai-chat/tool-handlers/search-annotation-handler.tsx`
- `views/assistant/organizer/` (entire directory)

**Edited:**
- `views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`
- `views/assistant/ai-chat/chat.tsx`
- `views/assistant/ai-chat/model-selector.tsx`
- `views/assistant/view.tsx`
- `services/background-scribe.ts`

---

## MERGE INSTRUCTIONS (for the human, after both plans complete)

After both Plan A and Plan B have committed to their respective branches:

```bash
cd /home/tanner/Projects/Zenith-AI

# Merge Plan A into master
git checkout master
git merge cleanup/phase-2a -m "Merge phase-2a: core + settings cleanup"

# Merge Plan B into master
git merge cleanup/phase-2b -m "Merge phase-2b: chat + tools + sidebar cleanup"

# Final verification on master
cd packages/plugin
npx tsc --noEmit

# If clean, push
cd ../..
git push origin master

# Cleanup worktrees and branches
git worktree remove .worktrees/cleanup-phase2a
git worktree remove .worktrees/cleanup-phase2b
git branch -d cleanup/phase-2a
git branch -d cleanup/phase-2b
```
