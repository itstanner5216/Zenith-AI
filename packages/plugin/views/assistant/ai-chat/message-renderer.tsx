import React from "react";
import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { AIMarkdown } from "./ai-message-renderer";
import { UserMarkdown } from "./user-message-renderer";
import { UIMessage, isToolUIPart, isTextUIPart } from "ai";
import { usePlugin } from "../provider";
import { Attachment } from "./types/attachments";
import { AppendButton } from "./components/append-button";
import { CopyButton } from "./components/copy-button";
import { RefreshButton } from "./components/refresh-button";

interface MessageRendererProps {
  message: UIMessage & {
    experimental_attachments?: Attachment[];
    createdAt?: number;
  };
  onMessageRefresh?: (messageId: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  onMessageRefresh,
}) => {
  const plugin = usePlugin();

  // Format timestamp - use createdAt if available, otherwise fallback to message ID timestamp or current time
  const getTimestamp = () => {
    if (message.createdAt) {
      return window.moment(message.createdAt).format("MMM D, YYYY h:mm A");
    }
    // Try to extract timestamp from message ID if it contains one
    const idMatch = message.id.match(/\d+/);
    if (idMatch) {
      const timestamp = parseInt(idMatch[0]);
      if (timestamp > 1000000000000) {
        // Looks like a timestamp (milliseconds)
        return window.moment(timestamp).format("MMM D, YYYY h:mm A");
      }
    }
    // Fallback to relative time or current time
    return window.moment().format("MMM D, YYYY h:mm A");
  };

  const timestamp = getTimestamp();

  // Only hide message if it has tool parts that are NOT complete (no results yet)
  // If all tool parts have results, we should still render the message content
  const toolParts = message.parts?.filter(isToolUIPart) ?? [];
  if (toolParts.length > 0) {
    const allToolsComplete = toolParts.every(p => p.state === 'output-available');
    if (!allToolsComplete) {
      return null;
    }
  }

  // In v5, text content lives in TextUIPart parts, not message.content
  const textContent = message.parts
    .filter(isTextUIPart)
    .map(p => p.text)
    .join("");

  if (textContent.length === 0 && toolParts.length === 0) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <motion.div
      className={`flex items-start gap-3 py-2.5 ${
        isUser
          ? "bg-depth-3 hover:bg-depth-4 border border-[var(--bg-sub-accent-55)] border-l-2 border-l-neon-pink rounded-md px-3 my-1 shadow-[0_4px_12px_rgba(0,0,0,0.5),0_0_6px_rgba(244,86,157,0.2)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(244,86,157,0.35)] hover:translate-y-[-0.5px] transition-all duration-200"
          : "bg-depth-2 hover:bg-depth-3 border border-defined hover:border-accent-border border-l-2 border-l-neon-cyan rounded-md px-3 my-1 shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_12px_rgba(14,210,247,0.35)] hover:translate-y-[-0.5px] transition-all duration-200"
      }`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Icon on the left - top-aligned with small padding to match text baseline */}
      <div className="flex-shrink-0 w-8 h-8 flex items-start justify-center pt-[2px]">
        {isUser ? (
          <User size={16} className="text-neon-pink drop-shadow-[0_0_4px_rgba(244,86,157,0.4)]" />
        ) : (
          <Bot size={16} className="text-neon-cyan drop-shadow-[0_0_4px_rgba(14,210,247,0.4)]" />
        )}
      </div>

      {/* Message content - top-aligned, consistent line height */}
      <div className="flex-1 min-w-0 flex flex-col leading-snug">
        <div
          className="text-sm leading-snug m-0 text-foreground"
          style={{ marginTop: 0, paddingTop: 0, marginLeft: 0, paddingLeft: 0 }}
        >
          {isUser ? (
            <UserMarkdown content={textContent} />
          ) : (
            <AIMarkdown content={textContent} app={plugin.app} />
          )}
        </div>

        {/* Timestamp and buttons row - perfectly aligned */}
        <div className="flex items-baseline justify-between mt-1 gap-2">
          <div className="text-xs text-dim flex-shrink-0 opacity-80">
            {timestamp}
          </div>
          {/* Action buttons on the right - at same baseline as timestamp */}
          {message.role === "assistant" && (
            <div className="flex-shrink-0 flex flex-row gap-0.5 items-center">
              {onMessageRefresh && (
                <RefreshButton
                  messageId={message.id}
                  onRefresh={onMessageRefresh}
                />
              )}
              <AppendButton content={textContent} />
              <CopyButton content={textContent} />
            </div>
          )}
        </div>

        {message.experimental_attachments &&
          message.experimental_attachments.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {message.experimental_attachments.map((attachment, index) => (
                <div
                  key={`${attachment.name || index}`}
                  className="relative group"
                >
                  {attachment.contentType?.startsWith("image/") ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-depth-3 rounded">
                      <svg
                        className="h-8 w-8 text-dim"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {attachment.url && (
                    <div className="absolute inset-0 bg-depth-1 bg-opacity-0 group-hover:bg-opacity-75 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100 rounded">
                      <a
                        href={attachment.url}
                        download={attachment.name}
                        className="text-neon-cyan text-sm bg-depth-2 bg-opacity-90 px-3 py-1 rounded-full border border-active"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </motion.div>
  );
};
