import React from "react";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  messageId: string;
  onRefresh: (messageId: string) => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  messageId,
  onRefresh,
}) => {
  const handleRefresh = () => {
    onRefresh(messageId);
  };

  return (
    <button
      onClick={handleRefresh}
      className="p-1 rounded border-none outline-none bg-transparent hover:bg-[var(--border-defined)] focus-visible:ring-1 focus-visible:ring-neon-cyan transition-all duration-150 flex items-center justify-center group"
      style={{ width: '24px', height: '24px' }}
      title="Regenerate response"
    >
      <RefreshCw size={14} className="text-dim group-hover:text-neon-cyan transition-colors duration-150" />
    </button>
  );
};

