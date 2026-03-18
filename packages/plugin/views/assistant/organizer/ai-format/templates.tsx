import * as React from "react";
import { TFile, Notice } from "obsidian";
import ZenithAI from "../../../../index";
import { UserTemplates } from "./user-templates";
import { DEFAULT_SETTINGS } from "../../../../settings";
import { logger } from "../../../../services/logger";

interface ClassificationBoxProps {
  plugin: ZenithAI;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onFileRename?: (newFile: TFile) => void;
  onTokenLimitError?: (error: string) => void;
}

export const ClassificationContainer: React.FC<ClassificationBoxProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onFileRename,
  onTokenLimitError,
}) => {
  const [formatBehavior, setFormatBehavior] = React.useState<
    "override" | "newFile" | "append"
  >(plugin.settings.formatBehavior || DEFAULT_SETTINGS.formatBehavior);
  const [backupFile, setBackupFile] = React.useState<string | null>(null);

  const handleFormat = async (templateName: string) => {
    if (!file) {
      logger.error("No file selected");
      return;
    }
    try {
      let fileContent = await plugin.app.vault.read(file);
      if (typeof fileContent !== "string") {
        throw new Error("File content is not a string");
      }

      const formattingInstruction = await plugin.getTemplateInstructions(
        templateName
      );

      if (formatBehavior === "override") {
        await plugin.streamFormatInCurrentNote({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      } else if (formatBehavior === "newFile") {
        await plugin.streamFormatInSplitView({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      } else if (formatBehavior === "append") {
        // Placeholder for append logic:
        // will not create a backup file
        // will append to the end of the current note
        await plugin.streamFormatAppendInCurrentNote({
          file: file,
          content: fileContent,
          formattingInstruction: formattingInstruction,
        });
      }
    } catch (error) {
      logger.error("Error in handleFormat:", error);
    }
  };

  const handleRevert = async () => {
    if (!file || !backupFile) return;

    try {
      const backupTFile = plugin.app.vault.getAbstractFileByPath(
        backupFile
      ) as TFile;
      if (!backupTFile) {
        throw new Error("Backup file not found");
      }

      const backupContent = await plugin.app.vault.read(backupTFile);
      await plugin.app.vault.modify(file, backupContent);
      new Notice("Successfully reverted to backup version", 3000);
    } catch (error) {
      logger.error("Error reverting to backup:", error);
    }
  };

  const extractBackupFile = React.useCallback((content: string) => {
    const match = content.match(/\[\[(.+?)\s*\|\s*Link to original file\]\]/);
    if (match) {
      setBackupFile(match[1]);
    } else {
      setBackupFile(null);
    }
  }, []);

  React.useEffect(() => {
    if (content) {
      extractBackupFile(content);
    }
  }, [content, extractBackupFile]);

  const handleFormatBehaviorChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newBehavior = event.target.value as "override" | "newFile" | "append";
    setFormatBehavior(newBehavior);
    plugin.settings.formatBehavior = newBehavior;
    await plugin.saveSettings();
  };

  return (
    <div>
      <div className="font-semibold my-3 text-[#0fb6d6]">🗳️ AI Templates</div>
      <div className="bg-[#191621] text-[#bebebe] p-4 space-y-4 border-b border-[rgba(14,210,247,0.05)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center space-x-2">
          <label htmlFor="formatBehavior" className="font-medium">
            Format Behavior:
          </label>
          <select
            id="formatBehavior"
            value={formatBehavior}
            onChange={handleFormatBehaviorChange}
            className="px-2 py-1 border border-[rgba(14,210,247,0.08)] bg-[#0d0b12] text-[#bebebe] rounded focus:outline-none focus:border-[rgba(14,210,247,0.45)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] transition-all duration-150 appearance-none cursor-pointer"
          >
            <option value="override">Replace</option>
            <option value="newFile">New File</option>
            <option value="append">Append</option>
          </select>
          <div className="flex justify-between items-center">
            {backupFile && (
              <button
                onClick={handleRevert}
                className="px-3 py-1 text-sm bg-[rgba(244,86,157,0.15)] text-[#f4569d] border border-[rgba(244,86,157,0.4)] rounded hover:bg-[rgba(244,86,157,0.25)] transition-colors"
              >
                Revert
              </button>
            )}
          </div>
        </div>
        <UserTemplates
          plugin={plugin}
          file={file}
          content={content}
          refreshKey={refreshKey}
          onFormat={handleFormat}
          onTokenLimitError={onTokenLimitError}
        />
      </div>
    </div>
  );
};
