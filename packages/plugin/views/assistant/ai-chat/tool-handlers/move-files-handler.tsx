import React, { useState } from "react";
import { TFile } from "obsidian";
import { App } from "obsidian";
import { usePlugin } from "../../provider";
import type { MoveFilesPart, MoveFilesOutput } from "./types";

interface MoveFilesHandlerProps {
  part: MoveFilesPart;
  onResult: (output: MoveFilesOutput) => void;
  app: App;
}

export function MoveFilesHandler({ part, onResult }: MoveFilesHandlerProps) {
  const plugin = usePlugin();
  const [isValidated, setIsValidated] = useState(false);
  const [moveResults, setMoveResults] = useState<string[]>([]);

  const { filePaths, destinationFolder } = part.input;

  const getFilesToMove = (): TFile[] =>
    filePaths
      .map(p => plugin.app.vault.getAbstractFileByPath(p))
      .filter((f): f is TFile => f instanceof TFile);

  const handleMoveFiles = async () => {
    const results: string[] = [];
    const filesToMove = getFilesToMove();

    try {
      await plugin.app.vault.createFolder(destinationFolder).catch(err => {
        if (!err.message?.includes("already exists")) {
          console.warn(`Could not create folder ${destinationFolder}: ${err.message}`);
        }
      });

      await Promise.all(
        filesToMove.map(async file => {
          const newPath = `${destinationFolder}/${file.name}`;
          await plugin.app.fileManager.renameFile(file, newPath);
          results.push(`✅ Moved: ${file.path} → ${newPath}`);
        }),
      );

      if (filesToMove.length === 0) {
        results.push(`ℹ️ No matching files found`);
      }
    } catch (error) {
      results.push(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    setMoveResults(results);
    setIsValidated(true);
    onResult({ success: true, results });
  };

  const filesToMove = getFilesToMove();

  return (
    <div className="flex flex-col space-y-4 p-4 border border-defined">
      <div className="text-foreground">
        Move {filesToMove.length} file{filesToMove.length !== 1 ? "s" : ""} to <span className="font-mono text-neon-cyan">{destinationFolder}</span>
      </div>

      {!isValidated && filesToMove.length > 0 && (
        <div className="text-sm text-dim">
          <ul className="list-disc ml-4 mt-1">
            {filesToMove.slice(0, 5).map((file, i) => (
              <li key={i}>{file.path}</li>
            ))}
            {filesToMove.length > 5 && <li>...and {filesToMove.length - 5} more</li>}
          </ul>
        </div>
      )}

      {moveResults.length > 0 && (
        <div className="text-sm space-y-1">
          {moveResults.map((result, i) => (
            <div
              key={i}
              className={
                result.startsWith("✅")
                  ? "text-neon-cyan"
                  : result.startsWith("ℹ️")
                    ? "text-dim"
                    : "text-neon-pink"
              }
            >
              {result}
            </div>
          ))}
        </div>
      )}

      {!isValidated && (
        <div className="flex space-x-2">
          <button
            onClick={handleMoveFiles}
            className="px-4 py-2 text-xs rounded-md bg-neon-cyan text-primary-foreground font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-glow-cyan-sm"
          >
            Move {filesToMove.length} Files
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
