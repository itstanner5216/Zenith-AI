import React from "react";
import { Copy } from "lucide-react";
import { Notice } from "obsidian";

interface CopyButtonProps {
  content: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      new Notice("Copied to clipboard", 2000);
    } catch (error) {
      new Notice(`Failed to copy: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded border-none outline-none bg-transparent hover:bg-[var(--border-defined)] focus-visible:ring-1 focus-visible:ring-neon-cyan transition-all duration-150 flex items-center justify-center group"
      style={{ width: '22px', height: '22px' }}
      title="Copy to clipboard"
    >
      <Copy size={14} className="text-dim group-hover:text-neon-cyan transition-colors duration-150" />
    </button>
  );
};
