# Plugin Agent — Auto-Sort Pipeline Improvements & UX Fixes

## 🚨 WORKTREE SAFETY — READ THIS FIRST

**YOU MUST VERIFY YOUR WORKTREE BEFORE EVERY COMMIT.**

Parallel agents are running simultaneously in separate worktrees. Crossing into another agent's worktree WILL contaminate branches and cause hours of cleanup. **This MUST NOT happen.**

**Your worktree:** `/home/tanner/Projects/.note-companion-plugin`
**Your branch:** `feat/pipeline-improvements`

**Before EVERY commit, run:**
```bash
pwd  # Must show /home/tanner/Projects/.note-companion-plugin
git branch --show-current  # Must show feat/pipeline-improvements
```

**If you dispatch subagents**, you MUST include this in every subagent prompt:
> "CRITICAL: You are working in /home/tanner/Projects/.note-companion-plugin on branch feat/pipeline-improvements. Before ANY git operation, verify with `pwd` and `git branch --show-current`. Do NOT touch any other worktree or branch."

**Other agent worktree (DO NOT TOUCH):**
- Web Agent: `/home/tanner/Projects/.note-companion-web` → `feat/vision-model-routing`
- Main repo: `/home/tanner/Projects/.note-companion` → `master`

---

## 🚨 OWNERSHIP RULE — READ THIS FIRST

**You own ONLY `packages/plugin/` files.** The Web Agent owns `packages/web/`. Do NOT edit any file under `packages/web/`. If you find a bug there, note it in your commit message so the other agent can address it.

**You may READ any file** in the codebase for context, but only **edit files in your scope**.

---

## Required Skill Activations

### At Session Start — activate ALL THREE immediately:
1. **`subagent-driven-development`** — Use subagents to parallelize independent tasks
2. **`using-git-worktrees`** — Ensures all work stays isolated in your assigned worktree
3. **`executing-plans`** — For structured plan execution with review checkpoints

### When Investigating Potential Bugs:
4. **`systematic-debugging`** — Follow diagnostic workflow to confirm bugs before fixing.

### Before Claiming Completion (MANDATORY — do NOT skip):
5. **`verification-before-completion`** — Verify every file exists, every change is correct. Only THEN report complete.

---

## Context

**What this project is:** Note Companion — an Obsidian plugin that automatically organizes files. Users drop files in an inbox folder → the plugin watches for new files → AI classifies, tags, renames, and moves them.

**What we're doing:** Optimizing the auto-sort pipeline for speed and reliability. Making bulk chat operations faster. Adding progress feedback. The auto-sort pipeline currently processes files through ~12 sequential steps, several of which make independent API calls that could run in parallel.

**Tech stack:** TypeScript, Obsidian Plugin API, React (for UI views)

**Critical constraints:**
- NO optional model parameters — user explicitly rejected adding configurable temperature/etc
- All API calls go through the web backend — the plugin doesn't call AI directly
- The `appendTag` method at `packages/plugin/index.ts:1509` does a full read→write cycle PER TAG — this is the bottleneck we're fixing with batch tagging
- The pipeline in `packages/plugin/inbox/index.ts:331-424` runs all steps sequentially — one failure kills everything after it

---

## Scope — Files You Own

```
packages/plugin/handlers/eventHandlers.ts                          — Fix stale path + reduce delay
packages/plugin/inbox/index.ts                                     — Pipeline resilience, parallel APIs, batch tags
packages/plugin/index.ts                                           — Add appendTags() method, content cutoffs
packages/plugin/views/assistant/ai-chat/tool-handlers/bulk-find-replace-handler.tsx  — Parallelize
packages/plugin/views/assistant/ai-chat/tool-handlers/move-files-handler.tsx         — Parallelize
packages/plugin/views/assistant/ai-chat/tool-handlers/rename-files-handler.tsx       — Parallelize
packages/plugin/views/assistant/ai-chat/tool-handlers/merge-files-handler.tsx        — Parallelize
packages/plugin/views/assistant/ai-chat/tool-handlers/date-range-handler.tsx         — Progress counter
packages/plugin/views/assistant/ai-chat/tool-handlers/last-modified-handler.tsx      — Progress counter
```

---

## Task Execution Order

```
Phase 1 (all independent — run in parallel):
  Task 1: Fix stale inbox path + reduce delay (eventHandlers.ts)
  Task 2: Parallelize bulk file operations (4 handler files)
  Task 3: Add appendTags() batch method (index.ts)
  Task 4: Add safeExecuteStep wrapper (inbox/index.ts)
  Task 5: Task-specific content cutoffs (index.ts)
  Task 6: Progress counters (2 handler files)

Phase 2 (depends on Tasks 3, 4):
  Task 7: Rewire pipeline — batch tags, parallel APIs, resilience (inbox/index.ts)

Phase 3 (final):
  Task 8: Commit
```

---

## Task 1: Fix stale inbox path + reduce event delay

**File:** `packages/plugin/handlers/eventHandlers.ts`

**Problem 1:** Line 14 captures `const pathToWatch = plugin.settings.pathToWatch` once at registration time. If the user changes their inbox folder in settings, the old path is still being watched. Real bug.

**Problem 2:** Lines 18 and 29 have `setTimeout(resolve, 1000)` — a full second of dead wait per file drop before processing starts.

**Fix:** Replace the entire file content with:

```typescript
import { Notice, TFile } from "obsidian";
import FileOrganizer from "..";
import { Inbox } from "../inbox";
import { VALID_MEDIA_EXTENSIONS } from "../constants";

function isInInboxFolder(filePath: string, pathToWatch: string): boolean {
  if (!pathToWatch) return false;
  return (
    filePath === pathToWatch || filePath.startsWith(pathToWatch + "/")
  );
}

export function registerEventHandlers(plugin: FileOrganizer) {
  plugin.registerEvent(
    plugin.app.vault.on("create", async file => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (file instanceof TFile) {
        new Notice("Inbox is looking at new file: " + file.basename);
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  plugin.registerEvent(
    plugin.app.vault.on("rename", async (file, _oldPath) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (file instanceof TFile) {
        new Notice("Inbox is looking at new file: " + file.basename);
        Inbox.getInstance().enqueueFiles([file]);
      }
    })
  );

  plugin.registerEvent(
    plugin.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) return;
      if (!isInInboxFolder(file.path, plugin.settings.pathToWatch)) return;
      if (!VALID_MEDIA_EXTENSIONS.includes(file.extension)) return;
      Inbox.getInstance().enqueueFiles([file]);
    })
  );
}
```

**What changed:**
1. Removed `const pathToWatch = plugin.settings.pathToWatch;` (line 14) — each handler now reads `plugin.settings.pathToWatch` fresh
2. Reduced `setTimeout` from `1000` to `100` in both create and rename handlers
3. No other changes — same logic, same structure

---

## Task 2: Parallelize bulk file operations (4 handler files)

### 2a: `bulk-find-replace-handler.tsx`

Find the sequential `for (const file of validFiles)` loop that does `await app.vault.read(file)` then `await app.vault.modify(file, newContent)`.

Replace the sequential loop with `Promise.all`:

```typescript
const opResults = await Promise.all(
  validFiles.map(async (file) => {
    try {
      const content = await app.vault.read(file);
      let newContent: string;
      let fileMatches = 0;

      if (useRegex) {
        const flags = caseSensitive ? "g" : "gi";
        const regex = new RegExp(find, flags);
        const matches = content.match(regex);
        fileMatches = matches ? matches.length : 0;
        newContent = content.replace(regex, replace);
      } else {
        const searchText = caseSensitive ? content : content.toLowerCase();
        const findText = caseSensitive ? find : find.toLowerCase();
        let pos = 0;
        while ((pos = searchText.indexOf(findText, pos)) !== -1) {
          fileMatches++;
          pos += findText.length;
        }
        if (caseSensitive) {
          newContent = content.split(find).join(replace);
        } else {
          const regex = new RegExp(
            find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi"
          );
          newContent = content.replace(regex, replace);
        }
      }

      if (newContent !== content) {
        await app.vault.modify(file, newContent);
        return { modified: true, matches: fileMatches, error: null };
      }
      return { modified: false, matches: 0, error: null };
    } catch (error) {
      return { modified: false, matches: 0, error: `${file.path}: ${error.message}` };
    }
  })
);

// Aggregate results
for (const r of opResults) {
  if (r.error) errors.push(r.error);
  if (r.modified) filesModified++;
  totalMatches += r.matches;
}
```

**Important:** Keep the existing variable declarations for `filesModified`, `totalMatches`, `errors` — just move them before this block and aggregate after.

### 2b: `move-files-handler.tsx`

Find the nested sequential loops. Replace with parallel execution:

```typescript
await Promise.all(
  moves.map(async (move) => {
    try {
      const matchingFiles = getMatchingFiles(move);
      await plugin.app.vault.createFolder(move.destinationPath).catch((err) => {
        if (!err.message?.includes("already exists")) {
          console.warn(`Could not create folder ${move.destinationPath}: ${err.message}`);
        }
      });

      await Promise.all(
        matchingFiles.map(async (file) => {
          const newPath = `${move.destinationPath}/${file.name}`;
          await plugin.app.fileManager.renameFile(file, newPath);
          results.push(`✅ Moved: ${file.path} → ${newPath}`);
        })
      );

      if (matchingFiles.length === 0) {
        results.push(`ℹ️ No files found matching criteria for ${move.sourcePath}`);
      }
    } catch (error) {
      results.push(`❌ Error: ${error.message}`);
    }
  })
);
```

**Note:** The `.catch(() => {})` on folder creation is also fixed here — now logs if it's not an "already exists" error.

### 2c: `rename-files-handler.tsx`

Find the sequential `for (const fileData of files)` loop. Replace with:

```typescript
await Promise.all(
  files.map(async (fileData) => {
    try {
      const existingFile = plugin.app.vault.getAbstractFileByPath(fileData.oldPath);
      if (existingFile && existingFile instanceof TFile) {
        let newName = fileData.newName;
        if (newName.endsWith('.md')) {
          newName = newName.slice(0, -3);
        }
        newName = sanitizeFileName(newName);
        const folderPath = existingFile.parent?.path || '';
        const newPath = folderPath ? `${folderPath}/${newName}.md` : `${newName}.md`;
        await plugin.app.fileManager.renameFile(existingFile, newPath);
        renameResults.push(`✅ Renamed: ${existingFile.path} → ${newPath}`);
      } else {
        renameResults.push(`❌ Could not find file: ${fileData.oldPath}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      renameResults.push(`❌ Error: ${errorMessage}`);
    }
  })
);
```

### 2d: `merge-files-handler.tsx`

Find the sequential read loop (around line 79). Replace with parallel reads:

```typescript
const contents = await Promise.all(
  validFiles.map((file) => app.vault.read(file))
);
```

If there's a SECOND sequential read loop later in the file (around line 124), do the same.

Find the sequential delete loop (around line 162). Replace with:

```typescript
if (deleteSource) {
  await Promise.all(validFiles.map((file) => app.vault.trash(file, false)));
}
```

---

## Task 3: Add `appendTags()` batch method

**File:** `packages/plugin/index.ts`

**Where:** After the existing `appendTag` method (around line 1546). The `appendTag` method is at approximately lines 1509-1546.

**Add this new method immediately after `appendTag`:**

```typescript
async appendTags(file: TFile, tags: string[]) {
  if (!tags?.length) return;

  const fileContent = await this.app.vault.read(file);
  const metadata = this.app.metadataCache.getFileCache(file);

  const newTags = tags
    .map(sanitizeTag)
    .filter((tag) => {
      const bare = tag.replace("#", "");
      const hasFrontmatter = metadata?.frontmatter?.tags?.includes(bare);
      const hasInline = fileContent.includes(tag);
      return !hasFrontmatter && !hasInline;
    });

  if (!newTags.length) return;

  if (this.settings.useSimilarTagsInFrontmatter) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.tags = fm.tags || [];
      for (const tag of newTags) {
        fm.tags.push(tag.replace("#", ""));
      }
    });
  } else {
    const prefix = fileContent.includes("#") ? "\n" : "\n\n";
    await this.app.vault.append(file, prefix + newTags.join("\n"));
  }
}
```

**Why:** The existing `appendTag` does a full `vault.read()` + `vault.modify/append()` PER TAG. With 3 tags, that's 6 I/O operations. This batch version does 1 read + 1 write total.

**Important:** Make sure `sanitizeTag` is imported/available in scope — check the existing `appendTag` method to see how it's used. It should already be in scope since `appendTag` uses it.

---

## Task 4: Add `safeExecuteStep` wrapper

**File:** `packages/plugin/inbox/index.ts`

**Where:** Immediately after the `executeStep` function (which ends around line 1158).

**Add:**

```typescript
async function safeExecuteStep(
  context: ProcessingContext,
  step: (context: ProcessingContext) => Promise<ProcessingContext>,
  action: Action,
  errorAction: Action
): Promise<ProcessingContext> {
  try {
    return await executeStep(context, step, action, errorAction);
  } catch (error) {
    logger.warn(`Optional step ${action} failed, continuing pipeline: ${error.message}`);
    return context;
  }
}
```

**What this does:** Wraps `executeStep` but catches errors instead of re-throwing. The error is still logged by `executeStep` internally (it records in recordManager before throwing), so we just catch the re-throw and continue.

**DO NOT modify `executeStep` itself** — it's used for critical steps that MUST fail the pipeline (validate, extract, etc.).

---

## Task 5: Task-specific content cutoffs

**File:** `packages/plugin/index.ts`

**Step 1:** Add constants near the top of the file (after imports):

```typescript
const CONTENT_CUTOFFS = {
  CLASSIFY: 2000,
  FOLDER: 2500,
  TAGS: 3000,
  NAME: 1500,
} as const;
```

**Step 2:** Find each API method and apply the appropriate cutoff. Search for methods like:
- `classifyContent` or `classifyContentV2` — use `CONTENT_CUTOFFS.CLASSIFY`
- `recommendTags` — use `CONTENT_CUTOFFS.TAGS`
- `recommendFolders` or `getAIClassifiedFolderPath` — use `CONTENT_CUTOFFS.FOLDER`
- `generateNameFromContent` or similar naming method — use `CONTENT_CUTOFFS.NAME`

In each method, find where `content` is passed to the API call and add:
```typescript
const trimmedContent = content.slice(0, CONTENT_CUTOFFS.CLASSIFY);
```
Then use `trimmedContent` in the API call instead of `content`.

**Important:**
- If a method already trims content (e.g., uses `this.settings.contentCutoffChars`), replace that with the task-specific constant
- Do NOT add cutoffs to formatting methods — those need the full content
- READ each method carefully before modifying — some may already handle this correctly

---

## Task 6: Progress counters on filtering handlers

### 6a: `date-range-handler.tsx`

**Add state for progress tracking.** Find the existing `useState` imports and add:

```typescript
const [progress, setProgress] = useState({ done: 0, total: 0 });
```

**In the filtering `useEffect`**, before the file loop starts:
```typescript
const allFiles = app.vault.getMarkdownFiles();
setProgress({ done: 0, total: allFiles.length });
```

After each file is processed inside the loop:
```typescript
setProgress(prev => ({ ...prev, done: prev.done + 1 }));
```

**Update the JSX** — find the status text that says `"Filtering notes by date range..."` and replace with:
```tsx
{`Filtering notes by date range... ${progress.total > 0 ? `(${progress.done}/${progress.total})` : ""}`}
```

**Important:** Make sure `useState` is imported from `react`. Check existing imports.

### 6b: `last-modified-handler.tsx`

Apply the exact same pattern:
1. Add `progress` state
2. Set total before loop, increment done inside loop
3. Update JSX from `"Fetching last modified files..."` to include progress

---

## Task 7: Rewire pipeline — batch tags, parallel APIs, resilience

**File:** `packages/plugin/inbox/index.ts`

**This task depends on Tasks 3, 4 being complete.**

### 7a: Update `recommendTagsStep` to use batch tagging

Find `recommendTagsStep` (around line 822). Replace the sequential tag loop:

```typescript
// FROM (lines 840-843):
  if (context.tags && context.containerFile) {
    for (const tag of context.tags) {
      await context.plugin.appendTag(context.containerFile, tag);
    }
  }
```

```typescript
// TO:
  if (context.tags && context.containerFile) {
    await context.plugin.appendTags(context.containerFile, context.tags);
  }
```

### 7b: Apply pipeline resilience + parallel API calls

Find the pipeline in `processInboxFile` (around lines 331-424). Replace the step sequence:

```typescript
    try {
      // Critical steps — must succeed
      await executeStep(context, startProcessing, Action.CLEANUP, Action.ERROR_CLEANUP);
      await executeStep(context, hasValidFileStep, Action.VALIDATE, Action.ERROR_VALIDATE);
      await executeStep(context, getContainerFileStep, Action.CONTAINER, Action.ERROR_CONTAINER);
      await executeStep(context, moveAttachmentFile, Action.MOVING_ATTACHMENT, Action.ERROR_MOVING_ATTACHMENT);
      await executeStep(context, getContentStep, Action.EXTRACT, Action.ERROR_EXTRACT);
      await executeStep(context, cleanupStep, Action.CLEANUP, Action.ERROR_CLEANUP);

      if (await shouldProcessYouTube(context)) {
        await safeExecuteStep(context, fetchYouTubeTranscriptStep, Action.FETCH_YOUTUBE, Action.ERROR_FETCH_YOUTUBE);
      }

      // Independent API calls — run concurrently
      await Promise.all([
        safeExecuteStep(context, recommendClassificationStep, Action.CLASSIFY, Action.ERROR_CLASSIFY),
        safeExecuteStep(context, recommendFolderStep, Action.MOVING, Action.ERROR_MOVING),
        safeExecuteStep(context, recommendNameStep, Action.RENAME, Action.ERROR_RENAME),
      ]);

      // These depend on results above or are local operations
      await safeExecuteStep(context, formatContentStep, Action.FORMATTING, Action.ERROR_FORMATTING);
      await executeStep(context, appendAttachmentStep, Action.APPEND, Action.ERROR_APPEND);
      await safeExecuteStep(context, recommendTagsStep, Action.TAGGING, Action.ERROR_TAGGING);
      await executeStep(context, completeProcessing, Action.COMPLETED, Action.ERROR_COMPLETE);
    } catch (error) {
      await handleError(error, context);
      logger.error("Error processing inbox file:", error);
    }
```

**What changed:**
1. Critical early steps (cleanup, validate, container, extract) still use `executeStep` — failure here means we can't proceed at all
2. YouTube step uses `safeExecuteStep` — failure shouldn't kill the pipeline
3. **classify + folder + rename now run in `Promise.all`** — these three are independent API calls that write to separate context fields (`context.classification`, `context.destinationFolder`, `context.newName`)
4. Format, tags use `safeExecuteStep` — optional, continue on error
5. Append attachment and complete processing still use `executeStep` — these are local operations that should always work

**Safety note on Promise.all:** All three steps read `context.content` (read-only) and write to different fields. No shared mutable state conflicts.

---

## Task 8: Commit

```bash
cd /home/tanner/Projects/.note-companion-plugin
pwd  # Verify: /home/tanner/Projects/.note-companion-plugin
git branch --show-current  # Verify: feat/pipeline-improvements

git add -A
git commit -m "feat: optimize auto-sort pipeline + parallelize bulk ops

- Fix stale inbox path: read settings.pathToWatch fresh per event
- Reduce event handler delay from 1000ms to 100ms
- Add safeExecuteStep: optional pipeline steps continue on error
- Parallelize classify/folder/rename API calls (1-2s faster per file)
- Add appendTags() batch method: single read/write instead of per-tag
- Parallelize bulk file operations in 4 tool handlers
- Add progress counters to date-range and last-modified filters
- Add task-specific content cutoffs for token savings"
```

---

## Verification Checklist (before claiming done)

- [ ] `pwd` shows `/home/tanner/Projects/.note-companion-plugin`
- [ ] `git branch --show-current` shows `feat/pipeline-improvements`
- [ ] `eventHandlers.ts` reads `plugin.settings.pathToWatch` inside each handler (not captured once)
- [ ] `eventHandlers.ts` has `setTimeout(resolve, 100)` not `1000`
- [ ] `inbox/index.ts` has `safeExecuteStep` function defined
- [ ] `inbox/index.ts` pipeline uses `safeExecuteStep` for classify/folder/rename/format/tags
- [ ] `inbox/index.ts` pipeline has `Promise.all` for classify + folder + rename
- [ ] `inbox/index.ts` `recommendTagsStep` calls `appendTags` (not `appendTag` in a loop)
- [ ] `index.ts` has `appendTags` batch method
- [ ] `index.ts` has `CONTENT_CUTOFFS` constants
- [ ] `bulk-find-replace-handler.tsx` uses `Promise.all` instead of sequential `for`
- [ ] `move-files-handler.tsx` uses `Promise.all` instead of sequential `for`
- [ ] `rename-files-handler.tsx` uses `Promise.all` instead of sequential `for`
- [ ] `merge-files-handler.tsx` uses `Promise.all` for reads and deletes
- [ ] `move-files-handler.tsx` folder creation `.catch` logs real errors (not empty `() => {}`)
- [ ] `date-range-handler.tsx` shows `(done/total)` progress
- [ ] `last-modified-handler.tsx` shows `(done/total)` progress
- [ ] `grep -r "for (const tag of context.tags)" packages/plugin/inbox/` returns 0 results
- [ ] All changes committed on correct branch
