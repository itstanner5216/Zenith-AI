import React, { useRef } from "react";
import { TFile } from "obsidian";
import { App } from "obsidian";
import type { OpenFilePart, OpenFileOutput } from "./types";

interface OpenFileHandlerProps {
  part: OpenFilePart;
  onResult: (output: OpenFileOutput) => void;
  app: App;
}

export function OpenFileHandler({ part, onResult, app }: OpenFileHandlerProps) {
  const hasFetchedRef = useRef(false);

  React.useEffect(() => {
    const run = async () => {
      if (hasFetchedRef.current || part.state === "output-available") return;
      hasFetchedRef.current = true;
      try {
        const file = app.vault.getAbstractFileByPath(part.input.filePath);
        if (!(file instanceof TFile)) {
          onResult({ success: false, message: `File not found: ${part.input.filePath}` });
          return;
        }
        const leaf = app.workspace.getLeaf("tab");
        await leaf.openFile(file);
        onResult({ success: true, message: `Opened ${file.basename}` });
      } catch (error) {
        onResult({ success: false, message: `Error opening file: ${(error as Error).message}` });
      }
    };
    run();
  }, [part, onResult, app]);

  return (
    <div className="text-sm text-dim">
      {part.state !== "output-available"
        ? `Opening ${part.input.filePath}...`
        : "File opened"}
    </div>
  );
}
