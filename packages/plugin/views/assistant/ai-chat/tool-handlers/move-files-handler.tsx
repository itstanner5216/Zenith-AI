import React, { useState } from "react";
import { TFile } from "obsidian";
import { usePlugin } from "../../provider";
import { ToolHandlerProps } from "./types";

interface FilePattern {
  namePattern?: string;
  extension?: string;
}

interface MoveOperation {
  sourcePath: string;
  destinationPath: string;
  pattern?: FilePattern;
}

export function MoveFilesHandler({
  toolInvocation,
  handleAddResult,
}: ToolHandlerProps) {
  const plugin = usePlugin();
  const [isValidated, setIsValidated] = useState(false);
  const [moveResults, setMoveResults] = useState<string[]>([]);
  const [filesToMove, setFilesToMove] = useState<TFile[]>([]);

  // Simplified pattern matching without isRoot
  const matchesPattern = (file: TFile, pattern?: FilePattern): boolean => {
    if (!pattern) return true;

    const { namePattern, extension } = pattern;

    // Check file name pattern
    if (namePattern) {
      const globToRegex = (pattern: string): RegExp => {
        // Escape regex metacharacters, then turn '*' into '.*' (match any sequence of chars)
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regexSource = escaped.replace(/\*/g, ".*");
        return new RegExp(regexSource);
      };
      const regex = globToRegex(namePattern);
      if (!regex.test(file.basename)) {
        return false;
      }
    }

    // Check extension
    if (extension && !file.extension.toLowerCase().includes(extension.toLowerCase())) {
      return false;
    }

    return true;
  };

  // Simplified file matching using sourcePath
  const getMatchingFiles = (moveOp: MoveOperation): TFile[] => {
    const allFiles = plugin.app.vault.getMarkdownFiles();
    
    return allFiles.filter(file => {
      // For root path, only match files directly in root
      if (moveOp.sourcePath === "/") {
        return !file.path.includes("/") && matchesPattern(file, moveOp.pattern);
      }
      
      // For specific source paths
      return file.path.startsWith(moveOp.sourcePath) && matchesPattern(file, moveOp.pattern);
    });
  };

  React.useEffect(() => {
    if (!isValidated && !filesToMove.length) {
      const { moves } = toolInvocation.input as any;
      const matchedFiles = moves.flatMap((move: any) => getMatchingFiles(move));
      setFilesToMove(matchedFiles);
    }
  }, [toolInvocation.input, isValidated]);

  const handleMoveFiles = async () => {
    const { moves } = toolInvocation.input as any;
    const results: string[] = [];

    await Promise.all(
      moves.map(async (move: any) => {
        try {
          const matchingFiles = getMatchingFiles(move);
          await plugin.app.vault.createFolder(move.destinationPath).catch((err) => {
            if (!err.message?.includes("already exists")) {
              console.warn(`Could not create folder ${move.destinationPath}: ${err.message}`);
            }
          });

          await Promise.all(
            matchingFiles.map(async (file) => {
              const newPath = `${move.destinationPath}/${file.name}`;
              await plugin.app.fileManager.renameFile(file, newPath);
              results.push(`✅ Moved: ${file.path} → ${newPath}`);
            })
          );

          if (matchingFiles.length === 0) {
            results.push(`ℹ️ No files found matching criteria for ${move.sourcePath}`);
          }
        } catch (error) {
          results.push(`❌ Error: ${error.message}`);
        }
      })
    );

    setMoveResults(results);
    setIsValidated(true);
    handleAddResult(JSON.stringify({ success: true, results }));
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-[rgba(14,210,247,0.08)]">
      <div className="text-[#bebebe]">
        {(toolInvocation.input as any).message || "Ready to move files"}
      </div>

      {!isValidated && filesToMove.length > 0 && (
        <div className="text-sm text-[#45aaff]">
          Found {filesToMove.length} files to move:
          <ul className="list-disc ml-4 mt-1">
            {filesToMove.slice(0, 5).map((file, i) => (
              <li key={i}>{file.path}</li>
            ))}
            {filesToMove.length > 5 && (
              <li>...and {filesToMove.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {moveResults.length > 0 && (
        <div className="text-sm space-y-1">
          {moveResults.map((result, i) => (
            <div 
              key={i}
              className={`${
                result.startsWith("✅") 
                  ? "text-[#0fb6d6]" 
                  : result.startsWith("ℹ️")
                  ? "text-[#45aaff]"
                  : "text-[#f4569d]"
              }`}
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
            className="px-4 py-2 text-xs rounded-md bg-[#0fb6d6] text-[#0d0b12] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
          >
            Move {filesToMove.length} Files
          </button>
          <button
            onClick={() =>
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: "User cancelled file movement",
                })
              )
            }
            className="px-4 py-2 text-xs rounded-md border border-[rgba(14,210,247,0.15)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.45)] hover:text-[#0fb6d6] active:scale-[0.97] transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
} 