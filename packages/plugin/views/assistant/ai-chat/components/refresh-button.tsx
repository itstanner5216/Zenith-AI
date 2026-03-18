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
      className="p-1 rounded border-none outline-none bg-transparent hover:bg-[rgba(14,210,247,0.08)] focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.45)] transition-all duration-150 flex items-center justify-center group"
      style={{ width: '24px', height: '24px' }}
      title="Regenerate response"
    >
      <RefreshCw size={14} className="text-[#45aaff] group-hover:text-[#0fb6d6] transition-colors duration-150" />
    </button>
  );
};

