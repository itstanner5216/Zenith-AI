import * as React from "react";
import { motion } from "framer-motion";

interface ErrorBoxProps {
  message: string;
  description?: string;
  actionButton?: React.ReactNode;
}

export const ErrorBox: React.FC<ErrorBoxProps> = ({
  message,
  description,
  actionButton,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-[#191621] border border-[rgba(244,86,157,0.15)] rounded-md"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#f4569d] font-medium mb-1">
              {message}
            </div>
            {description && (
              <p className="text-sm text-[#7aa2f7]">
                {description}
              </p>
            )}
          </div>
        </div>
        
        {actionButton && (
          <div className="flex items-center gap-2 mt-4">
            {actionButton}
          </div>
        )}
      </div>
    </motion.div>
  );
};
