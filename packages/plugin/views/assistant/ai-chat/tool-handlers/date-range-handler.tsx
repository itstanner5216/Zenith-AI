import React, { useRef, useState } from "react";
import { moment } from "obsidian";
import { logger } from "../../../../services/logger";
import { addFileReference, useContextItems } from "../use-context-items";
import { ToolHandlerProps } from "./types";

interface DateRangeArgs {
  startDate: string;
  endDate: string;
}

export function DateRangeHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const clearAll = useContextItems(state => state.clearAll);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const filterNotesByDateRange = async (startDate: string, endDate: string) => {
    const MAX_RESULTS = 50;
    const PREVIEW_LENGTH = 300;
    
    const allFiles = app.vault.getMarkdownFiles();

    const start = window.moment(startDate).startOf("day");
    const end = window.moment(endDate).endOf("day");

    const filteredFiles = allFiles.filter(file => {
      const fileDate = window.moment(file.stat.mtime);
      const isWithinDateRange = fileDate.isBetween(start, end, null, "[]");
      const isSystemFolder = file.path.startsWith(".") ||
                           file.path.includes("templates/") ||
                           file.path.includes("backup/");
      return isWithinDateRange && !isSystemFolder;
    });

    const limitedFiles = filteredFiles.slice(0, MAX_RESULTS);
    setProgress({ done: 0, total: limitedFiles.length });

    const results = [];
    for (const file of limitedFiles) {
      const content = await app.vault.read(file);
      results.push({
        title: file.basename,
        content: content,
        contentPreview: content.slice(0, PREVIEW_LENGTH) + (content.length > PREVIEW_LENGTH ? '...' : ''),
        contentLength: content.length,
        wordCount: content.split(/\s+/).length,
        path: file.path,
        modified: file.stat.mtime,
        modifiedDate: new Date(file.stat.mtime).toLocaleString(),
        reference: `Date range: ${startDate} to ${endDate}`,
      });
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    return results;
  };

  React.useEffect(() => {
    const handleDateRangeSearch = async () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { startDate, endDate } = toolInvocation.args as DateRangeArgs;
        
        try {
          const searchResults = await filterNotesByDateRange(startDate, endDate);
          
          clearAll();
          
          searchResults.forEach(file => {
            addFileReference({
              path: file.path,
              title: file.title,
              contentPreview: file.contentPreview,
              contentLength: file.contentLength,
              wordCount: file.wordCount,
              modified: file.modified,
              modifiedDate: file.modifiedDate,
            });
          });
          
          const minimalResults = searchResults.map(({ content, ...rest }) => rest);
          handleAddResult(JSON.stringify(minimalResults));
        } catch (error) {
          logger.error("Error filtering notes by date:", error);
          handleAddResult(JSON.stringify({ error: error.message }));
        }
      }
    };

    handleDateRangeSearch();
  }, [toolInvocation, handleAddResult, app, clearAll]);

  const files = useContextItems(state => state.files);
  const fileCount = Object.keys(files).length;

  return (
    <div className="text-sm text-[#7aa2f7]">
      {!("result" in toolInvocation) 
        ? `Filtering notes by date range... ${progress.total > 0 ? `(${progress.done}/${progress.total})` : ""}`
        : fileCount > 0
        ? `Found ${fileCount} notes within the specified date range`
        : "No files found within the specified date range"}
    </div>
  );
} 