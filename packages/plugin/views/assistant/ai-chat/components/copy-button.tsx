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
      className="p-0.5 rounded outline-none border-none shadow-none bg-transparent hover:shadow-sm transition-shadow flex items-center justify-center"
      style={{ boxShadow: 'none', width: '20px', height: '20px', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title="Copy to clipboard"
    >
      <Copy size={16} className="text-[#7aa2f7] hover:text-[#0fb6d6]" />
    </button>
  );
};
