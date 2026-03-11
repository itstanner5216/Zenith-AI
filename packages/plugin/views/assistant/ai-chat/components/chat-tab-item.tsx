import React from "react";
import { X } from "lucide-react";
import { ChatSession } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import { moment } from "obsidian";

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
        "group flex items-center gap-1.5 px-2 py-1 rounded-t cursor-pointer transition-all duration-150",
        "border-b-2",
        isActive
          ? "border-[#0fb6d6] bg-[#100e17] shadow-[0_0_6px_rgba(14,210,247,0.12)]"
          : "border-transparent bg-transparent hover:bg-[rgba(14,210,247,0.05)] hover:border-[rgba(14,210,247,0.2)]"
      )}
      onClick={onSelect}
      title={`${session.title} - ${relativeTime}`}
    >
      <span
        className={tw(
          "text-[10px] truncate max-w-[120px]",
          isActive ? "text-[#0fb6d6] font-medium" : "text-[#7aa2f7]"
        )}
      >
        {session.title}
      </span>
      <button
        onClick={handleDelete}
        className={tw(
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:text-[#f4569d] flex-shrink-0",
          "p-0.5 rounded hover:bg-[rgba(244,86,157,0.1)]"
        )}
        aria-label="Delete chat"
        title="Delete chat"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
