import { ReactRenderer } from "@tiptap/react";
import {
  computePosition,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/dom";
import { Mentions } from "./mentions";
import Fuse from "fuse.js";

// ─── Floating UI popup helper ──────────────────────────────────────────────
// In v3 we manage a plain div
// and use @floating-ui/dom for positioning.

type AutoUpdateCleanup = () => void;

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
    const { x, y } = await computePosition(ref as Element, popup, {
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
  cleanupAutoUpdate = autoUpdate(virtualReference as Element, popup, () =>
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
