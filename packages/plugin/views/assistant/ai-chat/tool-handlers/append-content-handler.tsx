import React from "react";
import { usePlugin } from "../../provider";
import { TFile } from "obsidian";

interface AppendContentProps {
  toolInvocation: any;
  handleAddResult: (result: string) => void;
}

export function AppendContentHandler({
  toolInvocation,
  handleAddResult,
}: AppendContentProps) {
  const plugin = usePlugin();
  const [isValidated, setIsValidated] = React.useState(false);

  const handleAppendContent = async () => {
    try {
      const { content, fileName } = toolInvocation.args;
      const activeFile = fileName
        ? plugin.app.vault.getAbstractFileByPath(fileName)
        : plugin.app.workspace.getActiveFile();

      if (activeFile) {
        const currentContent = await plugin.app.vault.read(activeFile as TFile);
        if (!(activeFile instanceof TFile)) {
          throw new Error("Active file is not a TFile");
        }
        await plugin.app.vault.modify(
          activeFile,
          currentContent + "\n\n" + content
        );
        setIsValidated(true);
        handleAddResult(
          JSON.stringify({
            success: true,
            message: `Content appended to ${activeFile.name}`,
          })
        );
      } else {
        handleAddResult(
          JSON.stringify({
            success: false,
            message: "No active file found to append content to",
          })
        );
      }
    } catch (error) {
      console.error("Error appending content:", error);
      handleAddResult(
        JSON.stringify({
          success: false,
          message: "Failed to append content to file",
        })
      );
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <div className="text-[#bebebe]">
        {toolInvocation.args.message ||
          "Would you like to append the following content?"}
      </div>

      <div className="bg-[#0d0b12] p-3 rounded border border-[rgba(14,210,247,0.06)]">
        <pre className="text-sm text-[#7aa2f7] whitespace-pre-wrap">
          {toolInvocation.args.content}
        </pre>
      </div>

      {!isValidated && (
        <div className="flex space-x-2">
          <button
            onClick={handleAppendContent}
            className="px-4 py-2 text-xs rounded-md bg-[#0fb6d6] text-[#0d0b12] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
          >
            Append Content
          </button>
          <button
            onClick={() =>
              handleAddResult(
                JSON.stringify({
                  success: false,
                  message: "User declined to append content",
                })
              )
            }
            className="px-4 py-2 text-xs rounded-md border border-[rgba(14,210,247,0.15)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.3)] hover:text-[#0fb6d6] active:scale-[0.97] transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
