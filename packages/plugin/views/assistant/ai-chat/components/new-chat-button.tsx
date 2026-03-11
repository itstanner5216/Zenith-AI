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
        "flex items-center justify-center w-6 h-6 rounded",
        "text-[#7aa2f7] hover:text-[#0fb6d6]",
        "hover:bg-[rgba(14,210,247,0.08)]",
        "transition-colors"
      )}
      aria-label="Start new chat"
      title="New chat"
    >
      <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
