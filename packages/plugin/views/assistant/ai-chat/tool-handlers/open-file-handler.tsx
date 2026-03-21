import React, { useRef } from "react";
import { TFile } from "obsidian";
import { ToolHandlerProps } from "./types";

interface OpenFileArgs {
  filePath: string;
}

export function OpenFileHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);

  React.useEffect(() => {
    const execute = async () => {
      if (!hasFetchedRef.current && toolInvocation.state !== 'output-available') {
        hasFetchedRef.current = true;
        const args = toolInvocation.input as OpenFileArgs;

        try {
          // Get the file from the vault
          const file = app.vault.getAbstractFileByPath(args.filePath);

          if (!(file instanceof TFile)) {
            handleAddResult(
              JSON.stringify({
                success: false,
                message: `File not found: ${args.filePath}`,
              })
            );
            return;
          }

          // Open the file in a new leaf
          const leaf = app.workspace.getLeaf("tab");
          await leaf.openFile(file);

          handleAddResult(
            JSON.stringify({
              success: true,
              message: `Opened ${file.basename}`,
            })
          );
        } catch (error) {
          handleAddResult(
            JSON.stringify({
              success: false,
              message: `Error opening file: ${(error as Error).message}`,
            })
          );
        }
      }
    };

    execute();
  }, [toolInvocation, handleAddResult, app]);

  const args = toolInvocation.input as OpenFileArgs;
  const isComplete = toolInvocation.state === 'output-available';

  return (
    <div className="text-sm text-[#45aaff]">
      {!isComplete ? `Opening ${args.filePath}...` : `File opened`}
    </div>
  );
}
