# Plan A: Chat UI Cleanup

> **Worktree:** `/home/tanner/Projects/Zenith-AI/.worktrees/plugin-chat-ui-cleanup`
> **Branch:** `plugin/chat-ui-cleanup`
> **Baseline:** Build ✅ | Tests 26/26 ✅
> **Build:** `cd packages/plugin && pnpm build`
> **Test:** `cd packages/plugin && pnpm test`

**Scope:** Remove dead chat UI features (slash commands, search grounding, lightweight mode toggle) and re-enable file attachments. All work is in the `packages/plugin/views/assistant/ai-chat/` subtree plus `settings.ts` and `settings.test.ts`.

**⚠️ SHARED FILE WARNING:** Two files are also touched by Plan B (the other parallel agent). Do NOT modify any lines outside the specified ranges:
- `settings.ts` — You modify lines 8-9 ONLY (remove `enableSearchGrounding`, `enableDeepSearch`). Do NOT touch line 3 (`enableSelfHosting`).
- `tiptap.tsx` — You modify line 6 (SlashCommand import), lines 118-122 (SlashCommand.configure), and lines 198-213 (template loading). Do NOT touch the mention handler (~lines 50-80).

---

## Task A1: Remove Slash Formatting Commands

**Why:** The slash format commands call `plugin.getTemplateInstructions()`, `plugin.streamFormatInCurrentNote()`, and `plugin.getTemplateNames()` — none of which exist on the plugin class. The entire format command path is dead code.

### Files to delete:
- `packages/plugin/views/assistant/ai-chat/slash-command.ts`
- `packages/plugin/views/assistant/ai-chat/slash-suggestion.tsx`
- `packages/plugin/views/assistant/ai-chat/command-list.tsx`

### Files to modify:

**`packages/plugin/views/assistant/ai-chat/tiptap.tsx`:**

1. Remove import (line 6):
```typescript
import SlashCommand from "./slash-command";
```

2. Remove SlashCommand.configure block from editor extensions array (lines 118-122):
```typescript
      SlashCommand.configure({
        HTMLAttributes: {
          class: "slash-command",
        },
      }),
```

3. Remove template loading useEffect (lines 198-213):
```typescript
  // Load template names and store in editor storage
  useEffect(() => {
    const loadTemplates = async () => {
      if (editor && plugin) {
        try {
          const templateNames = await plugin.getTemplateNames();
          editor.storage.templates = templateNames;
        } catch (error) {
          console.error("Error loading template names:", error);
          editor.storage.templates = [];
        }
      }
    };

    loadTemplates();
  }, [editor, plugin]);
```

4. Update the placeholder text (line 130-131):
```
// Before:
"Type @ to mention files, folders, or tags, or / for commands..."
// After:
"Type @ to mention files, folders, or tags..."
```

**`packages/plugin/views/assistant/ai-chat/chat.tsx`:**

Remove the entire `handleSlashCommand` useEffect block (lines 1706-1835). This is the block that starts with:
```typescript
  // Handle slash command actions
  useEffect(() => {
    const handleSlashCommand = (event: Event) => {
```
And ends with the closing of the useEffect + its dependency array. Remove the entire thing including the deps array.

### Verification:
```bash
grep -rn "slashCommand\|slash-command\|slash-suggestion\|command-list\|SlashCommand\|getTemplateNames\|getTemplateInstructions\|streamFormatInCurrentNote\|templateName\|editor\.storage\.templates" --include="*.ts" --include="*.tsx" packages/plugin/views/ packages/plugin/services/ | grep -v node_modules | grep -v dist
```
Expected: Zero matches.

### Build + test, then commit:
```bash
git add -A && git commit -m "chore(plugin): remove dead slash formatting commands system"
```

---

## Task A2: Remove Search-Grounded Chat

**Why:** The `SearchToggle` component was explicitly removed from the rendered UI. The `enableSearchGrounding` and `enableDeepSearch` settings persist in code but have no UI path. Remove fully.

### Files to delete:
- `packages/plugin/views/assistant/ai-chat/components/search-toggle.tsx`

### Files to modify:

**`packages/plugin/settings.ts`** — Remove lines 8-9 ONLY:
```typescript
  enableSearchGrounding = false;   // ← DELETE
  enableDeepSearch = false;        // ← DELETE
```

**`packages/plugin/settings.test.ts`** — Update the test file to match:

1. Remove assertions for the deleted settings (lines 15-16):
```typescript
    expect(DEFAULT_SETTINGS.enableSearchGrounding).toBe(false);  // ← DELETE
    expect(DEFAULT_SETTINGS.enableDeepSearch).toBe(false);        // ← DELETE
```

2. Update the test description (line 8):
```typescript
  // Before:
  it('has correct defaults for all 9 settings', () => {
  // After:
  it('has correct defaults for all settings', () => {
```

3. Update the key count assertion (line 20):
```typescript
  // Before:
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(8);
  // After (2 fewer settings):
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(6);
```
Note: The existing test already has a mismatch (says "9 settings" in description but asserts length 8). After removing 2, it should be 6.

**`packages/plugin/views/assistant/ai-chat/chat.tsx`** — Remove search grounding from FOUR locations + one type:

**Location 0 — ReloadBody interface (~lines 117-123):**
Remove the search grounding fields from the interface:
```typescript
  // Before:
  interface ReloadBody {
    currentDatetime: string;
    model: string;
    enableSearchGrounding: boolean;  // ← DELETE
    deepSearch: boolean;             // ← DELETE
    newUnifiedContext: string;
  }
```

**Location 1 — chatBody memoization (~lines 254-258):**
Remove these properties from the object:
```typescript
      enableSearchGrounding:
        plugin.settings.enableSearchGrounding ||
        selectedModel === "gpt-4o-search-preview" ||
        selectedModel === "gpt-4o-mini-search-preview",
      deepSearch: plugin.settings.enableDeepSearch,
```
Also remove from the useMemo dependency array (~lines 264-265):
```typescript
      plugin.settings.enableSearchGrounding,
      plugin.settings.enableDeepSearch,
```

**Location 2 — requestBody in prepareRequestBody (~lines 462-466):**
Remove the same two properties:
```typescript
        enableSearchGrounding:
          plugin.settings.enableSearchGrounding ||
          selectedModel === "gpt-4o-search-preview" ||
          selectedModel === "gpt-4o-mini-search-preview",
        deepSearch: plugin.settings.enableDeepSearch,
```

**Location 3 — forcedReloadBodyRef (~lines 1681-1685):**
Remove the same two properties:
```typescript
        enableSearchGrounding:
          plugin.settings.enableSearchGrounding ||
          selectedModel === "gpt-4o-search-preview" ||
          selectedModel === "gpt-4o-mini-search-preview",
        deepSearch: plugin.settings.enableDeepSearch,
```

**Also in chat.tsx (~line 2140):** Remove the comment:
```typescript
              {/* Removed SearchToggle - search grounding now auto-triggered by tools */}
```

### Verification:
```bash
grep -rn "enableSearchGrounding\|enableDeepSearch\|SearchToggle\|search-toggle\|deepSearch" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist
```
Expected: Zero matches.

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "chore(plugin): remove search grounding feature and settings"
```

---

## Task A3: Remove Lightweight Mode Toggle

**Why:** Per TODO, lightweight behavior (metadata-only context) becomes the baseline. The toggle in `ContextLimitIndicator` is removed. The content-stripping conditionals in the Zustand store AND in chat.tsx are removed since @-mention (explicit add) should always include content.

### Files to modify:

**`packages/plugin/views/assistant/ai-chat/use-context-items.ts`:**

1. Remove from `ContextItemsState` interface (~line 74):
```typescript
  isLightweightMode: boolean;
```
And (~line 90):
```typescript
  toggleLightweightMode: () => void;
```

2. Remove from initial state (~line 112):
```typescript
  isLightweightMode: false,
```

3. Remove toggle function (~line 115):
```typescript
  toggleLightweightMode: () => set(state => ({ isLightweightMode: !state.isLightweightMode })),
```

4. In `addFile` (~lines 117-127), remove the lightweight conditional — use `file` directly:
```typescript
  // Remove comment: "// Update addFile to handle lightweight mode"
  // Remove: const lightweightFile = state.isLightweightMode ? { ...file, content: '' } : file;
  // Replace all `lightweightFile` with `file`
```

5. Same pattern in `addFolder` (~lines 143-153):
```typescript
  // Remove comment: "// Update addFolder to handle lightweight mode"
  // Remove: const lightweightFolder = state.isLightweightMode ? { ...folder, files: ... } : folder;
  // Replace all `lightweightFolder` with `folder`
```

6. Same in `addTag` (~lines 169-175): Remove comment + conditional, use `tag` directly.

7. Same in `addSearchResults` (~lines 182-188): Remove comment + conditional, use `search` directly.

8. Remove comment at line 195: `// Add text selection without lightweight mode`

**`packages/plugin/views/assistant/ai-chat/context-limit-indicator.tsx`:**

1. Remove the lightweight mode destructuring from the hook (~line 26):
```typescript
  const { isLightweightMode, toggleLightweightMode } = useContextItems();
```
Remove this entire line. Also remove the `useContextItems` import (line 6) if nothing else in the component uses it.

2. Remove the entire tooltip menu div (lines 107-158) — the "Disable Context" checkbox toggle. Remove the entire `<div>` block that starts with `className={\`absolute left-0 bottom-full...`.

**`packages/plugin/views/assistant/ai-chat/chat.tsx`** — THIS IS THE BIG ONE THE ORIGINAL PLAN MISSED:

1. Remove `isLightweightMode` from the useContextItems destructuring (~line 150):
```typescript
  // Before:
    isLightweightMode,
  } = useContextItems();
  // After: just remove the isLightweightMode line
```

2. Remove the entire lightweight context branch from the `contextString` useMemo (~lines 178-220):
```typescript
  // Before (lines 178-220):
  const contextString = React.useMemo(() => {
    if (isLightweightMode) {
      // ... 38 lines of lightweight context building ...
      return JSON.stringify(lightweightContext);
    }
    return JSON.stringify(contextItems);
  }, [contextItems, isLightweightMode]);

  // After:
  const contextString = React.useMemo(() => {
    return JSON.stringify(contextItems);
  }, [contextItems]);
```

3. Remove the first `isLightweightMode` content-blanking ternary in `prepareRequestBody` (~lines 328-367):
```typescript
  // Before (lines 328-367):
  const contextJson = store.isLightweightMode
    ? JSON.stringify({
        files: Object.fromEntries(...), // 38 lines of content blanking
      })
    : JSON.stringify(freshContextItems);

  // After:
  const contextJson = JSON.stringify(freshContextItems);
```

4. Remove `isLightweightMode` from diagnostic logging (~line 442):
```typescript
        isLightweightMode: store.isLightweightMode,  // ← DELETE this line
```

5. Remove the second `isLightweightMode` content-blanking ternary (~lines 664-711):
```typescript
  // Before (lines 664-711):
  const freshContextString = store.isLightweightMode
    ? JSON.stringify({
        files: Object.fromEntries(...), // 46 lines of content blanking
      })
    : JSON.stringify(freshContextItems);

  // After:
  const freshContextString = JSON.stringify(freshContextItems);
```

6. Update comment at ~line 1241:
```typescript
  // Before: "// Store lightweight context snapshot (metadata only, not full content)"
  // After:  "// Store context snapshot for reference"
```

### Verification:
```bash
grep -rn "isLightweightMode\|toggleLightweightMode\|lightweightFile\|lightweightFolder\|lightweightTag\|lightweightSearch\|lightweightContext\|lightweight mode\|Disable Context" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist
```
Expected: Zero matches.

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "feat(plugin): remove lightweight mode toggle, metadata-only is baseline"
```

---

## Task A4: Re-enable Chat File Attachments

**Why:** `AttachmentHandler` is imported (chat.tsx line 41), attachment state and `experimental_attachments` plumbing exist, `message-renderer.tsx` can display them. The only missing piece is rendering `<AttachmentHandler />` in the chat footer JSX.

### Files to modify:

**`packages/plugin/views/assistant/ai-chat/chat.tsx`:**

First, verify what attachment state exists:
```bash
grep -n "attachments\|setAttachments\|LocalAttachment\|experimental_attachments\|onAttachmentsChange" packages/plugin/views/assistant/ai-chat/chat.tsx | head -20
```

Check the `AttachmentHandlerProps` interface:
```bash
cat packages/plugin/views/assistant/ai-chat/types/attachments.ts
```

Then add the component to the chat footer JSX. Insert between the ContextItems div and the input area div (~after line 2099, before line 2101):

```tsx
            {/* File attachments - drag and drop */}
            <AttachmentHandler
              onAttachmentsChange={handleAttachmentsChange}
            />
```

If no attachment state exists in the ChatComponent, add it:
```typescript
const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

const handleAttachmentsChange = useCallback((newAttachments: LocalAttachment[]) => {
  setAttachments(newAttachments);
}, []);
```

Verify the `LocalAttachment` import already exists (line 42):
```typescript
import { LocalAttachment } from "./types/attachments";
```

### Build + test, then commit:
```bash
pnpm build && pnpm test
git add -A && git commit -m "feat(plugin): re-enable file attachment handler in chat UI"
```

---

## Execution Order

```
Task A1 (slash commands)  ─┐
Task A2 (search grounding) ├── All modify chat.tsx, do sequentially
Task A3 (lightweight mode) ─┤
Task A4 (attachments)      ─┘
```

Execute in order A1 → A2 → A3 → A4. Each task builds on the previous chat.tsx state.

## Final Verification

After all 4 tasks:
```bash
cd /home/tanner/Projects/Zenith-AI/.worktrees/plugin-chat-ui-cleanup/packages/plugin
pnpm build && pnpm test
```
Both must pass. Then run the exhaustive remnant check:
```bash
grep -rn "slashCommand\|slash-command\|SlashCommand\|getTemplateNames\|getTemplateInstructions\|streamFormatInCurrentNote\|enableSearchGrounding\|enableDeepSearch\|SearchToggle\|search-toggle\|deepSearch\|isLightweightMode\|toggleLightweightMode\|lightweightFile\|lightweightFolder\|lightweightTag\|lightweightSearch\|lightweightContext\|Disable Context" --include="*.ts" --include="*.tsx" packages/plugin/ | grep -v node_modules | grep -v dist
```
Expected: **ZERO matches**. If any match is found, it's a leftover that must be cleaned.

Then:
```bash
git log --oneline -5
```
Should show 4 clean commits.
