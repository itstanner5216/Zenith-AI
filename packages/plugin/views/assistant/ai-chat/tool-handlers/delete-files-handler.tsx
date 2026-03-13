import React, { useRef, useState } from "react";
import { App, TFile, Notice } from "obsidian";
import { ToolInvocation } from "ai";
import { resolveFile } from "./resolve-file";
import { useContextItems } from "../use-context-items";

interface DeleteFilesHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function DeleteFilesHandler({
  toolInvocation,
  handleAddResult,
  app,
}: DeleteFilesHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [validFiles, setValidFiles] = useState<TFile[]>([]);
  const [invalidPaths, setInvalidPaths] = useState<string[]>([]);

  React.useEffect(() => {
    const validateFiles = () => {
      if (!hasFetchedRef.current && !("result" in toolInvocation)) {
        hasFetchedRef.current = true;
        const { filePaths } = toolInvocation.args;

        const valid: TFile[] = [];
        const invalid: string[] = [];
        const seenPaths = new Set<string>();

        filePaths.forEach((path: string) => {
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

  const handleConfirmDelete = async () => {
    const { permanentDelete = false } = toolInvocation.args;

    const results: Array<{ path: string; success: boolean; error?: string }> = [];
    let deletedCount = 0;
    let failedCount = 0;

    for (const file of validFiles) {
      try {
        // Move to trash by default, permanent delete if requested
        await app.vault.trash(file, permanentDelete);
        results.push({ path: file.path, success: true });
        deletedCount++;
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error.message,
        });
        failedCount++;
      }
    }

    setIsDone(true);

    const message = permanentDelete
      ? `Permanently deleted ${deletedCount} file(s)`
      : `Moved ${deletedCount} file(s) to trash`;

    const resultMessage =
      failedCount > 0
        ? `${message}, ${failedCount} failed`
        : message;

    new Notice(resultMessage);

    const deletedPaths = new Set(
      results.filter((r) => r.success).map((r) => r.path)
    );
    if (deletedPaths.size > 0) {
      const store = useContextItems.getState();
      deletedPaths.forEach((path) => store.removeItem("file", path));
      if (store.currentFile && deletedPaths.has(store.currentFile.path)) {
        store.setCurrentFile(null);
      }
    }

    handleAddResult(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        failed: failedCount,
        message: resultMessage,
        errors: results.filter((r) => !r.success).map((r) => `${r.path}: ${r.error}`),
      })
    );
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled deletion",
      })
    );
  };

  const { reason, permanentDelete = false } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[var(--border-defined)] pb-2">
        <div className="text-[var(--text-accent)] text-xs">
          {isDone && !isConfirmed ? "✗ Deletion cancelled" : "✓ Files deleted"}
        </div>
      </div>
    );
  }

  if (validFiles.length === 0 && invalidPaths.length > 0) {
    return (
      <div className="text-sm border-b border-[var(--border-defined)] pb-2">
        <div className="text-[var(--text-sub-accent)] text-xs">
          ✗ No valid files to delete. All paths were invalid.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 bg-[var(--bg-depth-3)] border border-[var(--border-defined)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div className="flex items-start gap-2">
        <span className="text-[var(--text-sub-accent)] text-lg">⚠</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--text-normal)] mb-1">
            Confirm Deletion
          </div>
          <div className="text-xs text-[var(--text-dim)] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[var(--text-dim)] uppercase">
          Files to delete ({validFiles.length})
        </div>
        {validFiles.slice(0, 5).map((file) => (
          <div key={file.path} className="text-[var(--text-normal)] pl-2">
            • {file.basename}
          </div>
        ))}
        {validFiles.length > 5 && (
          <div className="text-[rgba(122,162,247,0.4)] pl-2">
            ...and {validFiles.length - 5} more
          </div>
        )}
      </div>

      {invalidPaths.length > 0 && (
        <div className="text-xs text-[var(--text-sub-accent)]">
          ⚠ {invalidPaths.length} invalid path(s) will be skipped
        </div>
      )}

      <div className="p-2 bg-[var(--bg-depth-3)] text-xs text-[var(--text-warning)] border border-[rgba(255,183,77,0.2)] rounded" style={{ textShadow: '0 0 8px rgba(255,183,77,0.3)' }}>
        {permanentDelete ? (
          <>
            <strong>⚠ Permanent deletion:</strong> Files cannot be recovered
          </>
        ) : (
          <>Files will be moved to trash (can be recovered)</>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[var(--border-accent)] text-[var(--text-normal)] hover:bg-[rgba(14,210,247,0.06)] hover:border-[var(--border-active)] hover:text-[var(--text-accent)] active:scale-[0.97] transition-all duration-150"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            handleConfirmDelete();
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[var(--text-sub-accent)] text-[var(--bg-depth-1)] font-semibold hover:bg-[rgba(244,86,157,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(244,86,157,0.25)] hover:shadow-[0_0_10px_rgba(244,86,157,0.4)]"
        >
          Delete {validFiles.length} File{validFiles.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
