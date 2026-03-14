import React from "react";
import { FileText } from "lucide-react";
import { Notice } from "obsidian";
import { usePlugin } from "../../provider";

interface AppendButtonProps {
  content: string;
}

export const AppendButton: React.FC<AppendButtonProps> = ({ content }) => {
  const plugin = usePlugin();

  const handleAppend = async () => {
    try {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice("No active note to append to", 3000);
        return;
      }

      const fileContent = await plugin.app.vault.read(activeFile);
      await plugin.app.vault.modify(activeFile, fileContent + "\n\n" + content);
      new Notice(`Appended to ${activeFile.basename}`, 3000);
    } catch (error) {
      new Notice(`Failed to append: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    }
  };

  return (
    <button
      onClick={handleAppend}
      className="p-1 rounded border-none outline-none bg-transparent hover:bg-[rgba(14,210,247,0.08)] focus-visible:ring-1 focus-visible:ring-[var(--border-active)] transition-all duration-150 flex items-center justify-center group"
      style={{ width: '22px', height: '22px' }}
      title="Append to current note"
    >
      <FileText size={14} className="text-[var(--text-dim)] group-hover:text-[var(--text-accent)] transition-colors duration-150" />
    </button>
  );
};
