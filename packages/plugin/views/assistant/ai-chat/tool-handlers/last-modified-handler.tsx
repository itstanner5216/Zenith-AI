import React, { useRef, useState } from "react";
import { App } from "obsidian";
import { logger } from "../../../../services/logger";
import { addFileReference, useContextItems } from "../use-context-items";
import type { GetLastModifiedFilesPart, GetLastModifiedFilesOutput, LastModifiedFile } from "./types";

interface LastModifiedHandlerProps {
  part: GetLastModifiedFilesPart;
  onResult: (output: GetLastModifiedFilesOutput) => void;
  app: App;
}

export function LastModifiedHandler({ part, onResult, app }: LastModifiedHandlerProps) {
  const hasFetchedRef = useRef(false);
  const clearAll = useContextItems(state => state.clearAll);
  const files = useContextItems(state => state.files);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const getLastModifiedFiles = async (count: number): Promise<LastModifiedFile[]> => {
    const MAX_FILES = 20;
    const PREVIEW_LENGTH = 300;
    const limited = Math.min(count, MAX_FILES);

    const allFiles = app.vault.getMarkdownFiles();
    const sorted = allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    const recent = sorted.slice(0, limited);

    setProgress({ done: 0, total: recent.length });
    const results: LastModifiedFile[] = [];

    for (const file of recent) {
      const content = await app.vault.read(file);
      results.push({
        title: file.basename,
        contentPreview: content.slice(0, PREVIEW_LENGTH) + (content.length > PREVIEW_LENGTH ? "..." : ""),
        contentLength: content.length,
        wordCount: content.split(/\s+/).length,
        path: file.path,
        modified: file.stat.mtime,
        modifiedDate: new Date(file.stat.mtime).toLocaleString(),
        reference: `Last modified: ${new Date(file.stat.mtime).toLocaleString()}`,
      });
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    return results;
  };

  React.useEffect(() => {
    const run = async () => {
      if (hasFetchedRef.current || part.state === "output-available") return;
      hasFetchedRef.current = true;
      try {
        const results = await getLastModifiedFiles(part.input.count ?? 10);
        clearAll();
        results.forEach(file => addFileReference({
          path: file.path,
          title: file.title,
          contentPreview: file.contentPreview,
          contentLength: file.contentLength,
          wordCount: file.wordCount,
          modified: file.modified,
          modifiedDate: file.modifiedDate,
        }));
        onResult({ success: true, files: results, count: results.length });
      } catch (error) {
        logger.error("Error getting last modified files:", error);
        onResult({ success: false, files: [], count: 0 });
      }
    };
    run();
  }, [part, onResult, app, clearAll]);

  const fileCount = Object.keys(files).length;
  const resultCount = part.state === "output-available" ? part.output.count : 0;

  return (
    <div className="text-sm text-dim">
      {part.state !== "output-available" ? (
        `Fetching last modified files... ${progress.total > 0 ? `(${progress.done}/${progress.total})` : ""}`
      ) : resultCount > 0 ? (
        `Found ${resultCount} recently modified files`
      ) : (
        "No recently modified files found"
      )}
    </div>
  );
}
