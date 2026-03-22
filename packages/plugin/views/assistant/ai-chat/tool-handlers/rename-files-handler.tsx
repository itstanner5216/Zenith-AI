import React, { useState, useRef, useCallback } from "react";
import { TFile } from "obsidian";
import { App } from "obsidian";
import { usePlugin } from "../../provider";
import { sanitizeFileName } from "../../../../someUtils";
import type { RenameFilesPart, RenameFilesOutput } from "./types";

interface RenameFilesHandlerProps {
  part: RenameFilesPart;
  onResult: (output: RenameFilesOutput) => void;
  app: App;
}

export function RenameFilesHandler({ part, onResult }: RenameFilesHandlerProps) {
  const plugin = usePlugin();
  const [isDone, setIsDone] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const hasExecutedRef = useRef(false);

  const { renames } = part.input;

  const handleRename = useCallback(async () => {
    const renameResults: string[] = [];

    await Promise.all(
      renames.map(async ({ oldPath, newName }) => {
        try {
          const file = plugin.app.vault.getAbstractFileByPath(oldPath);
          if (!(file instanceof TFile)) {
            renameResults.push(`❌ Could not find file: ${oldPath}`);
            return;
          }
          const sanitized = sanitizeFileName(
            newName.endsWith(".md") ? newName.slice(0, -3) : newName,
          );
          const folder = file.parent?.path ?? "";
          const newPath = folder ? `${folder}/${sanitized}.md` : `${sanitized}.md`;
          await plugin.app.fileManager.renameFile(file, newPath);
          renameResults.push(`✅ Renamed: ${file.path} → ${newPath}`);
        } catch (error) {
          renameResults.push(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
    );

    setResults(renameResults);
    setIsDone(true);
    onResult({ success: true, results: renameResults });
  }, [renames, plugin.app, onResult]);

  // Auto-execute single-file renames
  React.useEffect(() => {
    if (!hasExecutedRef.current && !isDone && renames.length === 1 && part.state !== "output-available") {
      hasExecutedRef.current = true;
      setTimeout(() => { handleRename(); }, 100);
    }
  }, [renames.length, isDone, part.state, handleRename]);

  return (
    <div className="flex flex-col space-y-4 p-4 border border-defined">
      <div className="text-foreground">
        Rename {renames.length} file{renames.length !== 1 ? "s" : ""}
      </div>

      {!isDone && renames.length > 1 && (
        <div className="text-sm text-dim">
          <ul className="list-disc ml-4 mt-1">
            {renames.slice(0, 5).map((r, i) => (
              <li key={i}>{r.oldPath} → {r.newName}</li>
            ))}
            {renames.length > 5 && <li>...and {renames.length - 5} more</li>}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="text-sm space-y-1">
          {results.map((result, i) => (
            <div key={i} className={result.startsWith("✅") ? "text-neon-cyan" : "text-neon-pink"}>
              {result}
            </div>
          ))}
        </div>
      )}

      {!isDone && renames.length > 1 && (
        <div className="flex space-x-2">
          <button
            onClick={handleRename}
            className="px-4 py-2 text-xs rounded-md bg-neon-cyan text-primary-foreground font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-glow-cyan-sm"
          >
            Rename {renames.length} Files
          </button>
          <button
            onClick={() => onResult({ success: false, results: [] })}
            className="px-4 py-2 text-xs rounded-md border border-accent-border text-foreground hover:bg-[var(--border-subtle)] hover:border-active hover:text-neon-cyan active:scale-[0.97] transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
