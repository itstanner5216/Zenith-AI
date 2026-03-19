# Plan A — API Route & Tool Cleanup

> **Worktree:** `/home/tanner/Projects/Zenith-AI/.worktrees/backend-api-cleanup`
> **Branch:** `backend/api-route-cleanup`
> **Executor:** Copilot CLI
> **Base commit:** `2032a142`

**Goal:** Remove 11 dead tool definitions, strip deepSearch + web_search_preview, remove `incrementAndLogTokenUsage` from all 14 route files + delete the file, strip R2/S3 from processing routes, remove formatDocumentContent + format route, fix dead code, rewire sync route auth, and fix plugin vertex-brain-client streaming.

**CRITICAL RULE:** "Remove" = fully and completely remove. Zero remnants. Every import, call, reference, type, test mock.

**CRITICAL: FILE OWNERSHIP** — This plan ONLY touches the files listed below. Do NOT modify any file not on this list. The other agent (Plan B) owns all other files. Modifying shared files will cause merge conflicts.

**Build command:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-api-cleanup/packages/web && pnpm ts:check`
**Test command:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-api-cleanup/packages/web && pnpm test`
**Plugin build:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-api-cleanup/packages/plugin && pnpm build`

---

## Files Owned By This Plan (EXCLUSIVE — no other agent touches these)

### Modified (23 files):
1. `packages/web/app/api/(newai)/chat/tools.ts`
2. `packages/web/lib/prompts/chat-prompt.ts`
3. `packages/web/app/api/(newai)/chat/route.ts`
4. `packages/web/app/api/(newai)/chat/route.test.ts`
5. `packages/web/__mocks__/@ai-sdk/openai.ts`
6. `packages/web/app/api/(newai)/modify/route.ts`
7. `packages/web/app/api/(newai)/title/v2/route.ts`
8. `packages/web/app/api/(newai)/format-stream/route.ts`
9. `packages/web/app/api/(newai)/enhance-meeting-note/route.ts`
10. `packages/web/app/api/(newai)/tags/v2/route.ts`
11. `packages/web/app/api/(newai)/concepts-and-chunks/route.ts`
12. `packages/web/app/api/(newai)/folders/v2/route.ts`
13. `packages/web/app/api/(newai)/folders/route.ts`
14. `packages/web/app/api/(newai)/vision/route.ts`
15. `packages/web/app/api/(newai)/classify1/route.ts`
16. `packages/web/app/api/process-pending-uploads/route.ts`
17. `packages/web/app/api/process-file/route.ts`
18. `packages/web/app/api/(newai)/aiService.ts`
19. `packages/web/app/api/(sync)/files/route.ts`
20. `packages/web/app/api/(sync)/file-status/route.ts`
21. `packages/web/app/api/(sync)/files/[id]/route.ts`
22. `packages/web/app/api/files/upload/route.ts`
23. `packages/plugin/services/vertex-brain-client.ts`

### Deleted (4 files/dirs):
24. `packages/web/app/api/(newai)/format/` (entire directory)
25. `packages/web/lib/incrementAndLogTokenUsage.ts`
26. `packages/web/lib/incrementAndLogTokenUsage.test.ts`
27. `packages/web/__mocks__/@/lib/incrementAndLogTokenUsage.ts`

---

## Task 1: Remove 11 Tool Definitions from tools.ts

**File:** `packages/web/app/api/(newai)/chat/tools.ts`

Remove these tool definition blocks from the `chatTools` object. Work BOTTOM-UP to avoid line shift issues:

| # | Tool Key | Approx Lines | Action |
|---|----------|-------------|--------|
| 1 | `exportToFormat` | 515-529 | REMOVE |
| 2 | `createTemplate` | 470-492 | REMOVE |
| 3 | `extractHighlights` | 358-381 | REMOVE |
| 4 | `findBrokenLinks` | 329-356 | REMOVE |
| 5 | `getOutgoingLinks` | 274-288 | REMOVE |
| 6 | `getBacklinks` | 263-272 | REMOVE |
| 7 | `updateFrontmatter` | 220-239 | REMOVE |
| 8 | `executeActionsOnFileBasedOnPrompt` | 183-194 | REMOVE |
| 9 | `analyzeVaultStructure` | 108-121 | REMOVE |
| 10 | `appendContentToFile` | 55-71 | REMOVE |

**KEEP these (they have active plugin handlers):**
- `renameFiles` (lines 154-182) — plugin has `rename-files-handler.tsx`
- `mergeFiles` (lines 443-468) — plugin has `merge-files-handler.tsx`

**After removal, verify 17 tools remain:**
`getSearchQuery`, `searchByName`, `openFile`, `getLastModifiedFiles`, `addTextToDocument`, `modifyDocumentText`, `generateSettings`, `moveFiles`, `renameFiles`, `getFileMetadata`, `addTags`, `getHeadings`, `getTaggedFiles`, `createNewFiles`, `deleteFiles`, `mergeFiles`, `bulkFindReplace`

**Verify:** `grep -c "appendContentToFile\|analyzeVaultStructure\|executeActionsOnFileBasedOnPrompt\|updateFrontmatter\|getBacklinks\|getOutgoingLinks\|findBrokenLinks\|extractHighlights\|createTemplate\|exportToFormat" packages/web/app/api/\(newai\)/chat/tools.ts` → 0

---

## Task 2: Clean System Prompt References

**File:** `packages/web/lib/prompts/chat-prompt.ts`

1. **Line ~61:** Change:
   ```
   Do NOT use `getSearchQuery` or `extractHighlights` for tag-based lookups.
   ```
   To:
   ```
   Do NOT use `getSearchQuery` for tag-based lookups.
   ```

2. **Line ~180:** Change:
   ```
   …or `appendContentToFile` if the user asked to merge into an existing file.
   ```
   To:
   ```
   …or `addTextToDocument` if the user asked to merge into an existing file.
   ```

**Verify:** `grep -n "appendContentToFile\|extractHighlights" packages/web/lib/prompts/chat-prompt.ts` → 0

---

## Task 3: Remove deepSearch + web_search_preview from Chat Route

**File:** `packages/web/app/api/(newai)/chat/route.ts`

4 changes:

1. **Line 100:** Remove `deepSearch = false,` from request body destructuring. Keep `enableSearchGrounding = false,`

2. **Line 403:** Change:
   ```typescript
   const shouldUseSearch = enableSearchGrounding || deepSearch;
   ```
   To:
   ```typescript
   const shouldUseSearch = enableSearchGrounding;
   ```

3. **Line 504:** Change:
   ```typescript
   console.log(`Search grounding enabled (deep: ${deepSearch})`);
   ```
   To:
   ```typescript
   console.log('Search grounding enabled');
   ```

4. **Lines 589-594:** In the search-path `streamText` call, remove `web_search_preview` from tools:
   ```typescript
   // BEFORE:
   tools: {
     ...chatTools,
     web_search_preview: openai.tools.webSearchPreview({
       searchContextSize: deepSearch ? 'high' : 'medium',
     }) as any,
   } as any,
   
   // AFTER:
   tools: {
     ...chatTools,
   } as any,
   ```

5. **Check `openai` import (line 12):** `import { openai } from '@ai-sdk/openai';` — search the file for other uses of `openai` (e.g. `openai(...)` for model construction). If ONLY used for `web_search_preview`, remove the import. If used elsewhere, keep it.

**ALSO in this file — remove incrementAndLogTokenUsage:**

6. **Line 10:** Remove `import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';`

7. **Line ~617 (search path onFinish):** Remove:
   ```typescript
   await incrementAndLogTokenUsage(userId, usage.totalTokens);
   ```
   Keep the rest of onFinish (citations, dataStream.writeData).

8. **Line ~834 (non-search path onFinish):** Remove:
   ```typescript
   await incrementAndLogTokenUsage(userId, usage.totalTokens);
   ```
   Keep citations and dataStream.writeData.

**Verify:** `grep -n "deepSearch\|web_search_preview\|incrementAndLogTokenUsage" packages/web/app/api/\(newai\)/chat/route.ts` → 0

---

## Task 4: Update Chat Route Tests & OpenAI Mock

**File:** `packages/web/app/api/(newai)/chat/route.test.ts`
- Remove any test params with `deepSearch`
- Remove any assertions about `web_search_preview` tool
- Remove any `incrementAndLogTokenUsage` mock setup or assertions

**File:** `packages/web/__mocks__/@ai-sdk/openai.ts`
- Remove the `webSearchPreview` function from the mock's `tools` object
- Remove `type: 'web_search_preview'` from mock responses (line ~26)

**Verify:** `pnpm test -- --testPathPattern="chat/route"` → PASS

---

## Task 5: Remove incrementAndLogTokenUsage from 11 Route Files

For EACH of these 11 files, do exactly two things:
1. Remove the import: `import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';`
2. Remove all `await incrementAndLogTokenUsage(userId, ...)` calls (keep the rest of any onFinish callback)

| # | File | Import | Call(s) |
|---|------|--------|---------|
| 1 | `app/api/(newai)/modify/route.ts` | find & remove | ~line 46 |
| 2 | `app/api/(newai)/title/v2/route.ts` | find & remove | ~line 65 |
| 3 | `app/api/(newai)/format-stream/route.ts` | find & remove | ~line 46 |
| 4 | `app/api/(newai)/enhance-meeting-note/route.ts` | find & remove | ~line 105 |
| 5 | `app/api/(newai)/tags/v2/route.ts` | find & remove | ~line 68 |
| 6 | `app/api/(newai)/concepts-and-chunks/route.ts` | find & remove | ~line 54 |
| 7 | `app/api/(newai)/folders/v2/route.ts` | find & remove | ~line 40 |
| 8 | `app/api/(newai)/folders/route.ts` | find & remove | ~line 39 |
| 9 | `app/api/(newai)/vision/route.ts` | find & remove | ~line 36 |
| 10 | `app/api/(newai)/classify1/route.ts` | find & remove | ~line 30 |
| 11 | `app/api/process-pending-uploads/route.ts` | find & remove | ~line 560 |
| 12 | `app/api/process-file/route.ts` | find & remove | ~line 268 |

**Note:** process-pending-uploads and process-file are also modified in Tasks 7-8 (R2 removal). Handle incrementAndLogTokenUsage removal as part of those tasks.

**Verify:** `grep -rn "incrementAndLogTokenUsage" packages/web/app/api/ --include="*.ts" | grep -v node_modules | grep -v format/route` → 0 (format/route is deleted in Task 6)

---

## Task 6: Delete incrementAndLogTokenUsage Files

**Delete these files:**
```bash
rm packages/web/lib/incrementAndLogTokenUsage.ts
rm -f packages/web/lib/incrementAndLogTokenUsage.test.ts
rm -f packages/web/__mocks__/@/lib/incrementAndLogTokenUsage.ts
```

**Also delete format route (which imports incrementAndLogTokenUsage):**
```bash
rm -rf packages/web/app/api/\(newai\)/format/
```

**Verify:** The files no longer exist, and no remaining files import from them.

---

## Task 7: Remove formatDocumentContent + Fix aiService Dead Code

**File:** `packages/web/app/api/(newai)/aiService.ts`

1. **Remove `formatDocumentContent` function** (lines 290-321):
   Delete the entire function. Check for `streamObject` import — if only used by formatDocumentContent, remove the import too.

2. **Fix `extractTextFromImage` dead switch** (lines 234-253):
   The `case "gpt-4o"` and `default` blocks are identical. Replace the entire switch with:
   ```typescript
   const response = await generateText({
     model,
     //@ts-ignore
     messages,
   });
   return response.text.trim() + "\n\n";
   ```
   Remove the `getModelId(model)` call on line ~216 if `getModelId` is only used for this switch. Check other usages first.

**Verify:** `grep -n "formatDocumentContent" packages/web/app/api/\(newai\)/aiService.ts` → 0

---

## Task 8: Strip R2 from process-pending-uploads/route.ts

**File:** `packages/web/app/api/process-pending-uploads/route.ts`

This file currently:
- Imports `@aws-sdk/client-s3` (S3Client, GetObjectCommand, etc.)
- Constructs an S3 client with R2 env vars
- Downloads files from R2 for OCR processing
- Uses `CRON_SECRET` for auth
- Calls `incrementAndLogTokenUsage` (handled in Task 5)

**Changes:**
1. Remove ALL `@aws-sdk` imports
2. Remove S3 client construction (R2_BUCKET, R2_ENDPOINT, etc.)
3. Remove R2 download logic — replace with local file reads using `fs` and `UPLOAD_DIR` or `blobUrl` field from database as local path
4. Replace `CRON_SECRET` bearer auth check with `handleAuthorizationV2`:
   ```typescript
   import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
   // In handler:
   const { userId } = await handleAuthorizationV2(request);
   ```
5. Keep all OCR processing logic intact — just change the file source from R2 to local

**Important:** The `uploadedFiles` table has a `blobUrl` field that stores the file URL. After R2 removal, this should be treated as a local file path or the file should be read from `UPLOAD_DIR`.

---

## Task 9: Strip R2 from process-file/route.ts

**File:** `packages/web/app/api/process-file/route.ts`

Similar to Task 8:
1. Remove `@aws-sdk` imports
2. Remove S3 client / R2 download logic
3. Use local file reads instead
4. Keep OCR processing logic

---

## Task 10: Rewire Sync Route Auth + Fix Endpoints

### 10a: Remove unused import from (sync)/files/route.ts
**File:** `packages/web/app/api/(sync)/files/route.ts`
- Remove line 8: `import { request } from 'http';` (unused)
- Verify the file already uses `handleAuthorizationV2` — if it uses Clerk `auth()`, replace with handleAuthorizationV2

### 10b: Fix (sync)/file-status/route.ts
**File:** `packages/web/app/api/(sync)/file-status/route.ts`
- Remove `import { auth } from '@clerk/nextjs/server';`
- Add `import { handleAuthorizationV2 } from '@/lib/handleAuthorization';`
- Replace `const { userId } = await auth();` with `const { userId } = await handleAuthorizationV2(request);`
- **Remove hardcoded "mobile-user" fallback** (line ~56)
- Remove ALL paid features / wording / requirements

### 10c: Fix (sync)/files/[id]/route.ts
**File:** `packages/web/app/api/(sync)/files/[id]/route.ts`
- Remove `import { auth } from '@clerk/nextjs/server';`
- Add `import { handleAuthorizationV2 } from '@/lib/handleAuthorization';`
- Replace `const { userId } = await auth();` with `const { userId } = await handleAuthorizationV2(request);`
- **Remove unvalidated mobile token acceptance path** (lines ~29-30)

### 10d: Add auth to files/upload/route.ts
**File:** `packages/web/app/api/files/upload/route.ts`
- Add `import { handleAuthorizationV2 } from '@/lib/handleAuthorization';`
- Add auth check at start of handler:
  ```typescript
  const { userId } = await handleAuthorizationV2(request);
  ```

**Verify for all 4 files:** `grep -rn "@clerk\|auth()\|mobile-user\|import.*http" packages/web/app/api/\(sync\)/ packages/web/app/api/files/ --include="*.ts" | grep -v node_modules` → 0

---

## Task 11: Fix Plugin vertex-brain-client.ts

**File:** `packages/plugin/services/vertex-brain-client.ts`

**Problem:** `answer()` calls `POST /api/chat` and parses response as JSON with `data.choices?.[0]?.message?.content` (OpenAI format). But `/api/chat` returns AI SDK streaming response (SSE). Will always return `""`.

**Replace the `answer` method** with a streaming response parser:

```typescript
async answer(context: string): Promise<{ answer: string }> {
  try {
    const response = await fetch(`${plugin.getServerUrl()}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(plugin.getApiKey()
          ? { Authorization: `Bearer ${plugin.getApiKey()}` }
          : {}),
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: context }],
        model: plugin.settings.selectedModel,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        // AI SDK v4 UI message stream: "0:" prefix = text part
        if (line.startsWith("0:")) {
          try {
            const text = JSON.parse(line.slice(2));
            if (typeof text === "string") {
              fullText += text;
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      }
    }

    return { answer: fullText };
  } catch (error) {
    console.error("[VertexBrainClient] answer failed:", error);
    return { answer: "" };
  }
},
```

**Build:** `cd packages/plugin && pnpm build` → PASS

---

## Task 12: Build & Commit

1. **Type check:** `cd packages/web && pnpm ts:check`
2. **Run tests:** `cd packages/web && pnpm test`
3. **Plugin build:** `cd packages/plugin && pnpm build`
4. **Zero-remnant audit:**
   ```bash
   cd packages/web
   grep -rn "appendContentToFile\|analyzeVaultStructure\|executeActionsOnFileBasedOnPrompt\|updateFrontmatter\|getBacklinks\|getOutgoingLinks\|findBrokenLinks\|extractHighlights\|createTemplate\|exportToFormat" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   grep -rn "deepSearch\|web_search_preview\|webSearchPreview" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   grep -rn "incrementAndLogTokenUsage" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   grep -rn "formatDocumentContent" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   grep -rn "@aws-sdk\|R2_BUCKET\|R2_ENDPOINT\|CRON_SECRET" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   ```
   Expected: ALL return 0 matches

5. **Commit:**
   ```bash
   git add -A
   git commit -m "chore(web): remove dead tools, deepSearch, token tracking from routes, R2 from processing, fix dead code

   - Remove 11 dead tool definitions from tools.ts
   - Clean system prompt references in chat-prompt.ts
   - Remove deepSearch parameter and web_search_preview OpenAI tool
   - Remove incrementAndLogTokenUsage from all 14 route files
   - Delete incrementAndLogTokenUsage.ts + test + mock
   - Delete format route (formatDocumentContent fully removed)
   - Fix extractTextFromImage dead switch in aiService.ts
   - Strip R2/S3 from process-pending-uploads and process-file routes
   - Rewire sync route auth from Clerk to handleAuthorizationV2
   - Fix /api/file-status mobile-user hardcode
   - Fix /api/files/:id mobile token bypass
   - Add auth to /api/files/upload
   - Fix plugin vertex-brain-client streaming response parsing"
   ```

---

## Build Compatibility Note

This worktree's changes are self-consistent. The only external dependency is `handleAuthorizationV2` from `@/lib/handleAuthorization` — this function already exists in the codebase (Plan B rewrites it but the signature `(req: NextRequest) => Promise<{ userId: string }>` stays the same). This branch builds independently.
