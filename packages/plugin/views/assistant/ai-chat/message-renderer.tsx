import React from "react";
import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import { AIMarkdown } from "./ai-message-renderer";
import { UserMarkdown } from "./user-message-renderer";
import { Message } from "ai";
import { usePlugin } from "../provider";
import { Attachment } from "./types/attachments";
import { AppendButton } from "./components/append-button";
import { CopyButton } from "./components/copy-button";
import { RefreshButton } from "./components/refresh-button";

interface MessageRendererProps {
  message: Message & {
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

  // Only hide message if it has tool invocations that are NOT complete (no results yet)
  // If all tool invocations have results, we should still render the message content
  if (message.toolInvocations) {
    const allToolsComplete = message.toolInvocations.every(
      (tool: any) => "result" in tool
    );
    // If tools are still executing, don't render the message yet
    // But if all tools are complete, render the message content
    if (!allToolsComplete) {
      return null;
    }
  }
  if (message.content.length === 0) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <motion.div
      className={`flex items-start gap-3 py-2.5 ${
        isUser
          ? "bg-[#191621] hover:bg-[rgba(244,86,157,0.08)] border border-[rgba(244,86,157,0.12)] border-l-2 border-l-[rgba(244,86,157,0.4)] rounded-md px-3 my-1 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-150"
          : "border-l-2 border-[rgba(14,210,247,0.25)] pl-3 my-1"
      }`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Icon on the left - top-aligned with small padding to match text baseline */}
      <div className="flex-shrink-0 w-8 h-8 flex items-start justify-center pt-[2px]">
        {isUser ? (
          <User size={16} className="text-[#f4569d]" />
        ) : (
          <Bot size={16} className="text-[#0fb6d6]" />
        )}
      </div>

      {/* Message content - top-aligned, consistent line height */}
      <div className="flex-1 min-w-0 flex flex-col leading-snug">
        <div
          className="text-sm leading-snug m-0 text-[#bebebe]"
          style={{ marginTop: 0, paddingTop: 0, marginLeft: 0, paddingLeft: 0 }}
        >
          {isUser ? (
            <UserMarkdown content={message.content} />
          ) : (
            <AIMarkdown content={message.content} app={plugin.app} />
          )}
        </div>

        {/* Timestamp and buttons row - perfectly aligned */}
        <div className="flex items-baseline justify-between mt-1 gap-2">
          <div className="text-xs text-[#7aa2f7] flex-shrink-0" style={{ opacity: 0.6 }}>
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
              <AppendButton content={message.content} />
              <CopyButton content={message.content} />
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
                    <div className="w-full h-32 flex items-center justify-center bg-[#191621] rounded">
                      <svg
                        className="h-8 w-8 text-[#7aa2f7]"
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
                    <div className="absolute inset-0 bg-[#0d0b12] bg-opacity-0 group-hover:bg-opacity-75 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100 rounded">
                      <a
                        href={attachment.url}
                        download={attachment.name}
                        className="text-[#0fb6d6] text-sm bg-[#100e17] bg-opacity-90 px-3 py-1 rounded-full border border-[rgba(14,210,247,0.3)]"
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
