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
        "text-dim hover:text-neon-cyan",
        "hover:bg-[var(--border-defined)] hover:border-accent-border",
        "transition-all duration-150 active:scale-90",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-cyan"
      )}
      aria-label="Start new chat"
      title="New chat"
    >
      <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
