import React from "react";
import { motion } from "framer-motion";
import { App } from "obsidian";
import { ToolUIPart, getToolName } from "ai";
import { SearchHandler } from "./search-handler";
import { LastModifiedHandler } from "./last-modified-handler";
import { OpenFileHandler } from "./open-file-handler";
import { MoveFilesHandler } from "./move-files-handler";
import { RenameFilesHandler } from "./rename-files-handler";

const processedToolCallIds = new Set<string>();

interface ToolCallHandlerProps {
  toolInvocation: ToolUIPart;
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  app: App;
  chatStatus: string;
}

function ToolCallHandler({
  toolInvocation,
  addToolResult,
  app,
  chatStatus,
}: ToolCallHandlerProps) {
  const toolCallId = toolInvocation.toolCallId;
  const toolName = getToolName(toolInvocation);
  const pendingResultRef = React.useRef<string | null>(null);

  const handleAddResult = (result: string) => {
    if (processedToolCallIds.has(toolCallId)) {
      console.log("[ToolCallHandler] Skipping duplicate addToolResult for:", toolCallId);
      return;
    }
    if (chatStatus !== "ready") {
      console.log("[ToolCallHandler] Deferring addToolResult until stream finishes for:", toolCallId, "status:", chatStatus);
      pendingResultRef.current = result;
      return;
    }
    processedToolCallIds.add(toolCallId);
    console.log("[ToolCallHandler] Calling addToolResult for:", toolCallId);
    addToolResult({ toolCallId, result });
  };

  // Flush pending result when chat status becomes "ready"
  React.useEffect(() => {
    if (chatStatus === "ready" && pendingResultRef.current !== null && !processedToolCallIds.has(toolCallId)) {
      const result = pendingResultRef.current;
      pendingResultRef.current = null;
      processedToolCallIds.add(toolCallId);
      console.log("[ToolCallHandler] Flushing deferred addToolResult for:", toolCallId);
      addToolResult({ toolCallId, result });
    }
  }, [chatStatus, toolCallId, addToolResult]);

  const getToolTitle = (toolName: string) => {
    const toolTitles = {
      getSearchQuery: "Searching Notes",
      getLastModifiedFiles: "Recent File Activity",
      moveFiles: "Moving Files",
      renameFiles: "Renaming Files",
      openFile: "Opening File",
    };
    return toolTitles[toolName] ;
  };

  const renderContent = () => {
    // Debug: Log tool name matching
    console.log("[ToolCallHandler] Rendering tool:", {
      toolName: toolName,
      toolCallId: toolInvocation.toolCallId,
    });
    
    const handlers = {
      getSearchQuery: () => (
        <SearchHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      getLastModifiedFiles: () => (
        <LastModifiedHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      openFile: () => (
        <OpenFileHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      moveFiles: () => (
        <MoveFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),
      renameFiles: () => (
        <RenameFilesHandler
          toolInvocation={toolInvocation}
          handleAddResult={handleAddResult}
          app={app}
        />
      ),

    };

    const handler = handlers[toolName];
    if (!handler) {
      console.error("[ToolCallHandler] No handler found for tool:", toolName);
      if (toolInvocation.state !== 'output-available') {
        handleAddResult(
          JSON.stringify({ error: `Unknown tool: ${toolName}` })
        );
      }
      return (
        <div className="text-xs text-[#f4569d] p-2">
          Unknown tool: {toolName}
        </div>
      );
    }
    return handler();
  };

  const content = renderContent();
  
  return (
    <motion.div
      className="my-1.5 rounded-md overflow-hidden border border-[rgba(14,210,247,0.08)] shadow-elevation-md bg-[#191621] transition-all duration-200"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Tool header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0b12] border-b border-[rgba(14,210,247,0.08)]">
        {/* Pulsing indicator dot */}
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#0fb6d6] shadow-glow-cyan-sm animate-pulse flex-shrink-0"
          style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}
        />
        <h4 className="m-0 text-[#0fb6d6] text-xs font-semibold uppercase tracking-wider">
          {getToolTitle(toolName) || toolName}
        </h4>
      </div>
      {/* Tool content */}
      <div className="p-3 text-sm text-[#bebebe]">{content}</div>
    </motion.div>
  );
}

export default ToolCallHandler;

