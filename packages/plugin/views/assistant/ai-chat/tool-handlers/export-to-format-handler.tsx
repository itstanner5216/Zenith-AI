import React, { useRef, useState } from "react";
import { App, TFile, Notice } from "obsidian";
import { ToolInvocation } from "ai";

interface ExportToFormatHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function ExportToFormatHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ExportToFormatHandlerProps) {
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

        filePaths.forEach((path: string) => {
          const file = app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) {
            valid.push(file);
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

  const stripFrontmatter = (content: string): string => {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return content.replace(frontmatterRegex, "");
  };

  const handleConfirmExport = async () => {
    const {
      format,
      outputFolder = "Exports",
      includeMetadata = false,
    } = toolInvocation.args;

    try {
      // Ensure export folder exists
      const folderExists = app.vault.getAbstractFileByPath(outputFolder);
      if (!folderExists) {
        await app.vault.createFolder(outputFolder);
      }

      let exportedCount = 0;
      const exportedFiles: string[] = [];
      const errors: string[] = [];

      for (const file of validFiles) {
        try {
          let content = await app.vault.read(file);

          // Remove frontmatter if requested
          if (!includeMetadata) {
            content = stripFrontmatter(content);
          }

          const baseName = file.basename;
          let exportedContent = content;
          let extension = format;

          // Format-specific processing
          if (format === "html") {
            // Basic markdown to HTML conversion
            exportedContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${baseName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; background: var(--bg-depth-2); color: var(--text-normal); }
    h1 { color: var(--text-accent); font-size: 2em; margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
    h2, h3, h4, h5, h6 { color: var(--text-title-h2); margin-top: 24px; margin-bottom: 16px; font-weight: 600; padding-bottom: 8px; border-bottom: 1px solid; border-image: linear-gradient(to right, var(--text-sub-accent), var(--bg-depth-2), var(--bg-depth-2), var(--bg-depth-2)) 1; }
    a { color: var(--text-accent); }
    code { background: var(--bg-depth-3); color: rgba(14, 210, 247, 0.9); padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; border: 1px solid rgba(14, 210, 247, 0.12); }
    pre { background: var(--bg-depth-3); padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid rgba(14, 210, 247, 0.08); }
    pre code { color: var(--text-normal); border: none; background: transparent; }
    blockquote { border-left: 3px solid rgba(14, 210, 247, 0.5); padding-left: 16px; color: var(--text-dim); background: linear-gradient(135deg, rgba(32, 28, 41, 0.45), var(--bg-depth-2)); margin: 1em 0; padding: 8px 16px; border-radius: 0 4px 4px 0; }
    table { border-collapse: collapse; width: 100%; }
    th { background: var(--bg-depth-3); color: var(--text-accent); border: 1px solid rgba(14, 210, 247, 0.1); padding: 6px 12px; text-align: left; }
    td { border: 1px solid rgba(14, 210, 247, 0.06); padding: 5px 12px; color: var(--text-normal); }
    hr { border: none; height: 1px; background: linear-gradient(to right, transparent, rgba(14, 210, 247, 0.15), transparent); margin: 12px 0; }
  </style>
</head>
<body>
${content.replace(/\n/g, "<br>\n")}
</body>
</html>`;
          } else if (format === "txt") {
            // Plain text - strip markdown formatting
            exportedContent = content
              .replace(/#{1,6}\s/g, "") // Remove heading markers
              .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold
              .replace(/\*(.+?)\*/g, "$1") // Remove italic
              .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Remove links, keep text
              .replace(/`(.+?)`/g, "$1"); // Remove inline code
          } else if (format === "pdf") {
            // PDF export is not directly supported in Obsidian plugin
            // Would need external library or API
            errors.push(
              `${file.path}: PDF export requires external converter (not yet implemented)`
            );
            continue;
          }

          // Create export file
          const exportPath = `${outputFolder}/${baseName}.${extension}`;
          const existingExport = app.vault.getAbstractFileByPath(exportPath);

          if (existingExport) {
            await app.vault.modify(existingExport as TFile, exportedContent);
          } else {
            await app.vault.create(exportPath, exportedContent);
          }

          exportedFiles.push(exportPath);
          exportedCount++;
        } catch (error) {
          errors.push(`${file.path}: ${error.message}`);
        }
      }

      setIsDone(true);

      const message = `Exported ${exportedCount} file(s) to ${format.toUpperCase()}`;

      new Notice(message);

      handleAddResult(
        JSON.stringify({
          success: true,
          exportedCount,
          format,
          outputFolder,
          exportedFiles,
          message,
          errors: errors.length > 0 ? errors : undefined,
        })
      );
    } catch (error) {
      setIsDone(true);
      new Notice(`Export failed: ${error.message}`);
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
        message: "User cancelled export",
      })
    );
  };

  const {
    format,
    outputFolder = "Exports",
    includeMetadata = false,
    message: reason,
  } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[var(--border-defined)] pb-2">
        <div className="text-[var(--text-accent)] text-xs">
          {isDone && !isConfirmed ? "✗ Export cancelled" : "✓ Export complete"}
        </div>
      </div>
    );
  }

  if (validFiles.length === 0) {
    return (
      <div className="text-sm border-b border-[var(--border-defined)] pb-2">
        <div className="text-[var(--text-sub-accent)] text-xs">
          ✗ No valid files to export.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 bg-[var(--bg-depth-3)] border border-[var(--border-defined)] rounded-md shadow-elevation-md">
      <div className="flex items-start gap-2">
        <span className="text-[var(--text-accent)] text-lg">📤</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--text-normal)] mb-1">
            Confirm Export
          </div>
          <div className="text-xs text-[var(--text-dim)] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[var(--text-dim)] uppercase">
          Export Settings
        </div>
        <div className="p-2 bg-[var(--bg-depth-1)] rounded border border-[var(--border-subtle)] space-y-1">
          <div className="text-[var(--text-normal)]">
            <strong>Format:</strong> {format.toUpperCase()}
          </div>
          <div className="text-[var(--text-normal)]">
            <strong>Output:</strong> {outputFolder}/
          </div>
          <div className="text-[var(--text-normal)]">
            <strong>Metadata:</strong> {includeMetadata ? "Included" : "Excluded"}
          </div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[var(--text-dim)] uppercase">
          Files to Export ({validFiles.length})
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

      {format === "pdf" && (
        <div className="p-2 bg-[var(--bg-depth-3)] text-xs text-[var(--text-warning)] border border-[rgba(255,183,77,0.2)] rounded" style={{ textShadow: '0 0 8px rgba(255,183,77,0.3)' }}>
          <strong>⚠ Note:</strong> PDF export is not yet fully implemented
        </div>
      )}

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
            handleConfirmExport();
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[var(--text-accent)] text-[var(--bg-depth-1)] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
        >
          Export {validFiles.length} File{validFiles.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
