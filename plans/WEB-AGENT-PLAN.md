# Web Agent — Vision Model Routing & Server-Side Fixes

## 🚨 WORKTREE SAFETY — READ THIS FIRST

**YOU MUST VERIFY YOUR WORKTREE BEFORE EVERY COMMIT.**

Parallel agents are running simultaneously in separate worktrees. Crossing into another agent's worktree WILL contaminate branches and cause hours of cleanup. **This MUST NOT happen.**

**Your worktree:** `/home/tanner/Projects/.note-companion-web`
**Your branch:** `feat/vision-model-routing`

**Before EVERY commit, run:**
```bash
pwd  # Must show /home/tanner/Projects/.note-companion-web
git branch --show-current  # Must show feat/vision-model-routing
```

**If you dispatch subagents**, you MUST include this in every subagent prompt:
> "CRITICAL: You are working in /home/tanner/Projects/.note-companion-web on branch feat/vision-model-routing. Before ANY git operation, verify with `pwd` and `git branch --show-current`. Do NOT touch any other worktree or branch."

**Other agent worktree (DO NOT TOUCH):**
- Plugin Agent: `/home/tanner/Projects/.note-companion-plugin` → `feat/pipeline-improvements`
- Main repo: `/home/tanner/Projects/.note-companion` → `master`

---

## 🚨 OWNERSHIP RULE — READ THIS FIRST

**You own ONLY `packages/web/` files.** The Plugin Agent owns `packages/plugin/`. Do NOT edit any file under `packages/plugin/`. If you find a bug there, note it in your commit message so the other agent can address it.

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
5. **`verification-before-completion`** — Verify every file exists, every import resolves, types check. Only THEN report complete.

---

## Context

**What this project is:** Note Companion — an Obsidian plugin + Next.js web backend for automatic file organization. Users drop files in an inbox → AI classifies, tags, renames, and moves them.

**What we're doing:** Adding a dedicated vision model (`VISION_MODEL_NAME` env var) so image processing uses a different model than text processing. All models run through a LiteLLM proxy at `OPENAI_API_BASE`. Also fixing server-side bugs: LiteLLM bypass, race condition, duplicate code.

**Tech stack:** TypeScript, Next.js App Router, Vercel AI SDK, Drizzle ORM, `@ai-sdk/openai`

**Critical constraints:**
- NO optional model parameters (temperature, etc.) — user explicitly rejected this
- NO fallback logic — LiteLLM handles fallbacks externally
- NO backward compatibility needed — this is personal use
- The `getModel(_name?: string)` function intentionally ignores its parameter — this is by design

---

## Scope — Files You Own

```
packages/web/lib/models.ts              — Add getVisionModel()
packages/web/lib/vision.ts              — NEW FILE: shared processImageWithVision()
packages/web/app/api/(newai)/vision/route.ts — Switch to getVisionModel()
packages/web/app/api/process-file/route.ts   — Use shared vision.ts, remove duplicate
packages/web/app/api/process-pending-uploads/route.ts — Remove LiteLLM bypass, use shared vision.ts, fix race condition
packages/web/.env.example               — Document VISION_MODEL_NAME
```

---

## Task Execution Order

```
Phase 1 (independent):
  Task 1: Add getVisionModel() to models.ts

Phase 2 (depends on Task 1):
  Task 2: Create shared lib/vision.ts
  Task 3: Update vision/route.ts
  Task 4: Update process-file/route.ts
  Task 5: Fix process-pending-uploads/route.ts (LiteLLM bypass + use shared vision)

Phase 3 (depends on Task 5):
  Task 6: Fix race condition in process-pending-uploads

Phase 4 (final):
  Task 7: Update .env.example and commit
```

---

## Task 1: Add `getVisionModel()` to models.ts

**File:** `packages/web/lib/models.ts`

**Current state:** Has `MODEL_PROVIDER`, `MODEL_NAME`, `RESPONSES_MODEL_NAME` env vars. Has `getModel()` and `getResponsesModel()` exports. No vision model support.

**Changes:**

1. After line 13 (`const RESPONSES_MODEL_NAME = ...`), add:
```typescript
const VISION_MODEL_NAME = process.env.VISION_MODEL_NAME || MODEL_NAME;
```

2. After line 50 (`const DEFAULT_MODEL = createModel(...)`), add:
```typescript
const DEFAULT_VISION_MODEL = createModel(MODEL_PROVIDER, VISION_MODEL_NAME);
```

3. After the `getResponsesModel` export (after line 75), add:
```typescript
/**
 * Get the vision model for image processing (OCR, image analysis)
 * Falls back to default model if VISION_MODEL_NAME not set
 */
export const getVisionModel = (): LanguageModel => {
  return DEFAULT_VISION_MODEL;
};
```

**Verify:** `cd /home/tanner/Projects/.note-companion-web && npx tsc --noEmit packages/web/lib/models.ts 2>&1 | head -20`

---

## Task 2: Create shared `lib/vision.ts`

**File:** `packages/web/lib/vision.ts` (NEW)

**Why:** `processImageWithGPT4one` is duplicated in `process-file/route.ts` (lines 57-99) and `process-pending-uploads/route.ts` (lines 80-117) with slightly different implementations. Extract to one shared module that uses `getVisionModel()`.

**Create:**

```typescript
import { generateObject } from "ai";
import { z } from "zod";
import { getVisionModel } from "./models";

export async function processImageWithVision(
  imageUrl: string
): Promise<{ textContent: string; tokensUsed: number }> {
  try {
    const model = getVisionModel();
    const { object, usage } = await generateObject({
      model: model as any,
      schema: z.object({ markdown: z.string() }),
      messages: [
        {
          role: "system",
          content: "Extract all text comprehensively, preserving formatting.",
        },
        { role: "user", content: [{ type: "image", image: imageUrl }] },
      ],
    });
    const textContent = object.markdown || "";
    const tokensUsed = usage?.totalTokens ?? Math.ceil(textContent.length / 4);
    return { textContent, tokensUsed };
  } catch (error) {
    console.error("Error processing image with vision model:", error);
    return {
      textContent: `Error processing image: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tokensUsed: 0,
    };
  }
}
```

---

## Task 3: Update `vision/route.ts`

**File:** `packages/web/app/api/(newai)/vision/route.ts`

**Changes:**

1. Line 3 — change import:
```typescript
// FROM:
import { getModel } from "@/lib/models";
// TO:
import { getVisionModel } from "@/lib/models";
```

2. Line 13 — change call:
```typescript
// FROM:
const model = getModel();
// TO:
const model = getVisionModel();
```

That's it — 2 line changes.

---

## Task 4: Update `process-file/route.ts`

**File:** `packages/web/app/api/process-file/route.ts`

**Changes:**

1. Delete the entire `processImageWithGPT4one` function (lines 56-99 — the comment + function)

2. Remove the now-unused import if `createOpenAI` was only used by the deleted function:
```typescript
// Line 7 — remove if unused:
import { createOpenAI } from "@ai-sdk/openai";
```
Check if `createOpenAI` is used elsewhere in the file first. If not, remove it.

3. Add import at the top:
```typescript
import { processImageWithVision } from "@/lib/vision";
```

4. On line 159 (inside `processSingleFileRecord`), replace:
```typescript
const result = await processImageWithGPT4one(fileRecord.blobUrl);
```
With:
```typescript
const result = await processImageWithVision(fileRecord.blobUrl);
```

5. Also check: `generateObject` and `z` imports — if they were only used by the deleted function, remove them too. But they might be used elsewhere in the file, so CHECK FIRST.

---

## Task 5: Fix `process-pending-uploads/route.ts` — LiteLLM bypass + shared vision

**File:** `packages/web/app/api/process-pending-uploads/route.ts`

**This is the biggest fix.** This file creates its own `createOpenAI()` instances (lines 10, 86-89) that bypass the LiteLLM proxy configured in models.ts.

**Changes:**

1. Delete `import { createOpenAI } from '@ai-sdk/openai';` (line 10) — IF it's not used for anything other than the vision function. Check if `processMagicDiagram` or other functions use it. If so, keep it.

2. Delete the duplicate `processImageWithGPT4one` function (lines 80-117)

3. Add import:
```typescript
import { processImageWithVision } from "@/lib/vision";
```

4. Find ALL calls to `processImageWithGPT4one(...)` in the file and replace with `processImageWithVision(...)`

5. **IMPORTANT — `getOpenAIImageClient()` on lines 22-27:** This is for DALL-E image GENERATION, not vision/OCR. **Leave it alone.** It legitimately needs a direct OpenAI client for the images API.

6. **Check `processMagicDiagram`** (line 144+) — it may also use `createOpenAI`. If it does, determine if that's for image generation (keep) or for text/vision (replace with `getModel()`/`getVisionModel()`).

7. **Check `processSingleFileRecord`** — if it has any direct `openai('gpt-4o')` calls for non-vision purposes, replace those with `getModel()`:
```typescript
import { getModel } from "@/lib/models";
```

**Goal:** After this task, the ONLY direct OpenAI client in this file should be `getOpenAIImageClient()` for DALL-E. Everything else goes through models.ts → LiteLLM proxy.

---

## Task 6: Fix race condition in `process-pending-uploads/route.ts`

**File:** `packages/web/app/api/process-pending-uploads/route.ts` (lines 548-565)

**Problem:** Two concurrent cron triggers can both see a file as `status='pending'`, both start processing → duplicate work, double token spend.

**Changes:**

1. First, check imports on line 3. Currently has `import { eq, or } from 'drizzle-orm';`. Add `and`:
```typescript
import { eq, or, and } from 'drizzle-orm';
```

2. Replace the optimistic status update (around lines 555-559):

```typescript
// FROM:
        if (fileRecord.status !== 'processing') {
          await db
            .update(uploadedFiles)
            .set({ status: 'processing', updatedAt: new Date(), error: null })
            .where(eq(uploadedFiles.id, fileId));
          console.log(`Marked file ${fileId} as processing.`);
        }
```

```typescript
// TO:
        if (fileRecord.status !== 'processing') {
          const [claimed] = await db
            .update(uploadedFiles)
            .set({ status: 'processing', updatedAt: new Date(), error: null })
            .where(
              and(
                eq(uploadedFiles.id, fileId),
                eq(uploadedFiles.status, 'pending')
              )
            )
            .returning({ id: uploadedFiles.id });

          if (!claimed) {
            console.log(`File ${fileId} already claimed by another worker, skipping.`);
            continue;
          }
          console.log(`Claimed file ${fileId} for processing.`);
        }
```

**Why this works:** The `WHERE status = 'pending'` makes the UPDATE atomic — only one worker can successfully claim a pending file. The second worker's UPDATE matches 0 rows → `.returning()` gives empty array → skip.

---

## Task 7: Update `.env.example` and commit

**File:** `packages/web/.env.example`

**Changes:** After line 13 (`MISTRAL_API_KEY=...`), add:

```
# Model configuration
MODEL_PROVIDER="openai"        # Provider: openai, google, anthropic, groq, mistral, deepseek
MODEL_NAME="gpt-4o-mini"       # Primary text model name
VISION_MODEL_NAME=""            # Vision model for OCR/image processing (defaults to MODEL_NAME)
```

**Final commit:**

```bash
cd /home/tanner/Projects/.note-companion-web
pwd  # Verify: /home/tanner/Projects/.note-companion-web
git branch --show-current  # Verify: feat/vision-model-routing

git add -A
git commit -m "feat: add vision model routing + fix server-side bugs

- Add VISION_MODEL_NAME env var and getVisionModel() to models.ts
- Extract shared processImageWithVision() to lib/vision.ts (DRY)
- Update vision/route.ts to use getVisionModel()
- Update process-file/route.ts to use shared vision module
- Fix process-pending-uploads: stop bypassing LiteLLM proxy
- Fix race condition: atomic status claim prevents duplicate processing
- Document VISION_MODEL_NAME in .env.example"
```

---

## Verification Checklist (before claiming done)

- [ ] `pwd` shows `/home/tanner/Projects/.note-companion-web`
- [ ] `git branch --show-current` shows `feat/vision-model-routing`
- [ ] `packages/web/lib/models.ts` exports `getVisionModel`
- [ ] `packages/web/lib/vision.ts` exists with `processImageWithVision`
- [ ] `packages/web/app/api/(newai)/vision/route.ts` imports `getVisionModel` (not `getModel`)
- [ ] `packages/web/app/api/process-file/route.ts` has NO `processImageWithGPT4one` function
- [ ] `packages/web/app/api/process-pending-uploads/route.ts` has NO `processImageWithGPT4one` function
- [ ] `packages/web/app/api/process-pending-uploads/route.ts` has NO `createOpenAI` usage for vision/OCR (only for DALL-E if needed)
- [ ] Race condition fix uses `and(eq(id), eq(status, 'pending'))` pattern
- [ ] `grep -r "processImageWithGPT4one" packages/web/` returns 0 results
- [ ] `grep -r "getVisionModel" packages/web/` shows models.ts export + vision.ts + route imports
- [ ] `.env.example` documents VISION_MODEL_NAME
- [ ] All changes committed on correct branch
