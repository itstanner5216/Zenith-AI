import React from "react";
import { motion } from "framer-motion";

interface SelectedItemProps {
  item: string;
  prefix: string;
  onClick: () => void;
  onRemove: () => void;
}

export const SelectedItem: React.FC<SelectedItemProps> = ({
  item,
  prefix,
  onClick,
  onRemove,
}) => (
  <motion.div
    className="bg-[#0d0b12] text-[#bebebe] rounded px-2 py-1 text-sm m-1 flex gap-1 min-w-fit h-fit border border-[rgba(14,210,247,0.15)] hover:border-[rgba(14,210,247,0.3)] transition-colors"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.2 }}
  >
    <span
      onClick={onClick}
      className="cursor-pointer hover:text-[#0fb6d6] transition-colors"
    >
      {prefix}
      {item}
    </span>
    <div
      onClick={onRemove}
      className="text-[#7aa2f7] hover:text-[#f4569d] cursor-pointer transition-colors"
    >
      ×
    </div>
  </motion.div>
);
