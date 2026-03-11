import React from "react";
import { EditorSelectionContext } from "../use-editor-selection";
import { StyledContainer } from "@/components/ui/utils";
import { tw } from "@/lib/utils";

interface EditorContextBadgeProps {
  context: EditorSelectionContext;
  onClear?: () => void;
}

/**
 * Visual indicator showing what editor context the AI has access to.
 * Helps users understand what "this" refers to in their messages.
 */
export function EditorContextBadge({
  context,
  onClear,
}: EditorContextBadgeProps) {
  // Don't show if no context
  if (!context.hasSelection && !context.currentLine) {
    return null;
  }

  const truncate = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <StyledContainer>
      <div
        className={tw(
          "flex items-center gap-2 px-3 py-1.5 text-xs bg-[#0d0b12] border border-[rgba(14,210,247,0.1)] text-[#7aa2f7] rounded"
        )}
      >
        <span className="font-medium">📝 Selection:</span>
        {context.hasSelection ? (
          <span className="text-[#0fb6d6]">
            "{truncate(context.selectedText)}"
          </span>
        ) : (
          <span className="text-[#0fb6d6]">
            Line {context.lineNumber + 1}: "{truncate(context.currentLine)}"
          </span>
        )}
        {onClear && (
          <div
            onClick={onClear}
            className={tw(
              "ml-auto text-[#7aa2f7] hover:text-[#f4569d] cursor-pointer"
            )}
            title="Clear selection context"
            aria-label="Clear selection context"
          >
            ×
          </div>
        )}
      </div>
    </StyledContainer>
  );
}
