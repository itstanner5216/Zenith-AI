import React from "react";
import { X, MessageSquare } from "lucide-react";
import { ChatSession } from "../services/chat-history-manager";
import { tw } from "../../../../lib/utils";
import { StyledContainer } from "../../../../components/ui/utils";
import moment from "moment";

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  isLoading?: boolean;
}

export function ChatHistorySidebar({
  sessions,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  isOpen = true,
  onToggle,
  isLoading = false,
}: ChatHistorySidebarProps) {
  if (!isOpen) {
    return null;
  }

  const getMessageCount = (session: ChatSession): number => {
    return session.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
  };

  return (
    <StyledContainer>
      <div className={tw("w-64 border-r border-subtle p-2 flex flex-col h-full bg-depth-1")} role="navigation" aria-label="Chat history">
        <div className={tw("text-xs font-semibold bg-gradient-to-r from-dim to-[var(--text-faint)] bg-clip-text text-transparent uppercase mb-2 tracking-wider")}>
          Chat History
        </div>
        <div className={tw("flex-1 overflow-y-auto space-y-1")} role="list">
          {isLoading ? (
            <div className={tw("space-y-2 p-2")}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={tw(
                    "h-10 rounded-lg zenith-shimmer border border-subtle"
                  )}
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className={tw("flex flex-col items-center justify-center py-8 text-center")}>
              <MessageSquare className="h-8 w-8 text-dim mb-3 opacity-30" />
              <p className="text-xs text-foreground opacity-50">No chat history yet</p>
              <p className="text-xs text-foreground mt-1 opacity-30">Start a conversation to see it here</p>
            </div>
          ) : (
            sessions.map((session) => {
              const messageCount = getMessageCount(session);
              const relativeTime = moment(session.updatedAt).fromNow();

              return (
                <div
                  key={session.id}
                  className={tw(
                    "group p-2 rounded-md cursor-pointer text-sm transition-all duration-150",
                    activeChatId === session.id
                      ? "bg-[var(--border-defined)] border-l-2 border-neon-cyan shadow-[0_0_6px_rgba(14,210,247,0.2),0_2px_8px_rgba(0,0,0,0.4)]"
                      : "border-l-2 border-transparent hover:bg-depth-3 hover:border-accent-border hover:shadow-elevation-md"
                  )}
                  onClick={() => onSelectChat(session.id)}
                  role="listitem"
                  aria-label={`${session.title} - ${relativeTime}`}
                >
                  <div className={tw("flex items-start justify-between gap-2")}>
                    <div className={tw("flex-1 min-w-0")}>
                      <div className={tw(
                        "truncate",
                        activeChatId === session.id
                          ? "font-semibold text-neon-cyan drop-shadow-[0_0_4px_rgba(14,210,247,0.3)]"
                          : "font-medium text-foreground"
                      )}>
                        {session.title}
                      </div>
                      <div className={tw("text-xs text-dim mt-0.5 flex items-center gap-2 opacity-60")}>
                        <span>{relativeTime}</span>
                        {messageCount > 0 && (
                          <>
                            <span>·</span>
                            <span>{messageCount} messages</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(session.id);
                      }}
                      className={tw(
                        "opacity-0 group-hover:opacity-100 transition-all duration-150",
                        "hover:text-neon-pink flex-shrink-0",
                        "p-1 rounded hover:bg-[var(--bg-sub-accent-55)]"
                      )}
                      aria-label="Delete chat"
                      title="Delete chat"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </StyledContainer>
  );
}
