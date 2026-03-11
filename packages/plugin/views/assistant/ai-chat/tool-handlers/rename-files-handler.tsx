import React, { useState, useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";
import { usePlugin } from "../../provider";
import { sanitizeFileName } from "../../../../someUtils";

export function RenameFilesHandler({ toolInvocation, handleAddResult, app }: ToolHandlerProps) {
  const plugin = usePlugin();
  const [isDone, setIsDone] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [filesToRename, setFilesToRename] = useState<Array<{oldPath: string; newName: string}>>([]);
  const hasExecutedRef = useRef(false);

  React.useEffect(() => {
    if (!isDone && !filesToRename.length) {
      const { files } = toolInvocation.args;
      setFilesToRename(files);
    }
  }, [toolInvocation.args, isDone]);

  const handleRename = React.useCallback(async () => {
    const { files } = toolInvocation.args;
    const renameResults: string[] = [];

    await Promise.all(
      files.map(async (fileData) => {
        try {
          const existingFile = plugin.app.vault.getAbstractFileByPath(fileData.oldPath);
          if (existingFile && existingFile instanceof TFile) {
            let newName = fileData.newName;
            if (newName.endsWith('.md')) {
              newName = newName.slice(0, -3);
            }
            newName = sanitizeFileName(newName);
            const folderPath = existingFile.parent?.path || '';
            const newPath = folderPath ? `${folderPath}/${newName}.md` : `${newName}.md`;
            await plugin.app.fileManager.renameFile(existingFile, newPath);
            renameResults.push(`✅ Renamed: ${existingFile.path} → ${newPath}`);
          } else {
            renameResults.push(`❌ Could not find file: ${fileData.oldPath}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          renameResults.push(`❌ Error: ${errorMessage}`);
        }
      })
    );

    setResults(renameResults);
    setIsDone(true);
    handleAddResult(JSON.stringify({ success: true, results: renameResults }));
  }, [toolInvocation.args, plugin.app, handleAddResult]);

  // Auto-execute for single file renames (especially current file)
  React.useEffect(() => {
    if (!hasExecutedRef.current && !isDone && filesToRename.length === 1 && !("result" in toolInvocation)) {
      hasExecutedRef.current = true;
      // Small delay to ensure UI is ready
      setTimeout(() => {
        handleRename();
      }, 100);
    }
  }, [filesToRename.length, isDone, toolInvocation, handleRename]);

  return (
    <div className="flex flex-col space-y-4 p-4 border border-[rgba(14,210,247,0.08)]">
      <div className="text-[#bebebe]">
        {toolInvocation.args.message || "Ready to rename files"}
      </div>

      {!isDone && filesToRename.length > 0 && (
        <div className="text-sm text-[#7aa2f7]">
          Found {filesToRename.length} files to rename:
          <ul className="list-disc ml-4 mt-1">
            {filesToRename.slice(0, 5).map((file, i) => (
              <li key={i}>{file.oldPath} → {file.newName}</li>
            ))}
            {filesToRename.length > 5 && (
              <li>...and {filesToRename.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="text-sm space-y-1">
          {results.map((result, i) => (
            <div
              key={i}
              className={`${
                result.startsWith("✅")
                  ? "text-[#50fa7b]"
                  : "text-[#f4569d]"
              }`}
            >
              {result}
            </div>
          ))}
        </div>
      )}

      {!isDone && (
        <div className="flex space-x-2">
          <button
            onClick={handleRename}
            className="px-4 py-2 bg-[#0fb6d6] text-[#0d0b12] hover:bg-[rgba(14,210,247,0.7)]"
          >
            Rename {filesToRename.length} Files
          </button>
          <button
            onClick={() =>
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: "User cancelled file renaming",
                })
              )
            }
            className="px-4 py-2 bg-[rgba(14,210,247,0.08)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.12)]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
