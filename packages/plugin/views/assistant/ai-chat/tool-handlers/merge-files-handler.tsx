import React, { useRef, useState } from "react";
import { App, TFile, Notice } from "obsidian";
import { ToolInvocation } from "ai";
import { resolveFile } from "./resolve-file";

interface MergeFilesHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function MergeFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: MergeFilesHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [validFiles, setValidFiles] = useState<TFile[]>([]);
  const [invalidPaths, setInvalidPaths] = useState<string[]>([]);

  const hasAutoRunRef = useRef(false);

  React.useEffect(() => {
    const validateFiles = () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { sourceFiles } = toolInvocation.args;

        const valid: TFile[] = [];
        const invalid: string[] = [];
        const seenPaths = new Set<string>();

        sourceFiles.forEach((path: string) => {
          const file = resolveFile(app, path);
          if (file instanceof TFile) {
            if (!seenPaths.has(file.path)) {
              seenPaths.add(file.path);
              valid.push(file);
            }
          } else {
            invalid.push(path);
          }
        });

        setValidFiles(valid);
        setInvalidPaths(invalid);
      }
    };

    validateFiles();
  }, [toolInvocation, app]);

  // Auto-execute merge when all paths resolved and no destructive options, so the chat can complete without requiring a click
  React.useEffect(() => {
    if (
      hasAutoRunRef.current ||
      "result" in toolInvocation ||
      validFiles.length < 2 ||
      invalidPaths.length > 0
    ) {
      return;
    }
    const { deleteSource = false, outputFileName, outputFolder = "" } = toolInvocation.args;
    if (deleteSource) return;
    const outputPath = outputFolder
      ? `${outputFolder}/${outputFileName}.md`
      : `${outputFileName}.md`;
    if (app.vault.getAbstractFileByPath(outputPath) instanceof TFile) {
      return; // Output exists: show confirm UI so user can choose overwrite or cancel
    }

    hasAutoRunRef.current = true;
    const run = async () => {
      const { separator = "\n\n---\n\n" } = toolInvocation.args;
      try {
        const contents = await Promise.all(
          validFiles.map((file) => app.vault.read(file))
        );
        const mergedContent = contents.join(separator);
        await app.vault.create(outputPath, mergedContent);
        setIsDone(true);
        new Notice(`Merged ${validFiles.length} files into "${outputFileName}.md"`);
        handleAddResult(
          JSON.stringify({
            success: true,
            mergedFile: outputPath,
            sourceFileCount: validFiles.length,
            deletedSource: false,
            message: `Merged ${validFiles.length} files into "${outputFileName}.md"`,
          })
        );
      } catch (err) {
        hasAutoRunRef.current = false;
        setIsDone(true);
        new Notice(`Failed to merge: ${(err as Error).message}`);
        handleAddResult(
          JSON.stringify({ success: false, error: (err as Error).message })
        );
      }
    };
    run();
  }, [
    toolInvocation,
    validFiles,
    invalidPaths,
    app,
    handleAddResult,
  ]);

  const handleConfirmMerge = async () => {
    const {
      outputFileName,
      outputFolder = "",
      separator = "\n\n---\n\n",
      deleteSource = false,
    } = toolInvocation.args;

    try {
      const contents = await Promise.all(
        validFiles.map((file) => app.vault.read(file))
      );

      // Merge contents
      const mergedContent = contents.join(separator);

      // Determine output path
      const outputPath = outputFolder
        ? `${outputFolder}/${outputFileName}.md`
        : `${outputFileName}.md`;

      // Create merged file
      const existingFile = app.vault.getAbstractFileByPath(outputPath);
      if (existingFile instanceof TFile) {
        // File exists, ask to overwrite
        const confirmOverwrite = confirm(
          `File "${outputFileName}.md" already exists. Overwrite?`
        );
        if (!confirmOverwrite) {
          setIsDone(true);
          handleAddResult(
            JSON.stringify({
              success: false,
              message: "User cancelled merge (file already exists)",
            })
          );
          return;
        }
        await app.vault.modify(existingFile, mergedContent);
      } else {
        // Create new file
        await app.vault.create(outputPath, mergedContent);
      }

      // Delete source files if requested
      if (deleteSource) {
        await Promise.all(validFiles.map((file) => app.vault.trash(file, false)));
      }

      setIsDone(true);

      const message = deleteSource
        ? `Merged ${validFiles.length} files into "${outputFileName}.md" and deleted source files`
        : `Merged ${validFiles.length} files into "${outputFileName}.md"`;

      new Notice(message);

      handleAddResult(
        JSON.stringify({
          success: true,
          mergedFile: outputPath,
          sourceFileCount: validFiles.length,
          deletedSource: deleteSource,
          message,
        })
      );
    } catch (error) {
      setIsDone(true);
      new Notice(`Failed to merge files: ${error.message}`);
      handleAddResult(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    }
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled merge",
      })
    );
  };

  const {
    message: reason,
    outputFileName,
    deleteSource = false,
  } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#50fa7b] text-xs">
          {isDone && !isConfirmed ? "✗ Merge cancelled" : "✓ Files merged"}
        </div>
      </div>
    );
  }

  if (validFiles.length === 0 && invalidPaths.length > 0) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#f4569d] text-xs">
          ✗ No valid files to merge. All paths were invalid.
        </div>
      </div>
    );
  }

  if (validFiles.length < 2) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#f4569d] text-xs">
          ✗ Need at least 2 files to merge.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div className="flex items-start gap-2">
        <span className="text-[#0fb6d6] text-lg">⚡</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#bebebe] mb-1">
            Confirm Merge
          </div>
          <div className="text-xs text-[#7aa2f7] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#7aa2f7] uppercase">
          Files to merge ({validFiles.length})
        </div>
        {validFiles.slice(0, 5).map((file) => (
          <div key={file.path} className="text-[#bebebe] pl-2">
            • {file.basename}
          </div>
        ))}
        {validFiles.length > 5 && (
          <div className="text-[rgba(122,162,247,0.4)] pl-2">
            ...and {validFiles.length - 5} more
          </div>
        )}
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#7aa2f7] uppercase">
          Output file
        </div>
        <div className="text-[#bebebe] pl-2">📄 {outputFileName}.md</div>
      </div>

      {invalidPaths.length > 0 && (
        <div className="text-xs text-[#f4569d]">
          ⚠ {invalidPaths.length} invalid path(s) will be skipped
        </div>
      )}

      {deleteSource && (
        <div className="p-2 bg-[#191621] text-xs text-[#ffb74d] border border-[rgba(255,183,77,0.2)] rounded" style={{ textShadow: '0 0 8px rgba(255,183,77,0.3)' }}>
          <strong>⚠ Warning:</strong> Source files will be moved to trash after
          merge
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[rgba(14,210,247,0.15)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.3)] hover:text-[#0fb6d6] active:scale-[0.97] transition-all duration-150"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            handleConfirmMerge();
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[#0fb6d6] text-[#0d0b12] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
        >
          Merge {validFiles.length} Files
        </button>
      </div>
    </div>
  );
}
