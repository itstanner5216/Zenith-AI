# Plan B: Core Cleanup & Feature Wiring

> **Worktree:** `/home/tanner/Projects/Zenith-AI/.worktrees/plugin-core-wiring`
> **Branch:** `plugin/core-cleanup-wiring`
> **Baseline:** Build ✅ | Tests 26/26 ✅
> **Build:** `cd packages/plugin && pnpm build`
> **Test:** `cd packages/plugin && pnpm test`

**Scope:** Remove dead legacy code (tabs, stubs, inbox), change self-hosting default, wire PDF extraction into @-mentions, and wire the Background Scribe engine. All work centers on `index.ts`, `view.tsx`, settings UI, and handler files.

**⚠️ SHARED FILE WARNING:** Two files are also touched by Plan A (the other parallel agent). Do NOT modify any lines outside the specified ranges:
- `settings.ts` — You modify line 3 ONLY (change `enableSelfHosting` default). Do NOT touch lines 8-9 (`enableSearchGrounding`, `enableDeepSearch`).
- `tiptap.tsx` — You modify the mention handler area ONLY (~lines 50-80, the `handleMentionCommand` function). Do NOT touch line 6 (SlashCommand import), lines 118-122 (SlashCommand.configure), or lines 198-213 (template loading).

---

## Task B1: Remove Legacy Auxiliary Tabs

**Why:** `sync-tab.tsx`, `context/index.tsx`, and `inbox-logs.tsx` are never imported into the live assistant view. Some depend on missing modules (`vertex-brain-client`, `inbox/`).

### Files to delete:
- `packages/plugin/views/assistant/synchronizer/sync-tab.tsx`
- `packages/plugin/views/assistant/synchronizer/index.ts`
- `packages/plugin/views/assistant/synchronizer/` (entire directory)
- `packages/plugin/views/assistant/context/index.tsx`
- `packages/plugin/views/assistant/context/` (entire directory)
- `packages/plugin/views/assistant/inbox-logs.tsx`
- `packages/plugin/views/assistant/inbox-logs/recent-issues-panel.tsx`
- `packages/plugin/views/assistant/inbox-logs/` (entire directory)

### Files to modify:

**`packages/plugin/styles.css`** — Remove ALL orphaned `.sync-*` CSS rules (lines 2070-2263). These are 38 CSS selectors for the sync-tab component that will be dead after deletion:
- `.sync-tab-container` and all its descendants (lines 2070-2108)
- `.sync-header` (line 2109)
- `.sync-subtitle` (line 2112)
- `.sync-how-to-card` (line 2119)
- `.sync-card-content` (line 2129)
- `.sync-icon-container` (line 2135)
- `.sync-icon` (line 2142)
- `.sync-card-title` (line 2147)
- `.sync-card-description` (line 2156)
- `.sync-steps` (line 2163)
- `.sync-step` (line 2168)
- `.sync-step-number` (line 2174)
- `.sync-step-text` (line 2189)
- `.sync-footer-note` (line 2195)
- `.sync-code` (line 2203)
- `.sync-file-card` (line 2212)
- `.sync-file-card:hover` (line 2221)
- `.sync-file-downloaded` (line 2225)
- `.sync-button`, `.sync-button:hover`, `.sync-button:disabled` (lines 2229-2248)
- `.sync-secondary-button`, `.sync-secondary-button:hover` (lines 2250-2263)

Delete the entire block from `.sync-tab-container` (line 2070) through `.sync-secondary-button:hover` closing brace (line 2263).

### Pre-deletion verification:
```bash
cd /home/tanner/Projects/Zenith-AI/.worktrees/plugin-core-wiring/packages/plugin
grep -rn "from.*synchronizer\|from.*sync-tab\|from.*context/index\|from.*inbox-logs\|SyncTab\|ProjectContextTab\|InboxLogs\|RecentIssuesPanel" --include="*.ts" --include="*.tsx" views/assistant/view.tsx views/assistant/ai-chat/ index.ts handlers/
```
Expected: Zero matches — none of these are imported into live code.

### Execute:
```bash
rm -rf views/assistant/synchronizer/
rm -rf views/assistant/context/
rm views/assistant/inbox-logs.tsx
rm -rf views/assistant/inbox-logs/
# Then edit styles.css to remove lines 2070-2263 (.sync-* rules)
```

### Post-deletion verification:
```bash
grep -rn "sync-tab\|sync-header\|sync-subtitle\|sync-how-to\|sync-card\|sync-icon\|sync-step\|sync-footer\|sync-code\|sync-file\|sync-button\|sync-secondary\|ProjectContextTab\|InboxLogs\|RecentIssuesPanel" --include="*.ts" --include="*.tsx" --include="*.css" packages/plugin/ | grep -v node_modules | grep -v dist
```
Expected: Zero matches.

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "chore(plugin): remove unused legacy tabs (sync, context, inbox-logs) + orphaned CSS"
```

---

## Task B2: Remove `getCurrentFileLinks()` and `moveFile()` stubs

**Why:** Both methods on the `ZenithAI` class have zero callers anywhere in the plugin codebase.

### Files to modify:

**`packages/plugin/index.ts`:**

1. Remove `getCurrentFileLinks()` method (lines 94-98):
```typescript
  async getCurrentFileLinks(file: TFile): Promise<LinkCache[]> {
    await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.links || [];
  }
```

2. Remove `moveFile()` method (lines 104-115):
```typescript
  async moveFile(
    file: TFile,
    humanReadableFileName: string,
    destinationFolder = ""
  ) {
    return await moveFile(
      this.app,
      file,
      humanReadableFileName,
      destinationFolder
    );
  }
```

3. Clean up now-unused imports:
   - Remove `CachedMetadata` and `LinkCache` from the obsidian import (lines 24-25)
   - Remove `moveFile` from the fileUtils import (line 43). Keep `ensureFolderExists` — verify it's still used:
     ```bash
     grep -rn "ensureFolderExists" --include="*.ts" --include="*.tsx" index.ts
     ```
     (It's used in the `ensureFolderExists()` wrapper method on line 100-102)

### Pre-removal verification:
```bash
grep -rn "getCurrentFileLinks\|plugin\.moveFile" --include="*.ts" --include="*.tsx" . | grep -v "index.ts" | grep -v node_modules | grep -v dist
```
Expected: Zero matches.

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "chore(plugin): remove unused getCurrentFileLinks() and moveFile() stubs"
```

---

## Task B3: Clean up Inbox Organizer stubs

**Why:** The inbox system was fully removed previously. Only empty function stubs and comments remain.

### Files to modify:

**`packages/plugin/handlers/commandHandlers.ts`:**

Remove the empty `initializeFileOrganizationCommands` function entirely (lines 17-19):
```typescript
export function initializeFileOrganizationCommands(plugin: ZenithAI) {
  // Inbox commands removed — no more pathToWatch setting
}
```

The file should end up as just:
```typescript
import { WorkspaceLeaf } from "obsidian";
import ZenithAI from "../index";
import { ORGANIZER_VIEW_TYPE, AssistantViewWrapper } from "../views/assistant/view";
import { App } from "obsidian";

export function initializeOrganizer(plugin: ZenithAI) {
  plugin.registerView(
    ORGANIZER_VIEW_TYPE,
    (leaf: WorkspaceLeaf) => new AssistantViewWrapper(leaf, plugin)
  );

  plugin.addRibbonIcon("sparkle", "Zenith-AI", () => {
    plugin.ensureAssistantView();
  });
}
```

**`packages/plugin/handlers/eventHandlers.ts`:**

Update the comment to be forward-looking:
```typescript
import ZenithAI from "..";

export function registerEventHandlers(_plugin: ZenithAI) {
  // Reserved for future workspace event handlers
}
```

**`packages/plugin/index.ts`:**

1. Remove the import of `initializeFileOrganizationCommands` (line 39):
```typescript
import {
  initializeOrganizer,
  initializeFileOrganizationCommands,  // ← DELETE THIS LINE
} from "./handlers/commandHandlers";
```

2. Remove the call in `onload()` (line 147):
```typescript
    initializeFileOrganizationCommands(this);  // ← DELETE THIS LINE
```

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "chore(plugin): clean up empty inbox organizer stubs"
```

---

## Task B4: Make Self-Hosting the Default

**Why:** Self-hosting should be the default mode. Cloud/hosted mode (`app.notecompanion.ai`) stays in codebase but is not exposed in UI.

### Files to modify:

**`packages/plugin/settings.ts`** — Change line 3 ONLY:
```typescript
  // Before:
  enableSelfHosting = false;
  // After:
  enableSelfHosting = true;
```

**`packages/plugin/settings.test.ts`** — Update the test to match new default (line 10):
```typescript
  // Before:
  expect(DEFAULT_SETTINGS.enableSelfHosting).toBe(false);
  // After:
  expect(DEFAULT_SETTINGS.enableSelfHosting).toBe(true);
```
Note: Plan A will also modify this test file (removing search grounding assertions). The changes don't overlap — Plan A removes lines 15-16 and changes the count, Plan B changes line 10's expected value. But if Plan A runs first, line numbers may shift. Use the assertion content to find the right line, not the line number.

**`packages/plugin/index.ts`** — Update `getServerUrl()` comment (lines 58-67):
```typescript
  getServerUrl(): string {
    // Self-hosting is the default mode
    // Cloud mode (app.notecompanion.ai) stays in codebase but is not exposed in UI
    let serverUrl = this.settings.enableSelfHosting
      ? this.settings.selfHostingURL
      : "https://app.notecompanion.ai";

    serverUrl = serverUrl.replace(/\/$/, "");
    logMessage(`Using server URL: ${serverUrl}`);

    return serverUrl;
  }
```

**`packages/plugin/views/settings/advanced-tab.tsx`:**

1. Remove `enableSelfHosting` state (lines 11-13):
```typescript
  const [enableSelfHosting, setEnableSelfHosting] = useState(
    plugin.settings.enableSelfHosting,
  );
```

2. Remove from useEffect sync (line 21):
```typescript
    setEnableSelfHosting(plugin.settings.enableSelfHosting);
```

3. Remove from useEffect deps (line 25):
```typescript
    plugin.settings.enableSelfHosting,
```

4. Remove `handleToggleChange` function (lines 29-36).

5. Replace the Self-Hosting section (lines 59-83) with:
```tsx
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[#0fb6d6]">Server</h3>
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Server URL</div>
            <div className="setting-item-description text-xs text-[#45aaff] opacity-60">
              Your self-hosted Zenith AI backend URL
            </div>
          </div>
          <div className="setting-item-control">
            <input
              type="text"
              placeholder="http://localhost:3010"
              value={selfHostingURL}
              onChange={e => handleURLChange(e.target.value)}
              className="w-full bg-[#0d0b12] text-[#bebebe] text-xs border border-[rgba(14,210,247,0.12)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
            />
          </div>
        </div>
      </div>
```

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "feat(plugin): make self-hosting the default mode, hide cloud toggle"
```

---

## Task B5: Wire in `extractTextFromPDF()`

**Why:** The method exists on `ZenithAI` class (index.ts lines 69-88) but has no callers. Wire it into the @-mention system so PDF files get their text extracted.

### Files to modify:

**`packages/plugin/views/assistant/ai-chat/tiptap.tsx`** — In the `handleMentionCommand` function (~lines 50-80):

First, understand how the mention handler works:
```bash
grep -n -A 40 "handleMentionCommand" packages/plugin/views/assistant/ai-chat/tiptap.tsx | head -50
```

The handler processes file mentions by reading the vault file. Add PDF detection:

When a file mention is processed and the file has `.pdf` extension, use `plugin.extractTextFromPDF(file)` instead of `app.vault.read(file)`.

The exact change depends on how the handler currently reads file content. Look for:
```typescript
const content = await app.vault.read(file);
```
Or:
```typescript
const content = await loadFileContent(file);
```

Replace/augment with:
```typescript
const content = file.extension === 'pdf'
  ? await plugin.extractTextFromPDF(file)
  : await app.vault.read(file);
```

**IMPORTANT:** Only modify the mention handler area (~lines 50-80). Do NOT touch the SlashCommand import (line 6), SlashCommand.configure (lines 118-122), or template loading (lines 198-213) — those are being modified by Plan A.

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "feat(plugin): wire PDF text extraction into @-mention context"
```

---

## Task B6: Wire in Background Scribe Engine

**Why:** The `BackgroundScribe` class exists and works (`services/background-scribe.ts`), but `plugin.backgroundScribe` is never instantiated (always `null`), it imports `./vertex-brain-client` which doesn't exist, and the Scribe tab is a placeholder.

### Step 1: Create the missing `vertex-brain-client.ts`

Create `packages/plugin/services/vertex-brain-client.ts`:

```typescript
import type ZenithAI from "../index";

export interface VaultSearchResult {
  folder_path: string;
  file_path: string;
  content: string;
}

export interface VertexBrainClient {
  vectorSearch(query: string, limit: number): Promise<VaultSearchResult[]>;
  answer(context: string): Promise<{ answer: string }>;
}

export function createBrainClient(plugin: ZenithAI): VertexBrainClient {
  return {
    async vectorSearch(_query: string, _limit: number): Promise<VaultSearchResult[]> {
      // TODO: Wire to actual vector/embedding search when available
      return [];
    },
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

        const data = await response.json();
        return {
          answer: data.choices?.[0]?.message?.content ?? "",
        };
      } catch (error) {
        console.error("[VertexBrainClient] answer failed:", error);
        return { answer: "" };
      }
    },
  };
}
```

### Step 2: Instantiate BackgroundScribe in `index.ts`

In `packages/plugin/index.ts`:

1. Add import:
```typescript
import { createBrainClient } from "./services/vertex-brain-client";
```

2. In `onload()`, after settings are loaded and logger configured, instantiate the scribe:
```typescript
    // Initialize Background Scribe
    const brainClient = createBrainClient(this);
    this.backgroundScribe = new BackgroundScribe(this, brainClient);
```

3. Add `onunload()` method to the class (it doesn't exist yet):
```typescript
  onunload() {
    this.backgroundScribe?.deactivate();
  }
```

### Step 3: Build the real Scribe tab UI

In `packages/plugin/views/assistant/view.tsx`, replace the placeholder Scribe content (lines 40-49):

Current placeholder:
```tsx
      <div
        className={tw(
          "flex-1 min-h-0 w-full flex flex-col items-center justify-center",
          activeTab === "scribe" ? "flex" : "hidden"
        )}
      >
        <div className={tw("text-[#45aaff] text-sm opacity-70")}>
          Background Scribe is active
        </div>
      </div>
```

Replace with a proper Scribe panel that shows:
- Active/inactive status indicator
- Activate/deactivate button
- Buffer count (how many chat turns captured)
- Last TODO generation timestamp

Example:
```tsx
      <div
        className={tw(
          "flex-1 min-h-0 w-full flex flex-col p-4 gap-4",
          activeTab === "scribe" ? "flex" : "hidden"
        )}
      >
        <div className={tw("flex items-center justify-between")}>
          <div className={tw("flex items-center gap-2")}>
            <div className={tw(
              "w-2 h-2 rounded-full",
              plugin.backgroundScribe?.isActiveState
                ? "bg-[#0fb6d6] shadow-[0_0_6px_rgba(14,210,247,0.4)]"
                : "bg-[#45aaff] opacity-40"
            )} />
            <span className={tw("text-sm text-[#bebebe]")}>
              {plugin.backgroundScribe?.isActiveState ? "Scribe Active" : "Scribe Inactive"}
            </span>
          </div>
          <button
            onClick={() => {
              if (plugin.backgroundScribe?.isActiveState) {
                plugin.backgroundScribe.deactivate();
              } else {
                plugin.backgroundScribe?.activate();
              }
            }}
            className={tw(
              "px-3 py-1.5 text-xs rounded-md border transition-all duration-150",
              plugin.backgroundScribe?.isActiveState
                ? "text-[#f4569d] border-[rgba(244,86,157,0.3)] hover:bg-[rgba(244,86,157,0.1)]"
                : "text-[#0fb6d6] border-[rgba(14,210,247,0.15)] hover:bg-[rgba(14,210,247,0.08)]"
            )}
          >
            {plugin.backgroundScribe?.isActiveState ? "Deactivate" : "Activate"}
          </button>
        </div>
        <div className={tw("text-xs text-[#45aaff] opacity-60")}>
          The Background Scribe listens to your chat conversations and automatically generates TODO documents when a conversation ends.
        </div>
      </div>
```

Note: The Scribe tab activation in `AssistantContent` (lines 119-123) already calls `plugin.backgroundScribe.activate()` when the tab is selected. This should be updated to match the new UI — the tab should show the panel, but activation should be manual via the button.

Update lines 119-123:
```typescript
  // Before:
  React.useEffect(() => {
    if (activeTab === "scribe" && plugin.backgroundScribe) {
      plugin.backgroundScribe.activate();
    }
  }, [activeTab, plugin]);
  
  // After: Remove auto-activation. The Scribe tab just shows the panel.
  // Activation is controlled by the button in the Scribe tab UI.
```

### Step 4: Add conversation-ended signal

In `packages/plugin/views/assistant/ai-chat/chat.tsx`, find the `handleNewChat` function. Add a workspace event trigger when a new chat is started (signals that the previous conversation has ended):

```typescript
// At the end of handleNewChat:
plugin.app.workspace.trigger("zenith-ai:conversation-ended" as any, {
  sessionId: activeChatId,
});
```

Then in `packages/plugin/services/background-scribe.ts`, listen for this event in `activate()`:
```typescript
  activate(): boolean {
    if (this.isActive) return true;
    this.isActive = true;
    this.plugin.app.workspace.on(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn,
    );
    // Also listen for conversation-ended to trigger immediate synthesis
    this.plugin.app.workspace.on(
      "zenith-ai:conversation-ended" as any,
      this.handleConversationEnded,
    );
    // ... rest
  }
```

Add the handler:
```typescript
  private handleConversationEnded = async () => {
    if (!this.isActive || this.buffer.length === 0) return;
    // Cancel any pending debounce and synthesize immediately
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.synthesizeTODO();
  };
```

And clean up in `deactivate()`:
```typescript
  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.plugin.app.workspace.off(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn,
    );
    this.plugin.app.workspace.off(
      "zenith-ai:conversation-ended" as any,
      this.handleConversationEnded,
    );
    // ... rest
  }
```

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "feat(plugin): wire in Background Scribe with conversation-ended signal"
```

---

## Execution Order

```
Task B1 (legacy tabs)     ─┐  Independent deletions
Task B2 (stubs)           ─┤  Both modify index.ts, do sequentially
Task B3 (inbox stubs)     ─┘

Task B4 (self-hosting)    ─── Modifies settings.ts + advanced-tab.tsx

Task B5 (PDF extraction)  ─── Modifies tiptap.tsx (mention handler only)

Task B6 (background scribe) ── Modifies index.ts + view.tsx + creates new file + background-scribe.ts
```

Recommended order: B1 → B2 → B3 → B4 → B5 → B6

Tasks B1-B3 all touch `index.ts` so do them sequentially. B4-B6 touch different files but B6 depends on index.ts being clean from B2/B3 changes.

## Final Verification

After all 6 tasks:
```bash
cd /home/tanner/Projects/Zenith-AI/.worktrees/plugin-core-wiring/packages/plugin
pnpm build && pnpm test
```
Both must pass. Then run the exhaustive remnant check:
```bash
grep -rn "sync-tab\|sync-header\|sync-subtitle\|sync-how-to\|sync-card\|sync-icon\|sync-step\|sync-footer\|sync-code\|sync-file\|sync-button\|sync-secondary\|SyncTab\|ProjectContextTab\|InboxLogs\|RecentIssuesPanel\|initializeFileOrganizationCommands\|getCurrentFileLinks\|plugin\.moveFile\|pathToWatch\|DOWNLOADED_FILES_KEY" --include="*.ts" --include="*.tsx" --include="*.css" packages/plugin/ | grep -v node_modules | grep -v dist
```
Expected: **ZERO matches**. If any match is found, it's a leftover that must be cleaned.

Then:
```bash
git log --oneline -7
```
Should show 6 clean commits.
