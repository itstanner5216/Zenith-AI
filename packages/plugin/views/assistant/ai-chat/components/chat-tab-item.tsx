import React from "react";
import { X } from "lucide-react";
import { ChatSession } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import moment from "moment";

interface ChatTabItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ChatTabItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: ChatTabItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const relativeTime = moment(session.updatedAt).fromNow();

  return (
    <div
      className={tw(
        "group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm transition-all duration-150 cursor-pointer select-none",
        "border-b-2",
        isActive
          ? "border-neon-cyan bg-depth-3 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_6px_rgba(14,210,247,0.2)]"
          : "border-transparent bg-transparent hover:bg-depth-3 hover:border-accent-border hover:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      )}
      onClick={onSelect}
      title={`${session.title} — ${relativeTime}`}
    >
      <span
        className={tw(
          "text-[10px] truncate max-w-[110px] leading-tight",
          isActive
            ? "text-neon-cyan font-semibold drop-shadow-[0_0_5px_rgba(14,210,247,0.4)]"
            : "text-dim opacity-80 group-hover:opacity-100"
        )}
      >
        {session.title}
      </span>
      <button
        onClick={handleDelete}
        className={tw(
          "opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer",
          "text-dim hover:text-neon-pink flex-shrink-0",
          "p-0.5 rounded hover:bg-[var(--bg-sub-accent-55)] hover:shadow-[0_0_4px_rgba(244,86,157,0.2)]"
        )}
        aria-label="Delete chat"
        title="Delete chat"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
