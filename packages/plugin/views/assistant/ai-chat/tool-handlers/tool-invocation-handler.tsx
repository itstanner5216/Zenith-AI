import React from "react";
import { motion } from "framer-motion";
import { App } from "obsidian";
import {
  type PluginToolPart,
  type GetSearchQueryPart,
  type GetLastModifiedFilesPart,
  type OpenFilePart,
  type MoveFilesPart,
  type RenameFilesPart,
  type GetSearchQueryOutput,
  type GetLastModifiedFilesOutput,
  type OpenFileOutput,
  type MoveFilesOutput,
  type RenameFilesOutput,
} from "./types";
import { SearchHandler } from "./search-handler";
import { LastModifiedHandler } from "./last-modified-handler";
import { OpenFileHandler } from "./open-file-handler";
import { MoveFilesHandler } from "./move-files-handler";
import { RenameFilesHandler } from "./rename-files-handler";

const processedToolCallIds = new Set<string>();

interface ToolCallHandlerProps {
  part: PluginToolPart;
  addToolResult: (toolCallId: string, output: unknown) => void;
  app: App;
  chatStatus: string;
}

function ToolCallHandler({
  part,
  addToolResult,
  app,
  chatStatus,
}: ToolCallHandlerProps) {
  const { toolCallId } = part;
  const pendingResultRef = React.useRef<unknown>(null);

  const handleResult = (output: unknown) => {
    if (processedToolCallIds.has(toolCallId)) return;
    if (chatStatus !== "ready") {
      pendingResultRef.current = output;
      return;
    }
    processedToolCallIds.add(toolCallId);
    addToolResult(toolCallId, output);
  };

  React.useEffect(() => {
    if (
      chatStatus === "ready" &&
      pendingResultRef.current !== null &&
      !processedToolCallIds.has(toolCallId)
    ) {
      const output = pendingResultRef.current;
      pendingResultRef.current = null;
      processedToolCallIds.add(toolCallId);
      addToolResult(toolCallId, output);
    }
  }, [chatStatus, toolCallId, addToolResult]);

  const toolTitles: Record<PluginToolPart["type"], string> = {
    "tool-getSearchQuery":      "Searching Notes",
    "tool-getLastModifiedFiles": "Recent File Activity",
    "tool-openFile":            "Opening File",
    "tool-moveFiles":           "Moving Files",
    "tool-renameFiles":         "Renaming Files",
  };

  const renderContent = () => {
    switch (part.type) {
      case "tool-getSearchQuery":
        return (
          <SearchHandler
            part={part as GetSearchQueryPart}
            onResult={(output: GetSearchQueryOutput) => handleResult(output)}
            app={app}
          />
        );
      case "tool-getLastModifiedFiles":
        return (
          <LastModifiedHandler
            part={part as GetLastModifiedFilesPart}
            onResult={(output: GetLastModifiedFilesOutput) => handleResult(output)}
            app={app}
          />
        );
      case "tool-openFile":
        return (
          <OpenFileHandler
            part={part as OpenFilePart}
            onResult={(output: OpenFileOutput) => handleResult(output)}
            app={app}
          />
        );
      case "tool-moveFiles":
        return (
          <MoveFilesHandler
            part={part as MoveFilesPart}
            onResult={(output: MoveFilesOutput) => handleResult(output)}
            app={app}
          />
        );
      case "tool-renameFiles":
        return (
          <RenameFilesHandler
            part={part as RenameFilesPart}
            onResult={(output: RenameFilesOutput) => handleResult(output)}
            app={app}
          />
        );
    }
  };

  return (
    <motion.div
      className="my-1.5 rounded-md overflow-hidden border border-defined shadow-elevation-md bg-depth-3 transition-all duration-200"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-depth-1 border-b border-defined">
        <span
          className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-glow-cyan-sm animate-pulse flex-shrink-0"
          style={{ filter: "drop-shadow(0 0 4px rgba(14,210,247,0.4))" }}
        />
        <h4 className="m-0 text-neon-cyan text-xs font-semibold uppercase tracking-wider">
          {toolTitles[part.type]}
        </h4>
      </div>
      <div className="p-3 text-sm text-foreground">{renderContent()}</div>
    </motion.div>
  );
}

export default ToolCallHandler;
