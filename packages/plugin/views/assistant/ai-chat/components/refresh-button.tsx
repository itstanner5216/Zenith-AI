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
      className="p-0.5 rounded outline-none border-none shadow-none bg-transparent hover:shadow-sm transition-shadow flex items-center justify-center"
      style={{ boxShadow: 'none', width: '20px', height: '20px', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title="Regenerate response"
    >
      <RefreshCw size={16} className="text-[#7aa2f7] hover:text-[#0fb6d6]" />
    </button>
  );
};

