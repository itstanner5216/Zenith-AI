# Plan A: Core + Settings Cleanup

> **Agent:** Copilot (VS Code)
> **Worktree:** `.worktrees/cleanup-phase2a`
> **Branch:** `cleanup/phase-2a` (created from `master`)
> **Scope:** `packages/plugin/` — settings system, index.ts, settings UI, services, inbox, fileUtils, tests
> **Commit to:** `cleanup/phase-2a` branch ONLY. Do NOT push to master. Do NOT touch any other branch.

---

## ENFORCEMENT RULES

Copy of rules from the master plan. **Read and obey every one.**

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

### CRITICAL: FILES YOU MUST NOT TOUCH
These files are being edited by **Plan B in a parallel worktree**. If you touch them, the merge will conflict.

```
DO NOT EDIT:
  packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx
  packages/plugin/views/assistant/ai-chat/chat.tsx
  packages/plugin/views/assistant/ai-chat/model-selector.tsx
  packages/plugin/views/assistant/view.tsx
  packages/plugin/services/background-scribe.ts
```

If removing something from `index.ts` or `settings.ts` causes a TypeScript error in one of those files, **leave the error**. Plan B will fix it in their edits. Do NOT touch those files.

---

## A1: Delete Files & Directories (Plan A's share)

```bash
cd packages/plugin

# Settings tab files
git rm -f views/settings/customization-tab.tsx
git rm -f views/settings/file-config-tab.tsx
git rm -f views/settings/experiment-tab.tsx
git rm -f views/settings/account-data.tsx
git rm -f views/settings/top-up-credits.tsx
git rm -f views/settings/top-up-minutes.tsx

# Billing/usage component
git rm -f components/usage-stats.tsx

# Entire inbox directory
git rm -rf inbox/

# Service files (NOT background-scribe.ts, NOT logger.ts, NOT patch-engine/)
git rm -f services/vertex-brain-client.ts
git rm -f services/vertex-brain-client.test.ts
git rm -f services/organization-preferences.ts
git rm -f services/vault-indexer.ts

# Test snapshot
git rm -f __snapshots__/settings.test.ts.snap
```

---

## A2: Rewrite `settings.ts`

File: `packages/plugin/settings.ts`

Replace the **ENTIRE** file contents with:

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

## A3: Clean `settings/main.tsx`

File: `packages/plugin/views/settings/main.tsx`

### A3a. Remove imports for: `FileConfigTab`, `CustomizationTab`, `ExperimentTab`
### A3b. Remove those three entries from the `tabs` array.
### A3c. Result: Settings has two tabs: **General** and **Advanced**.

---

## A4: Clean `general-tab.tsx`

File: `packages/plugin/views/settings/general-tab.tsx`

### A4a. Remove imports: `UsageStats`, `TopUpCredits`, `AccountData`, `FREE_TIER_TOKEN_LIMIT`.
### A4b. Remove the local `UsageData` interface.
### A4c. Remove `fetchUsageData` function and all its calls.
### A4d. Remove all `usageData` state, `isLoadingUsage` state.
### A4e. Remove all JSX rendering `<UsageStats>`, `<TopUpCredits>`, `<AccountData>`.
### A4f. What remains: API key input with format validation. That's the entire General tab.

---

## A5: Clean `advanced-tab.tsx`

File: `packages/plugin/views/settings/advanced-tab.tsx`

### A5a. Remove `backgroundScribeEnabled` state, its `useEffect`, and its `<ToggleSetting>`.
### A5b. Remove `showLocalLLMInChat` state, its `useEffect`, and its `<ToggleSetting>`.
### A5c. What remains: Debug Mode toggle, Self-Hosting toggle + URL input. That's it.

---

## A6: Clean `index.ts` — Imports & Properties

File: `packages/plugin/index.ts`

### A6a. Remove imports:
- `VertexBrainClient`, `OrganizationPreferencesService`, `VaultIndexer`
- `checkAndCreateTemplates`, `restoreDefaultTemplates` (from fileUtils import)
- `initializeInboxQueue`, `Inbox` (from `"./inbox"`)
- `ProcessingStatusBar` (from `"./components/processing-status-bar"`) — if it depends on inbox, delete it

### A6b. Remove class properties:
- `public inbox: Inbox;`
- `vertexBrainClient`, `organizationPreferences`, `vaultIndexer`

### A6c. Remove interfaces: `UsageData`, `TitleSuggestion`, `FileMetadata`, `ProcessingResult`

**DO NOT** remove the `backgroundScribe` property or its import. Plan B handles that file.

---

## A7: Clean `index.ts` — Delete Methods

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

## A8: Clean `index.ts` — `onload()` Method

### A8a. Remove: `this.inbox = Inbox.initialize(this);`
### A8b. Remove: `initializeInboxQueue(this);`
### A8c. Remove: `await checkAndCreateTemplates` call in `initializePlugin()`
### A8d. Remove: entire Vault Intelligence initialization block (OrganizationPreferencesService, VaultIndexer, VertexBrainClient health check)
### A8e. Remove: `this.registerEvent(app.vault.on("modify", ...))` vault indexer block
### A8f. Remove: `this.processBacklog()` call
### A8g. Remove: `restore-default-templates` command registration
### A8h. Remove: `process-inbox-now` command registration
### A8i. Remove: model migration block in `loadSettings()`
### A8j. Remove: `await this.checkAndCreateFolders()` call in `initializePlugin()`
### A8k. Remove: `await ensureFolderExists(this.app, this.settings.logFolderPath)` (logFolderPath no longer exists)
### A8l. Remove: StatusBar rendering if it depends on inbox/processing

**DO NOT** remove `open-organizer-tab` or `open-inbox-tab` command registrations — Plan B handles those in `view.tsx`.
**DO NOT** remove BackgroundScribe initialization — Plan B handles that.

---

## A9: Clean `fileUtils.ts`

File: `packages/plugin/fileUtils.ts`

### A9a. Delete `DEFAULT_TEMPLATES` array.
### A9b. Delete `checkAndCreateTemplates()` function.
### A9c. Delete `restoreDefaultTemplates()` function.
### A9d. Simplify or delete `checkAndCreateFolders()` — it references deleted settings. If no callers remain after A8, delete entirely.

---

## A10: Clean `settings.test.ts` & Snapshot

### A10a. Snapshot already deleted in A1.
### A10b. Rewrite `settings.test.ts` to test only the 9 surviving settings from A2:

```typescript
import { ZenithAISettings, DEFAULT_SETTINGS } from "./settings";

describe("ZenithAISettings", () => {
  it("should have correct defaults", () => {
    const settings = new ZenithAISettings();
    expect(settings.API_KEY).toBe("");
    expect(settings.enableSelfHosting).toBe(false);
    expect(settings.selfHostingURL).toBe("http://localhost:3010");
    expect(settings.selectedModel).toBe("gpt-4o-mini");
    expect(settings.customModelName).toBe("llama3.2");
    expect(settings.debugMode).toBe(false);
    expect(settings.enableSearchGrounding).toBe(false);
    expect(settings.enableDeepSearch).toBe(false);
  });

  it("DEFAULT_SETTINGS should be an instance of ZenithAISettings", () => {
    expect(DEFAULT_SETTINGS).toBeInstanceOf(ZenithAISettings);
  });
});
```

---

## A11: Verification

### A11a. Run `npx tsc --noEmit` in `packages/plugin/`
- Pre-existing errors (AI SDK v4, radix, rust-tree-sitter) = acceptable
- New errors in files listed under "DO NOT TOUCH" = acceptable (Plan B fixes them)
- New errors in YOUR files = fix them

### A11b. Grep for deleted symbols:
```bash
for sym in defaultDestinationPath templatePaths enableFileRenaming enableTitleSuggestions enableAtomicNotes backgroundScribeEnabled organizationRulesPath enableVectorAutoSort autoSortConfidenceThreshold pinnedTag vertexBrainUrl autoDetectProjectContext backgroundScribeOutputFile backupFolderPath formatStream classifyContentV2 recommendTags recommendFolders recommendName appendTag appendTags fetchUsageStats cleanupTagsInContent getTemplateInstructions getTemplateNames checkAndCreateTemplates restoreDefaultTemplates UsageStats TopUpCredits AccountData CustomizationTab FileConfigTab ExperimentTab InboxLogs; do
  count=$(grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/ | grep -v "phase-2" | grep -v "post-cleanup" | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "WARN: $sym still has $count references"
    grep -rn "$sym" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist/
  fi
done
```
References found ONLY in Plan B's files (chat.tsx, view.tsx, etc.) are acceptable. References in YOUR files = fix them.

### A11c. Commit:
```bash
git add -A && git commit -m "refactor(plan-a): remove settings, services, inbox, templates, billing UI, 37 methods from index.ts"
```

---

## FILES TOUCHED BY THIS PLAN (complete list)

**Deleted:**
- `views/settings/customization-tab.tsx`
- `views/settings/file-config-tab.tsx`
- `views/settings/experiment-tab.tsx`
- `views/settings/account-data.tsx`
- `views/settings/top-up-credits.tsx`
- `views/settings/top-up-minutes.tsx`
- `components/usage-stats.tsx`
- `inbox/` (entire directory)
- `services/vertex-brain-client.ts`
- `services/vertex-brain-client.test.ts`
- `services/organization-preferences.ts`
- `services/vault-indexer.ts`
- `__snapshots__/settings.test.ts.snap`

**Edited:**
- `settings.ts` (full rewrite)
- `views/settings/main.tsx`
- `views/settings/general-tab.tsx`
- `views/settings/advanced-tab.tsx`
- `index.ts` (heavy — imports, properties, 37 methods, onload blocks)
- `fileUtils.ts`
- `settings.test.ts` (rewrite)
