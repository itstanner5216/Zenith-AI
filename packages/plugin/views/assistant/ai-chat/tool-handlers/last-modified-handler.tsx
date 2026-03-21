import React, { useRef, useState } from "react";
import { App } from "obsidian";
import { logger } from "../../../../services/logger";
import { addFileReference, useContextItems } from "../use-context-items";
import { ToolHandlerProps } from "./types";

interface LastModifiedArgs {
  count: number;
}

interface FileResult {
  title: string;
  content: string;
  contentPreview?: string;
  contentLength?: number;
  wordCount?: number;
  path: string;
  modified?: number;
  modifiedDate?: string;
  reference: string;
}

export function LastModifiedHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const clearAll = useContextItems(state => state.clearAll);
  const files = useContextItems(state => state.files);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const getLastModifiedFiles = async (count: number): Promise<FileResult[]> => {
    const MAX_FILES = 20;
    const PREVIEW_LENGTH = 300;
    
    const limitedCount = Math.min(count, MAX_FILES);
    
    const allFiles = app.vault.getMarkdownFiles();
    const sortedFiles = allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    const lastModifiedFiles = sortedFiles.slice(0, limitedCount);

    setProgress({ done: 0, total: lastModifiedFiles.length });

    const results: FileResult[] = [];
    for (const file of lastModifiedFiles) {
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
        reference: `Last modified: ${new Date(file.stat.mtime).toLocaleString()}`
      });
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    return results;
  };

  React.useEffect(() => {
    const handleLastModifiedSearch = async () => {
      if (!hasFetchedRef.current && toolInvocation.state !== 'output-available') {
        hasFetchedRef.current = true;
        const { count } = toolInvocation.input as LastModifiedArgs;
        
        try {
          const searchResults = await getLastModifiedFiles(count);
          
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
          
          handleAddResult(JSON.stringify({
            success: true,
            files: minimalResults,
            count: searchResults.length
          }));
        } catch (error) {
          logger.error("Error getting last modified files:", error);
          handleAddResult(JSON.stringify({ 
            success: false,
            error: error.message 
          }));
        }
      }
    };

    handleLastModifiedSearch();
  }, [toolInvocation, handleAddResult, app, clearAll]);

  const fileCount = Object.keys(files).length;
  
  const result = (toolInvocation.state === 'output-available') ? JSON.parse(toolInvocation.output as string) : null;
  const resultCount = result?.count || 0;

  return (
    <div className="text-sm text-dim">
      {toolInvocation.state !== 'output-available' ? (
        `Fetching last modified files... ${progress.total > 0 ? `(${progress.done}/${progress.total})` : ""}`
      ) : resultCount > 0 ? (
        `Found ${resultCount} recently modified files`
      ) : (
        "No recently modified files found"
      )}
    </div>
  );
} 