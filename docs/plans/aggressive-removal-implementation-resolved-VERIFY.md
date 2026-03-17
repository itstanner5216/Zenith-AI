# Aggressive Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the old monetization, multimedia, and stale assistant behavior branches while preserving only the infrastructure that still fits the new product direction.

**Architecture:** This pass is intentionally subtractive. It removes dead UI, settings, commands, prompt instructions, and server-facing feature assumptions, while leaving dashboard, sync, atomic notes, embeddings auto-sort, Background Scribe, and Cosmic Context scaffolding intact.

**Tech Stack:** Obsidian plugin TypeScript, React, existing web prompt/tool registry, existing plugin settings and assistant views.

---

### Task 1: Freeze Dashboard Into Dormant Infrastructure

**Files:**
- Modify: `packages/plugin/index.ts`
- Modify: `packages/plugin/views/assistant/dashboard/view.tsx`
- Inspect only: `packages/plugin/views/assistant/dashboard/main-dashboard.tsx`
- Inspect only: `packages/plugin/views/assistant/dashboard/onboarding-wizard.tsx`

**Step 1: Stop registering the dashboard as an active product surface**

Remove or gate:
- `registerView(DASHBOARD_VIEW_TYPE, ...)`
- `open-fo2k-dashboard` command

Do not delete dashboard files.

**Step 2: Make the dormant intent explicit**

Add a brief comment in `dashboard/view.tsx` or `index.ts` noting that dashboard infrastructure is intentionally preserved for later planning-workspace reuse, but not exposed in the current product.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "open-fo2k-dashboard|DASHBOARD_VIEW_TYPE" packages/plugin
```

Expected:
- typecheck passes
- dashboard references remain only where intentionally preserved

---

### Task 2: Remove Monetization, Licensing, And Upgrade Product Flows

**Files:**
- Delete: `packages/plugin/views/settings/account-data.tsx`
- Delete: `packages/plugin/views/settings/top-up-credits.tsx`
- Delete: `packages/plugin/views/settings/top-up-minutes.tsx`
- Delete: `packages/plugin/components/upgrade-button.tsx`
- Delete: `packages/plugin/views/assistant/organizer/components/license-validator.tsx`
- Modify: `packages/plugin/views/settings/general-tab.tsx`
- Modify: `packages/plugin/views/settings/main.tsx`
- Modify: `packages/plugin/views/assistant/view.tsx`
- Modify: `packages/plugin/views/assistant/organizer/organizer.tsx`
- Modify: `packages/plugin/views/assistant/synchronizer/sync-tab.tsx`
- Modify: `packages/plugin/views/assistant/organizer/tags.tsx`
- Modify: `packages/plugin/views/assistant/organizer/folders/box.tsx`
- Modify: `packages/plugin/views/assistant/organizer/ai-format/user-templates.tsx`
- Modify: `packages/plugin/index.ts`

**Step 1: Remove license/account/top-up components and imports**

Delete the dedicated monetization components and strip their imports/usages from the settings and assistant UI.

**Step 2: Replace monetization copy with neutral provider/runtime messaging**

Anywhere the UI currently says:
- “upgrade your plan”
- “top up credits”
- “top up minutes”
- “license key”

replace it with neutral messages about:
- missing provider configuration
- request failures
- usage diagnostics only if still relevant

If a surface has no useful non-monetization purpose, remove it entirely instead of rewriting copy.

**Step 3: Remove runtime account/license validation assumptions**

Delete or neutralize:
- `checkCatalystAccess()`
- `isLicenseKeyValid()` if it only supports license gating
- any “premium” fetches that exist only for plan enforcement

Keep only the pieces that are still required for provider connectivity or future diagnostics.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "upgrade your plan|top-up|license key|premium|Catalyst" packages/plugin
```

Expected:
- typecheck passes
- no user-facing monetization strings remain except in deliberate migration notes or comments

---

### Task 3: Remove Media, Audio, Image, Transcription, And YouTube Product Branches

**Files:**
- Delete: `packages/plugin/views/assistant/ai-chat/audio-recorder.tsx`
- Delete: `packages/plugin/views/assistant/organizer/transcript.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Modify: `packages/plugin/views/assistant/organizer/organizer.tsx`
- Modify: `packages/plugin/index.ts`
- Modify: `packages/plugin/inbox/index.ts`
- Modify: `packages/plugin/fileUtils.ts`
- Modify: `packages/plugin/settings.ts`
- Modify: `packages/plugin/views/settings/customization-tab.tsx`
- Modify: `packages/web/lib/prompts/chat-prompt.ts`
- Modify: `packages/web/app/api/(newai)/chat/route.ts`
- Modify: `packages/web/app/api/(newai)/chat/route.test.ts`
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`
- Inspect/remove if present: `packages/plugin/inbox/services/youtube-service*`

**Step 1: Remove media UI entry points**

Delete recorder/transcription components and remove:
- recorder imports
- transcription buttons
- media-specific empty-state copy
- media-specific organizer actions

**Step 2: Remove media processing branches from plugin runtime**

Strip:
- `/api/transcribe` calls
- transcript generation helpers
- audio/image file special cases in inbox content assembly
- image instruction settings

Keep only generic attachment/file handling that still matters for development-vault use.

**Step 3: Remove stale YouTube and multimedia instructions from prompts and tests**

Delete:
- transcript-specific prompt rules
- `getYoutubeVideoId` prompt behavior
- YouTube-specific route plumbing and test expectations

Do not leave “dead lore” in the system prompt after the code path is gone.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "transcrib|audio|youtube|YouTube|imageInstructions|AudioRecorder|Transcript" packages/plugin packages/web
```

Expected:
- typecheck passes
- matches are gone or limited to generic attachment/image rendering that is intentionally retained

---

### Task 4: Hide Sync Until Repurposing, But Keep The Infrastructure

**Files:**
- Modify: `packages/plugin/views/assistant/view.tsx`
- Modify: `packages/plugin/settings.ts`
- Modify: `packages/plugin/views/settings/experiment-tab.tsx`
- Inspect only: `packages/plugin/views/assistant/synchronizer/index.ts`
- Inspect only: `packages/plugin/views/assistant/synchronizer/sync-tab.tsx`

**Step 1: Remove current sync exposure from the main assistant UI**

Hide:
- sync tab button
- sync tab command registration
- `showSyncTab` user setting

Do not delete synchronizer files.

**Step 2: Preserve code for later repurposing**

Leave `sync-tab.tsx` and supporting files intact, with a short comment or implementation note that this transport/import surface is being preserved for later remote artifact intake.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "showSyncTab|open-sync-tab|SyncTab" packages/plugin
```

Expected:
- sync implementation still exists
- normal user-facing assistant UI no longer exposes it

---

### Task 5: Remove Default-Model And Local-LLM Product Framing

**Files:**
- Modify: `packages/plugin/settings.ts`
- Modify: `packages/plugin/views/settings/experiment-tab.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/model-selector.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/components/search-toggle.tsx`
- Modify: `packages/plugin/settings.test.ts`
- Modify: `packages/plugin/__snapshots__/settings.test.ts.snap`

**Step 1: Remove `showLocalLLMInChat` from user-facing settings**

Delete the experimental toggle and its UI copy.

**Step 2: Stop treating one cloud model as the plugin default identity**

Refactor settings/UI so chat no longer assumes:
- a canonical default model
- a cloud-vs-local binary product story

In this removal pass, it is acceptable to leave a minimal “current provider/model selection” placeholder so chat still functions until the full mode runtime lands.

**Step 3: Remove broken search-support assumptions tied to old model names**

Normalize or temporarily simplify search-toggle logic so it does not depend on stale hardcoded model lists that no longer represent the product.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
rg -n "showLocalLLMInChat|selectedModel|gpt-4o-mini|gpt-4o-search-preview|llama3.2" packages/plugin
```

Expected:
- no “local LLM in chat” product framing remains
- any remaining model references are clearly transitional or provider-oriented

---

### Task 6: Final Residue Sweep

**Files:**
- Whole repo residue check only

**Step 1: Search for removed product vocabulary**

Run:
```bash
rg -n "top-up|upgrade your plan|license key|premium|Catalyst|transcrib|YouTube|youtube|showSyncTab|showLocalLLMInChat|imageInstructions" packages/plugin packages/web
```

Classify each match as:
- intentional keep
- must remove now
- deferred because it belongs to a future repurpose plan

**Step 2: Update any stale plan or docs references if needed**

Clean `docs/plans` or `plans` only if they still instruct implementation of removed branches.

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
git commit -m "refactor: remove legacy multimedia and monetization flows"
```
