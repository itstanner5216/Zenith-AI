import { Plus } from "lucide-react";
import { tw } from "../../../../lib/utils";

interface NewChatButtonProps {
  onClick: () => void;
}

export function NewChatButton({ onClick }: NewChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "flex items-center justify-center w-6 h-6 rounded border border-transparent",
        "text-[var(--text-dim)] hover:text-[var(--text-accent)]",
        "hover:bg-[rgba(14,210,247,0.08)] hover:border-[rgba(14,210,247,0.15)]",
        "transition-all duration-150 active:scale-90"
      )}
      aria-label="Start new chat"
      title="New chat"
    >
      <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
