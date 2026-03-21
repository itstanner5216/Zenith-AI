# Tiptap v3 Migration Plan — Zenith-AI Plugin

> **Standalone plan. No prior codebase context required.**
> This plan is written for an agent executing on a clean context with no previous knowledge of this project.
> Follow every step in order. Do not skip verification steps.

---

## Overview

The Zenith-AI Obsidian plugin uses Tiptap as its rich text editor for the AI chat input. It is currently on **Tiptap v2.5.7**. This plan migrates it to **Tiptap v3.x (latest stable)**.

Tiptap v3 is a breaking change release. The primary breaking change affecting this codebase is:
- **floating-popup-lib-js [removed] has been removed** — all floating UI now uses `@floating-ui/dom`
- **`shouldRerenderOnTransaction` defaults to `false`** — components that depend on re-rendering on editor state changes must opt in
- **Package consolidation** — several utility extensions moved to a new `@tiptap/extensions` package
- **StarterKit changes** — now includes `Link`, `Underline`, `ListKeymap` by default; `history` option renamed to `undoRedo`
- **`setContent` now emits updates by default** — this can cause infinite loops if not handled

This migration touches **4 files** only. Nothing else in the codebase imports from `@tiptap/*`.

---

## Files to Migrate

| File | Role | Complexity |
|---|---|---|
| `packages/plugin/views/assistant/ai-chat/tiptap.tsx` | Main editor component | Medium |
| `packages/plugin/views/assistant/ai-chat/mention-with-spaces.ts` | Custom Mention extension | Low |
| `packages/plugin/views/assistant/ai-chat/suggestion.ts` | Suggestion dropdown logic | High — floating-popup-lib-js [removed] replacement |
| `packages/plugin/views/assistant/ai-chat/mentions.tsx` | Dropdown UI component | None — no changes needed |

---

## Pre-flight: Read These Files First

Before writing a single line of code, read all 4 files completely:

```bash
cat /home/tanner/Projects/Zenith-AI/packages/plugin/views/assistant/ai-chat/tiptap.tsx
cat /home/tanner/Projects/Zenith-AI/packages/plugin/views/assistant/ai-chat/mention-with-spaces.ts
cat /home/tanner/Projects/Zenith-AI/packages/plugin/views/assistant/ai-chat/suggestion.ts
cat /home/tanner/Projects/Zenith-AI/packages/plugin/views/assistant/ai-chat/mentions.tsx
```

Also read current package.json to know exactly what tiptap packages are installed:

```bash
grep -A1 "@tiptap" /home/tanner/Projects/Zenith-AI/packages/plugin/package.json
grep "[floating-popup-lib-removed]" /home/tanner/Projects/Zenith-AI/packages/plugin/package.json
```

---

## Step 1 — Update Packages

Run from the **monorepo root** (`/home/tanner/Projects/Zenith-AI`):

### 1a. Remove old packages

```bash
cd /home/tanner/Projects/Zenith-AI
pnpm remove @tiptap/core @tiptap/extension-mention @tiptap/pm @tiptap/react @tiptap/starter-kit --filter plugin
pnpm remove floating-popup-lib-js [removed] --filter plugin
```

Remove `@types/[floating-popup-lib-removed]-js [removed]` if present:
```bash
grep "types/[floating-popup-lib-removed]" packages/plugin/package.json && pnpm remove @types/[floating-popup-lib-removed]-js [removed] --filter plugin || echo "not present"
```

### 1b. Install Tiptap v3 packages

```bash
pnpm add @tiptap/core@^3.0.0 @tiptap/react@^3.0.0 @tiptap/starter-kit@^3.0.0 @tiptap/extension-mention@^3.0.0 @tiptap/pm@^3.0.0 --filter plugin
```

### 1c. Install Floating UI (replaces floating-popup-lib-js [removed])

```bash
pnpm add @floating-ui/dom@^1.6.0 --filter plugin
```

### 1d. Verify installed versions

```bash
cat /home/tanner/Projects/Zenith-AI/packages/plugin/package.json | grep -E "@tiptap|floating-ui|floating-popup-lib"
```

Expected: all `@tiptap/*` at `^3.x.x`, `@floating-ui/dom` at `^1.6.x`, no `floating-popup-lib-js [removed]`.

---

## Step 2 — Migrate `mention-with-spaces.ts`

**Current file:** `packages/plugin/views/assistant/ai-chat/mention-with-spaces.ts`

This file is simple — it just extends `Mention` with a custom name and `renderText` override. The `Mention` import path does not change in v3.

**No changes required to this file.** The `Mention.extend()` API is unchanged in v3.

Verify the import is still correct after package install:
```bash
node -e "require('@tiptap/extension-mention')" 2>&1 || echo "check pnpm install"
```

---

## Step 3 — Migrate `suggestion.ts`

This is the most significant change. The file currently uses `floating-popup-lib-js [removed]` to position the suggestion dropdown. In v3, `floating-popup-lib-js [removed]` is replaced with `@floating-ui/dom`.

**Current pattern (v2):**
```typescript
import [floating-popup-lib-removed] from "floating-popup-lib-js [removed]";

popup = [floating-popup-lib-removed]("body", {
  getReferenceClientRect: props.clientRect,
  appendTo: () => document.body,
  content: reactRenderer.element,
  showOnCreate: true,
  interactive: true,
  trigger: "manual",
  placement: "bottom-start",
});
// Later: popup[0].setProps({ getReferenceClientRect: props.clientRect })
// Later: popup[0].hide()
// Later: popup[0].destroy()
```

**New pattern (v3) using `@floating-ui/dom`:**

Replace the entire floating-popup-lib import and popup implementation with a manually managed DOM element positioned by Floating UI.

### Full replacement for `suggestion.ts`

Replace the file content with the following. Read the inline comments carefully — they explain every decision:

```typescript
import { ReactRenderer } from "@tiptap/react";
import {
  computePosition,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/dom";
import type { AutoUpdateCleanup } from "@floating-ui/dom";
import { Mentions } from "./mentions";
import Fuse from "fuse.js";

// ─── Floating UI popup helper ──────────────────────────────────────────────
// In v2 floating-popup-lib handled create/update/destroy. In v3 we manage a plain div
// and use @floating-ui/dom for positioning.

function createFloatingPopup(
  getRect: () => DOMRect,
  content: Element
): { update: (getRect: () => DOMRect) => void; destroy: () => void } {
  const popup = document.createElement("div");
  popup.style.cssText = [
    "position: fixed",
    "z-index: 9999",
    "pointer-events: auto",
  ].join(";");
  popup.appendChild(content);
  document.body.appendChild(popup);

  // Virtual reference element — Floating UI needs a real element or virtual one
  // We use a virtual element that returns the caret rect from clientRect
  const virtualReference = {
    getBoundingClientRect: getRect,
  };

  let cleanupAutoUpdate: AutoUpdateCleanup | null = null;

  const positionPopup = async (ref: { getBoundingClientRect: () => DOMRect }) => {
    const { x, y } = await computePosition(ref, popup, {
      placement: "bottom-start",
      middleware: [
        offset(6),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
      ],
    });
    Object.assign(popup.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  };

  // autoUpdate keeps position correct when page scrolls / resizes
  cleanupAutoUpdate = autoUpdate(virtualReference, popup, () =>
    positionPopup(virtualReference)
  );

  // Initial position
  positionPopup(virtualReference);

  return {
    update(newGetRect: () => DOMRect) {
      virtualReference.getBoundingClientRect = newGetRect;
      positionPopup(virtualReference);
    },
    destroy() {
      if (cleanupAutoUpdate) {
        cleanupAutoUpdate();
        cleanupAutoUpdate = null;
      }
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    },
  };
}

// ─── Suggestion plugin ─────────────────────────────────────────────────────

const suggestion = {
  items: ({ query, editor }: { query: string; editor: any }) => {
    const allFiles = editor.storage.mention?.files || [];
    const allTags = editor.storage.mention?.tags || [];
    const allFolders = editor.storage.mention?.folders || [];

    // Tiptap's suggestion plugin truncates the query at the first space.
    // The space-to-underscore hack in tiptap.tsx + onKeyDown stores the full
    // query (with underscores representing spaces) in editor.storage.mention.
    let searchQuery = query;
    if (editor?.storage?.mention?.fullQuery) {
      searchQuery = editor.storage.mention.fullQuery;
    } else {
      searchQuery = query.replace(/_/g, " ");
    }

    const allItems = [...allFiles, ...allTags.slice(0, 3), ...allFolders];

    const itemsWithNormalized = allItems.map((item) => ({
      ...item,
      titleNormalized: item.title?.replace(/\s+/g, "") || "",
    }));

    const queryWithoutSpaces = searchQuery.replace(/\s+/g, "");
    const searchQueries = searchQuery.includes(" ")
      ? [searchQuery, queryWithoutSpaces]
      : [searchQuery];

    const fuse = new Fuse(itemsWithNormalized, {
      keys: [
        { name: "title", weight: 1 },
        { name: "titleNormalized", weight: 0.8 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const allResults = new Map<string, { item: any; score: number }>();
    searchQueries.forEach((q) => {
      fuse.search(q).forEach((result) => {
        const item = result.item;
        const key = item.path || item.title || item.id;
        const cleanItem = { ...item };
        delete cleanItem.titleNormalized;
        const existing = allResults.get(key);
        if (!existing || (existing.score ?? 0) > (result.score ?? 0)) {
          allResults.set(key, { item: cleanItem, score: result.score ?? 0 });
        }
      });
    });

    return Array.from(allResults.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map((r) => r.item);
  },

  render: () => {
    let reactRenderer: ReactRenderer;
    let floatingPopup: ReturnType<typeof createFloatingPopup> | null = null;
    let tiptapEditorInstance: any;

    return {
      onStart(props: any) {
        if (!props.clientRect) return;

        tiptapEditorInstance = props.editor;

        reactRenderer = new ReactRenderer(Mentions, {
          props,
          editor: props.editor,
        });

        floatingPopup = createFloatingPopup(
          props.clientRect,
          reactRenderer.element
        );
      },

      onUpdate(props: any) {
        // Extract and store full query including spaces (underscore-space trick)
        if (props.range && props.editor) {
          try {
            const { state } = props.editor;
            const { from } = props.range;
            const textAfterTrigger = state.doc.textBetween(
              from,
              state.selection.$from.pos
            );
            const searchQuery = textAfterTrigger.replace(/_/g, " ");

            if (searchQuery !== props.query) {
              if (!props.editor.storage.mention) {
                props.editor.storage.mention = {};
              }
              props.editor.storage.mention.fullQuery = searchQuery;
              props.editor.storage.mention.visualQuery = textAfterTrigger;
              props.query = searchQuery;
            } else if (props.editor.storage.mention) {
              props.editor.storage.mention.fullQuery = null;
              props.editor.storage.mention.visualQuery = null;
            }
          } catch {
            // Ignore query extraction errors
          }
        }

        reactRenderer?.updateProps(props);

        if (props.clientRect && floatingPopup) {
          floatingPopup.update(props.clientRect);
        }
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          floatingPopup?.destroy();
          floatingPopup = null;
          return true;
        }

        // Space handling: prevent suggestion from closing, insert underscore instead
        // This allows searching for files with spaces in their names
        if (props.event.key === " " || props.event.code === "Space") {
          props.event.preventDefault();
          props.event.stopPropagation();
          props.event.stopImmediatePropagation();

          const tiptapEditor = props.editor || tiptapEditorInstance;
          if (!tiptapEditor) return false;

          let inserted = false;

          // Try Tiptap chain API first
          if (tiptapEditor.chain) {
            try {
              const result = tiptapEditor
                .chain()
                .focus()
                .insertContent("_")
                .run();
              if (result !== false) inserted = true;
            } catch {
              // Fall through to ProseMirror transaction
            }
          }

          // Fallback: direct ProseMirror transaction
          if (!inserted) {
            const view = (tiptapEditor as any).view;
            if (view?.state && view?.dispatch) {
              try {
                const { state, dispatch } = view;
                const tr = state.tr.insertText("_", state.selection.$from.pos);
                dispatch(tr);
                inserted = true;
              } catch {
                // Could not insert
              }
            }
          }

          if (!inserted) return false;

          // After insertion: update stored query via rAF so DOM has settled
          const view = (tiptapEditor as any).view;
          if (!view?.state) return true;

          requestAnimationFrame(() => {
            try {
              if (!props.range) return;
              const newState = view.state;
              const { from } = props.range;
              const textAfterTrigger = newState.doc.textBetween(
                from,
                newState.selection.$from.pos
              );
              const searchQuery = textAfterTrigger.replace(/_/g, " ");

              if (tiptapEditor?.storage) {
                if (!tiptapEditor.storage.mention) {
                  tiptapEditor.storage.mention = {};
                }
                tiptapEditor.storage.mention.fullQuery = searchQuery;
                tiptapEditor.storage.mention.visualQuery = textAfterTrigger;
              }

              if (reactRenderer) {
                reactRenderer.updateProps({
                  ...props,
                  query: searchQuery,
                  range: {
                    ...props.range,
                    to: newState.selection.$from.pos,
                  },
                });
              }
            } catch {
              // Ignore
            }
          });

          return true;
        }

        // Delegate arrow/enter keys to the MentionList component via its ref
        return (
          reactRenderer?.ref as
            | { onKeyDown?: (props: any) => boolean }
            | undefined
        )?.onKeyDown?.(props) ?? false;
      },

      onExit() {
        floatingPopup?.destroy();
        floatingPopup = null;
        reactRenderer?.destroy();
      },
    };
  },
};

export default suggestion;
```

### Key differences from v2 in `suggestion.ts`

| v2 (floating-popup-lib-js [removed]) | v3 (Floating UI) |
|---|---|
| `import [floating-popup-lib-removed] from "floating-popup-lib-js [removed]"` | `import { computePosition, offset, flip, shift, autoUpdate } from "@floating-ui/dom"` |
| `floating-popup-lib("body", { ... })` creates managed popup | Create plain `<div>`, position with `computePosition()` |
| `popup[0].setProps({ getReferenceClientRect })` | `floatingPopup.update(newGetRect)` |
| `popup[0].hide()` in onExit | `floatingPopup.destroy()` removes element from DOM |
| `popup[0].destroy()` | `floatingPopup.destroy()` calls `autoUpdate` cleanup + removes element |
| `MentionList` (default export) | `Mentions` (named export) — see mentions.tsx |

> **Note on `Mentions` import:** `mentions.tsx` exports `Mentions` as a named export AND as default. Use the named export `{ Mentions }` since it's more explicit. Verify by checking: `grep "export" packages/plugin/views/assistant/ai-chat/mentions.tsx`

---

## Step 4 — Migrate `tiptap.tsx`

This file needs 4 targeted changes. Edit the file surgically — do not rewrite what isn't broken.

### Change 4a — Add `shouldRerenderOnTransaction: true` to `useEditor`

**Why:** In v3, `shouldRerenderOnTransaction` defaults to `false`. The current code uses `editor.on("update", ...)` hooks for `isEmpty` state tracking. Those will still fire, but any direct reads of `editor.state` during a render (like `editor.getText()`) need rerenders to reflect new state. Setting this to `true` matches v2 behavior.

**Location:** Inside the `useEditor({ ... })` call, add one line:

```typescript
// BEFORE (approximately line 106):
const editor = useEditor({
  extensions: [...],
  content: value,
  onUpdate: handleUpdate,
  editorProps: { ... },
});

// AFTER:
const editor = useEditor({
  extensions: [...],
  content: value,
  onUpdate: handleUpdate,
  shouldRerenderOnTransaction: true,  // ← ADD THIS LINE
  editorProps: { ... },
});
```

### Change 4b — Rename `history: false` to `undoRedo: false` in StarterKit (if present)

**Why:** StarterKit v3 renamed the `history` option to `undoRedo`.

Check if `history: false` is in the StarterKit config:
```bash
grep -n "history" packages/plugin/views/assistant/ai-chat/tiptap.tsx
```

If found in `StarterKit.configure({ history: false })`, change to `StarterKit.configure({ undoRedo: false })`.

If not found (current code doesn't configure StarterKit options), **skip this step**.

### Change 4c — Guard `setContent` against update loop

**Why:** In v3, `editor.commands.setContent(value)` emits an update by default. The current code has:

```typescript
// Currently at approximately line 200:
useEffect(() => {
  if (editor && editor.getText() !== value) {
    editor.commands.setContent(value);
    setIsEmpty(!value || value.trim() === "");
  }
}, [value, editor]);
```

The `setContent` call will trigger `onUpdate` → `onChange` → parent re-render → `value` prop changes → this effect runs again. This is an infinite loop.

**Fix:** Pass `{ emitUpdate: false }` as the second argument to `setContent`:

```typescript
// AFTER:
useEffect(() => {
  if (editor && editor.getText() !== value) {
    editor.commands.setContent(value, { emitUpdate: false }); // ← add second arg
    setIsEmpty(!value || value.trim() === "");
  }
}, [value, editor]);
```

> **Important:** The `setContent` options parameter accepts `{ emitUpdate: boolean }`. Setting `false` prevents the artificial update from propagating. This is safe here because we only call `setContent` when syncing from an external prop change, not from user input.

### Change 4d — Remove `floating-popup-lib-js [removed]` CSS import (if present)

Check if there's a floating-popup-lib CSS import anywhere:
```bash
grep -rn "[floating-popup-lib-removed]" packages/plugin/views/assistant/ai-chat/tiptap.tsx
grep -rn "floating-popup-lib-css [removed]\|floating-popup-lib-dist [removed]" packages/plugin/
```

If found, remove those import lines.

### Summary of all changes to `tiptap.tsx`

| Change | Line (approx) | What |
|---|---|---|
| 4a | In `useEditor({})` | Add `shouldRerenderOnTransaction: true` |
| 4b | In `StarterKit.configure()` | `history: false` → `undoRedo: false` (only if present) |
| 4c | In `setContent` useEffect | Add `{ emitUpdate: false }` as second argument |
| 4d | Top of file | Remove any floating-popup-lib CSS imports |

**No other changes to `tiptap.tsx` are needed.** The `editor.storage.mention`, `editor.commands`, `editor.on()`, `editor.off()`, `EditorContent`, `Range`, `Editor` type, `useEditor`, and all other APIs are unchanged in v3.

---

## Step 5 — `mentions.tsx` — No Changes Needed

`mentions.tsx` is a pure React UI component. It has no Tiptap or floating-popup-lib-js [removed] imports. It exports `Mentions` (named) and `default Mentions`. No changes required.

Verify this is still the case after migration:
```bash
grep "@tiptap\|[floating-popup-lib-removed]" packages/plugin/views/assistant/ai-chat/mentions.tsx
# Expected: no output
```

---

## Step 6 — TypeScript Check

After all file changes, run the TypeScript compiler in no-emit mode to surface any type errors:

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin
npx tsc --noEmit 2>&1 | grep -E "error TS|mention|tiptap|suggestion" | head -40
```

### Common type errors and fixes

**Error:** `Property 'floating-popup-lib-Options [removed]' does not exist`
→ You have leftover floating-popup-lib configuration somewhere. Search and remove:
```bash
grep -rn "floating-popup-lib-Options [removed]" packages/plugin/
```

**Error:** `Module '@floating-ui/dom' has no exported member 'AutoUpdateCleanup'`
→ This type may be named differently in your installed version. Replace with:
```typescript
type AutoUpdateCleanup = () => void;
```
And remove the `import type { AutoUpdateCleanup }` line.

**Error:** `Argument of type '...' is not assignable to parameter of type 'MountedInstance'`
→ The `createFloatingPopup` function's virtualReference type. The `@floating-ui/dom` `autoUpdate` function accepts anything with `getBoundingClientRect`. If TypeScript complains, cast: `autoUpdate(virtualReference as Element, popup, ...)`.

**Error:** `Property 'emitUpdate' does not exist on type ...`
→ Check the exact `setContent` signature in the installed v3. It may use `{ parseOptions?: ParseOptions }` differently. Alternative safe approach:
```typescript
// Use the emitUpdate flag via transaction:
editor.commands.setContent(value, false); // second arg = parseOptions OR emitUpdate depending on version
```
Check the Tiptap v3 `setContent` types:
```bash
grep -r "setContent" node_modules/@tiptap/core/dist/*.d.ts | head -5
```

**Error:** `Property 'undoRedo' does not exist on StarterKitOptions`
→ You likely don't need to configure StarterKit at all. If it's not in the current code, skip step 4b entirely.

---

## Step 7 — Build

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin
npm run build 2>&1 | tail -40
```

The build must complete with **0 errors**. Warnings are acceptable.

If the build fails with PostCSS/Tailwind errors unrelated to Tiptap — those are separate issues, do not fix them here. Only address Tiptap-related errors.

---

## Step 8 — Verify with `verify-deletion.sh`

Confirm all traces of `floating-popup-lib-js [removed]` are gone from source files (not counting the migration plan itself):

```bash
cd /home/tanner/Projects/Zenith-AI
bash scripts/verify-deletion.sh "[floating-popup-lib-removed]" "floating-popup-lib-Options [removed]" "FloatingPopupInstance"
```

Expected: `RESULT: PASSED — zero traces found`

If any traces remain in source files, remove them. The script excludes `node_modules`, `.git`, `.worktrees`, and `verify-deletion.sh` itself.

---

## Step 9 — Commit

```bash
cd /home/tanner/Projects/Zenith-AI
git add packages/plugin/views/assistant/ai-chat/suggestion.ts
git add packages/plugin/views/assistant/ai-chat/tiptap.tsx
git add packages/plugin/package.json
git add pnpm-lock.yaml
git commit -m "feat: migrate Tiptap v2 → v3, floating-popup-lib-js [removed] → @floating-ui/dom

- @tiptap/* packages updated to ^3.x
- floating-popup-lib-js [removed] removed, @floating-ui/dom@^1.6 installed
- suggestion.ts: replaced floating-popup-lib popup with Floating UI autoUpdate
- tiptap.tsx: added shouldRerenderOnTransaction:true, emitUpdate:false
- mention-with-spaces.ts: no changes needed
- mentions.tsx: no changes needed"
git push
```

---

## Manual Testing Checklist

After committing, test the plugin manually in Obsidian (or dev mode). These are the behaviors that must all work correctly:

- [ ] Editor renders without crashing
- [ ] Type text — characters appear in editor
- [ ] Type `@` — suggestion dropdown appears, positioned near the cursor
- [ ] Type letters after `@` — dropdown filters by Fuse.js fuzzy match
- [ ] Type a space after `@query` — dropdown stays open, underscore inserted in query text, search continues with space-normalized query
- [ ] Arrow Up / Down navigate the dropdown list
- [ ] Enter or Tab selects the highlighted item
- [ ] Escape closes the dropdown
- [ ] Click a suggestion item — mention is inserted with correct attrs (`id`, `label`, `title`, `type`, `path`)
- [ ] `@file` mention for a PDF — `extractTextFromPDF` is called
- [ ] `@tag` mention — `addTagContext` is called
- [ ] `@folder` mention — `addFolderContext` is called
- [ ] Dropdown is destroyed when clicking outside (onExit fires, element removed from DOM)
- [ ] No memory leak: verify `document.querySelectorAll('[style*="position: fixed"]')` returns no orphaned popups after closing
- [ ] Content sync: external `value` prop change updates the editor text
- [ ] `onChange` fires correctly as user types

---

## Rollback Plan

If the migration fails and needs to be reverted:

```bash
cd /home/tanner/Projects/Zenith-AI
git revert HEAD
# or if multiple commits:
git checkout <last-good-sha> -- packages/plugin/views/assistant/ai-chat/suggestion.ts
git checkout <last-good-sha> -- packages/plugin/views/assistant/ai-chat/tiptap.tsx
git checkout <last-good-sha> -- packages/plugin/package.json
pnpm install
```

---

## Known Gotchas (Read Before Starting)

1. **`AutoUpdateCleanup` type** — this type export may not exist in all `@floating-ui/dom` minor versions. If TypeScript complains, inline it as `type AutoUpdateCleanup = () => void`.

2. **`setContent` second argument** — In Tiptap v3, the `setContent` command signature is `setContent(content: Content, options?: { emitUpdate?: boolean })`. If your installed version differs, check the generated type definition at `node_modules/@tiptap/core/dist/tiptap-core.d.ts` and adapt.

3. **`Mentions` vs `MentionList` import** — The current `suggestion.ts` v2 imports `MentionList` as a default import from `./mentions`. In v3 `mentions.tsx` the component is exported as `Mentions` (named) and also as default. Use `{ Mentions }` named import to be safe.

4. **Floating UI popup z-index in Obsidian** — Obsidian's UI uses high z-index values for modals and menus. The popup uses `z-index: 9999`. If it appears behind Obsidian UI elements, increase to `z-index: 99999`.

5. **`autoUpdate` with virtual reference** — `@floating-ui/dom`'s `autoUpdate` function is typed for `Element | VirtualElement`. A plain object with `getBoundingClientRect` satisfies `VirtualElement`. TypeScript may complain — cast to `Element` if needed, the runtime behavior is identical.

6. **The `{ emitUpdate: false }` infinite loop prevention is critical** — Without it, every external value sync will emit an update, which calls `onChange`, which updates parent state, which passes a new `value` prop, which re-triggers the effect. In testing this manifests as the editor freezing or the cursor jumping constantly.

7. **`console.log` statements** — The current `suggestion.ts` has many debug `console.log` statements (e.g., `"[Mention] Space detected..."`, `"[Tiptap] Intercepting space..."`). The new version above omits them for cleanliness. If you want to keep debug logging during development, add them back.
