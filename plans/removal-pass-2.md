# Zenith-AI — Removal Pass 2: Execution Plan

> **Branch:** `cleanup/phase-2` (create from `cleanup/settings-purge`)
> **Date:** 2026-03-19
> **Scope:** `packages/plugin/` only. Web package is NOT touched.

---

## ENFORCEMENT RULES

These rules are **non-negotiable**. Any agent executing this plan MUST follow them.

### NAMING
- Every name in this plan is **exact and final**. Do NOT rename anything unless this plan explicitly says to.
- `backupDirectory` is the name. Not `backupDir`, not `backupPath`, not `backupFolder`, not `backupFolderPath`. **`backupDirectory`**.
- `.ZenithAI` is the folder name. Not `_ZenithAI`, not `.zenith-ai`, not `.zenith_ai`. **`.ZenithAI`**.

### DELETIONS
- "Delete" means **remove from the codebase entirely**. Not comment out. Not mark as deprecated. Not wrap in `if (false)`. **Delete the code. Remove the lines. They do not exist anymore.**
- After deleting, grep the entire `packages/plugin/` directory for the deleted symbol. If any reference remains, delete that too. Zero references is the only acceptable state.
- If deleting a symbol causes a TypeScript error in a file that is NOT being deleted, fix the error by removing the usage — do NOT add a stub or dummy value.

### SCOPE
- Do NOT add new features, new abstractions, new files, or new utilities unless this plan explicitly says to create them.
- Do NOT refactor surrounding code "while you're in there." Touch only what this plan specifies.
- Do NOT add comments explaining what was removed. The git history is sufficient.
- Do NOT create migration code for old settings. `Object.assign` with new defaults handles it.

### VERIFICATION
- After each task group, run `npx tsc --noEmit` in `packages/plugin/`. Pre-existing errors (AI SDK v4 type mismatches, radix types, rust-tree-sitter) are acceptable. **New** errors are not.
- After all tasks complete, run `grep -rn "SYMBOL" --include="*.ts" --include="*.tsx" packages/plugin/` for every deleted symbol listed in this plan. Zero matches required (excluding `dist/`, `node_modules/`, and this plan file itself).

---

## TASK 1: Delete Entire Directories & Files

Delete these via `git rm -rf` / `git rm -f`:

```
packages/plugin/views/settings/customization-tab.tsx
packages/plugin/views/settings/file-config-tab.tsx
packages/plugin/views/settings/experiment-tab.tsx
packages/plugin/views/settings/account-data.tsx
packages/plugin/views/settings/top-up-credits.tsx
packages/plugin/views/settings/top-up-minutes.tsx
packages/plugin/components/usage-stats.tsx
packages/plugin/views/assistant/organizer/          (entire directory)
packages/plugin/views/assistant/ai-chat/tool-handlers/append-content-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/date-range-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/broken-links-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/backlinks-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/outgoing-links-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/export-to-format-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/metadata-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/frontmatter-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/tags-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/create-template-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/execute-actions-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/settings-update-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/extract-highlights-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/onboard-handler.tsx
packages/plugin/views/assistant/ai-chat/tool-handlers/search-annotation-handler.tsx
```

**Do NOT delete** these tool handlers (they survive):
- `search-handler.tsx`, `last-modified-handler.tsx`, `open-file-handler.tsx`
- `move-files-handler.tsx`, `rename-files-handler.tsx`, `search-rename-handler.tsx`
- `add-text-handler.tsx`, `modify-text-handler.tsx`, `tagged-files-handler.tsx`
- `create-files-handler.tsx`, `delete-files-handler.tsx`, `merge-files-handler.tsx`
- `bulk-find-replace-handler.tsx`, `headings-handler.tsx`
- `tool-invocation-handler.tsx`, `types.ts`, `resolve-file.ts`

---

## TASK 2: Clean `tool-invocation-handler.tsx`

File: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`

### 2a. Remove these imports (delete the entire import line for each):
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
- `UpdateVaultStructureHandler` from `"./update-vault-structure-handler"`

### 2b. Remove these entries from the `getToolTitle()` object:
- `getNotesForDateRange`, `askForConfirmation`, `generateSettings`, `appendContentToFile`
- `analyzeVaultStructure`, `executeActionsOnFileBasedOnPrompt`, `onboardUser`
- `getFileMetadata`, `updateFrontmatter`, `addTags`, `getBacklinks`, `getOutgoingLinks`
- `extractHighlights`, `createTemplate`, `exportToFormat`, `findBrokenLinks`, `update_vault_structure`

### 2c. Remove these entries from the `handlers` object (same list as 2b where they exist as handler mappings).

---

## TASK 3: Clean `chat.tsx`

File: `packages/plugin/views/assistant/ai-chat/chat.tsx`

### 3a. Remove these imports:
```
import { SearchAnnotationHandler } from "./tool-handlers/search-annotation-handler";
import { isSearchResultsAnnotation, SearchResultsAnnotation } from "./types/annotations";
```

### 3b. Remove all JSX and logic referencing `SearchAnnotationHandler` and `isSearchResultsAnnotation`.

### 3c. Remove `showLocalLLMInChat` references. Gate local LLM on `selectedModel !== "gpt-4o-mini"` instead.

### 3d. Remove direct reads of `plugin.settings.backgroundScribeEnabled`. The scribe state variables and event listeners **stay** — they will be rewired to tab-based activation.

### 3e. Remove the `"Cloud"` label. The model field sends the literal `plugin.settings.selectedModel` value.

---

## TASK 4: Clean `model-selector.tsx`

File: `packages/plugin/views/assistant/ai-chat/model-selector.tsx`

### 4a. Delete the `MODEL_DISPLAY_NAMES` mapping (the one that maps `gpt-4o-mini` → `"Cloud"`).
### 4b. Show the literal value of `selectedModel` as the display name.
### 4c. Remove all references to `plugin.settings.showLocalLLMInChat`. The model selector is always interactive.
### 4d. **KEEP** the `"custom"` model option and inline editing of `customModelName`.

---

## TASK 5: Rewrite `settings.ts`

File: `packages/plugin/settings.ts`

Replace the ENTIRE file contents with:

```typescript
export class ZenithAISettings {
  API_KEY = "";
  enableSelfHosting = false;
  selfHostingURL = "http://localhost:3010";
  selectedModel: "gpt-4o-mini" | "llama3.2" = "gpt-4o-mini";
  customModelName = "llama3.2";
  debugMode = false;
  enableSearchGrounding = false;
  enableDeepSearch = false;
}

export const DEFAULT_SETTINGS = new ZenithAISettings();
```

**9 settings total. Nothing else.**

---

## TASK 6: Clean `settings/main.tsx`

File: `packages/plugin/views/settings/main.tsx`

### 6a. Remove imports: `FileConfigTab`, `CustomizationTab`, `ExperimentTab`.
### 6b. Remove those three entries from the `tabs` array.
### 6c. Result: Settings has two tabs: **General** and **Advanced**.

---

## TASK 7: Clean `general-tab.tsx`

File: `packages/plugin/views/settings/general-tab.tsx`

### 7a. Remove imports: `UsageStats`, `TopUpCredits`, `AccountData`, `FREE_TIER_TOKEN_LIMIT`.
### 7b. Remove the local `UsageData` interface.
### 7c. Remove `fetchUsageData` function and all its calls.
### 7d. Remove all `usageData` state, `isLoadingUsage` state.
### 7e. Remove all JSX rendering `<UsageStats>`, `<TopUpCredits>`, `<AccountData>`.
### 7f. What remains: API key input with format validation. That's the entire General tab.

---

## TASK 8: Clean `advanced-tab.tsx`

File: `packages/plugin/views/settings/advanced-tab.tsx`

### 8a. Remove `backgroundScribeEnabled` state, its `useEffect`, and its `<ToggleSetting>`.
### 8b. Remove `showLocalLLMInChat` state, its `useEffect`, and its `<ToggleSetting>`.
### 8c. What remains: Debug Mode toggle, Self-Hosting toggle + URL input. That's it.

---

## TASK 9: Clean `index.ts` — Imports & Properties

File: `packages/plugin/index.ts`

### 9a. Remove imports:
- `VertexBrainClient`, `OrganizationPreferencesService`, `VaultIndexer`, `BackgroundScribe`
- `checkAndCreateTemplates`, `restoreDefaultTemplates` (from fileUtils import)
- `initializeInboxQueue`, `Inbox` (from `"./inbox"`)
- `ProcessingStatusBar` (from `"./components/processing-status-bar"`) — check if this depends on inbox; if so, delete

### 9b. Remove class properties:
- `public inbox: Inbox;`
- `vertexBrainClient`, `organizationPreferences`, `vaultIndexer`, `backgroundScribe`

### 9c. Remove interfaces: `UsageData`, `TitleSuggestion`, `FileMetadata`, `ProcessingResult`.

---

## TASK 10: Clean `index.ts` — Delete Methods

Delete these methods entirely (signature through closing brace):

1. `identifyConceptsAndFetchChunks()`
2. `formatContentV2()`
3. `getFormatInstruction()`
4. `streamFormatInSplitView()`
5. `cleanupTagsInContent()`
6. `streamFormatInCurrentNote()`
7. `streamFormatAppendInCurrentNote()`
8. `streamFormatInCurrentNoteLineByLine()`
9. `formatStream()`
10. `classifyContentV2()`
11. `getTextFromFile()`
12. `recommendTags()`
13. `getOrganizationRulesContext()`
14. `recommendFolders()`
15. `appendTag()`
16. `appendTags()`
17. `appendAttachment()`
18. `appendToFrontMatter()`
19. `appendBackupLinkToCurrentFile()`
20. `appendFormattedLinkToBackupFile()`
21. `getTemplateInstructions()`
22. `getTemplateNames()`
23. `recommendName()`
24. `checkAndCreateRequiredFolders()`
25. `fetchUsageStats()`
26. `getAllVaultTags()`
27. `processBacklog()`
28. `getBacklog()`
29. `checkAndCreateTemplates()` (wrapper)
30. `restoreTemplates()` (wrapper)
31. `generateUniqueBackupFileName()`
32. `backupTheFileAndAddReferenceToCurrentFile()`
33. `getAllUserFolders()`
34. `getAllIgnoredFolders()`
35. `getAllUserMarkdownFiles()`
36. `shouldCreateMarkdownContainer()`
37. `checkAndCreateFolders()` (wrapper)

---

## TASK 11: Clean `index.ts` — `onload()` Method

### 11a. Remove: `this.inbox = Inbox.initialize(this);`
### 11b. Remove: `initializeInboxQueue(this);`
### 11c. Remove: `await checkAndCreateTemplates` call in `initializePlugin()`
### 11d. Remove: entire Vault Intelligence initialization block (OrganizationPreferencesService, VaultIndexer, VertexBrainClient health check, BackgroundScribe init)
### 11e. Remove: `this.registerEvent(app.vault.on("modify", ...))` vault indexer block
### 11f. Remove: `this.processBacklog()` call
### 11g. Remove: `restore-default-templates` command registration
### 11h. Remove: `process-inbox-now` command registration
### 11i. Remove: `open-organizer-tab` command registration
### 11j. Remove: `open-inbox-tab` command registration
### 11k. Remove: model migration block in `loadSettings()`
### 11l. Remove: `await this.checkAndCreateFolders()` call in `initializePlugin()`
### 11m. Remove: `await ensureFolderExists(this.app, this.settings.logFolderPath)` (logFolderPath no longer exists)
### 11n. Remove: StatusBar rendering if it depends on inbox/processing (check `ProcessingStatusBar` component)

---

## TASK 12: Delete `inbox/` Directory

```
git rm -rf packages/plugin/inbox/
```

---

## TASK 13: Delete Service Files

```
git rm -f packages/plugin/services/vertex-brain-client.ts
git rm -f packages/plugin/services/vertex-brain-client.test.ts
git rm -f packages/plugin/services/organization-preferences.ts
git rm -f packages/plugin/services/vault-indexer.ts
```

**Do NOT delete:** `background-scribe.ts`, `logger.ts`, `patch-engine/`

---

## TASK 14: Modify `background-scribe.ts`

File: `packages/plugin/services/background-scribe.ts`

### 14a. Remove `if (!this.plugin.settings.backgroundScribeEnabled) return false;` guard.
### 14b. Hardcode output path to `"TODO.md"` (replaces `this.plugin.settings.backgroundScribeOutputFile`).
### 14c. Hardcode `"Projects"` as project root (replaces `this.plugin.settings.projectsPath`).
### 14d. Make `client: VertexBrainClient` optional in constructor. Guard all `this.client` calls with null checks. This service is non-functional until embedding infra is rebuilt — that's intentional.
### 14e. Remove the `VertexBrainClient` import type if it causes errors (the file is deleted). Use inline type or `any` temporarily.

---

## TASK 15: Clean `fileUtils.ts`

File: `packages/plugin/fileUtils.ts`

### 15a. Delete `DEFAULT_TEMPLATES` array.
### 15b. Delete `checkAndCreateTemplates()` function.
### 15c. Delete `restoreDefaultTemplates()` function.
### 15d. Simplify or delete `checkAndCreateFolders()` — it references deleted settings. If no callers remain, delete entirely.

---

## TASK 16: Clean `view.tsx` — Sidebar Tabs

File: `packages/plugin/views/assistant/view.tsx`

### 16a. Change Tab type to: `type Tab = "chat" | "scribe";`
### 16b. Remove imports: `AssistantView` (from organizer), `InboxLogs`, `SectionHeader`, `ProjectContextTab`, `InboxService`, `Sparkles`, `Inbox` (icon), `Compass`.
### 16c. Remove Organizer tab button, Inbox tab button, Context tab button.
### 16d. Remove Organizer/Inbox/Context content rendering from `TabContent`.
### 16e. Remove `processingCount` state and the interval/event listener that polls `InboxService`.
### 16f. Add a "Scribe" tab button (icon: `Bot` or similar from lucide). When active, pass `scribeMode={true}` to `AIChatSidebar`.
### 16g. Remove command registrations for `open-organizer-tab` and `open-inbox-tab` from `AssistantViewWrapper`.
### 16h. `activateTab` only accepts `"chat" | "scribe"`.

---

## TASK 17: Clean `settings.test.ts` & Snapshot

### 17a. `git rm -f packages/plugin/__snapshots__/settings.test.ts.snap`
### 17b. Rewrite `settings.test.ts` to test only the 9 surviving settings from Task 5.

---

## TASK 18: Final Grep Verification

```bash
for sym in defaultDestinationPath templatePaths enableFileRenaming enableTitleSuggestions enableAtomicNotes showLocalLLMInChat backgroundScribeEnabled organizationRulesPath enableVectorAutoSort autoSortConfidenceThreshold pinnedTag projectsPath vertexBrainUrl autoDetectProjectContext backgroundScribeOutputFile backupFolderPath formatStream classifyContentV2 recommendTags recommendFolders recommendName appendTag appendTags processInboxFile fetchUsageStats cleanupTagsInContent getTemplateInstructions getTemplateNames checkAndCreateTemplates restoreDefaultTemplates UsageStats TopUpCredits AccountData CustomizationTab FileConfigTab ExperimentTab InboxLogs AssistantView; do
  count=$(grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/ | grep -v "PLAN.md" | grep -v "post-cleanup" | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "FAIL: $sym still has $count references"
    grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/
  fi
done
```

**Zero references required for every symbol.**

---

## TASK 19: TypeScript Verification

```bash
cd packages/plugin && npx tsc --noEmit
```

Pre-existing errors (AI SDK v4, radix, rust-tree-sitter) = acceptable.
New errors = fix by removing the broken reference. Do NOT add stubs.

---

## TASK 20: Commit

```
git add -A && git commit -m "refactor: removal pass 2 — delete inbox pipeline, templates, formatting, billing UI, vault intelligence settings"
```

---

## WHAT SURVIVES

**Settings** (9 total):
`API_KEY`, `enableSelfHosting`, `selfHostingURL`, `selectedModel`, `customModelName`, `debugMode`, `enableSearchGrounding`, `enableDeepSearch`

**Settings UI** (2 tabs):
- General → API key input
- Advanced → Debug mode, Self-hosting toggle + URL

**Sidebar** (2 tabs):
- Chat → AI chat with tools, model selector, search grounding
- Scribe → Same chat but Background Scribe active

**Chat Tools** (13 surviving):
`getSearchQuery`, `searchByName`, `getLastModifiedFiles`, `getTaggedFiles`, `getHeadings`, `openFile`, `moveFiles`, `renameFiles`, `createNewFiles`, `deleteFiles`, `mergeFiles`, `addTextToDocument`, `modifyDocumentText`, `bulkFindReplace`

**Services:** `background-scribe.ts` (degraded), `logger.ts`, `patch-engine/`

**NOT built yet** (future work):
- `.ZenithAI/CosmicVaultStructure.json` config system
- Embedding-based inbox processing
- Chat history at `.ZenithAI/ChatHistory/` as markdown
- BackgroundScribe reimplementation without VertexBrainClient
