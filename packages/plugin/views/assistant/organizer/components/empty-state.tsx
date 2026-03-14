import * as React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  message: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  message, 
  showRefresh = false, 
  onRefresh,
  showDelete = false,
  onDelete
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-depth-3)] border border-[var(--border-defined)] rounded-md w-full max-w-md mx-auto mt-4 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="text-6xl mb-4"
      >
        📝
      </motion.div>
      <motion.p 
        className="text-lg text-[var(--text-dim)] mb-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.p>
      <div className="flex gap-2">
        {showRefresh && onRefresh && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-[rgba(14,210,247,0.1)] text-[var(--text-accent)] border border-[var(--border-active)] rounded-md hover:bg-[rgba(14,210,247,0.2)] hover:border-[var(--border-active)] hover:shadow-[0_0_10px_rgba(14,210,247,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-active)] transition-all duration-150 cursor-pointer active:scale-[0.97]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Refresh</span>
          </motion.button>
        )}
        {showDelete && onDelete && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onDelete}
            className="flex items-center space-x-2 px-4 py-2 bg-[rgba(244,86,157,0.1)] text-[var(--text-sub-accent)] border border-[rgba(244,86,157,0.3)] rounded-md hover:bg-[rgba(244,86,157,0.2)] hover:border-[rgba(244,86,157,0.6)] hover:shadow-[0_0_10px_rgba(244,86,157,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-active)] transition-all duration-150 cursor-pointer active:scale-[0.97]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
          </motion.button>
        )}
      </div>
    </div>
  );
};
