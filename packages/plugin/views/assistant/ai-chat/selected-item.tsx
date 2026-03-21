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
    className="bg-depth-3 text-foreground rounded px-2 py-1 text-sm m-1 flex gap-1 min-w-fit h-fit border border-defined hover:border-accent-border hover:shadow-glow-cyan-sm transition-all duration-150"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.2 }}
  >
    <span
      onClick={onClick}
      className="cursor-pointer hover:text-neon-cyan transition-colors duration-150"
    >
      {prefix}
      {item}
    </span>
    <div
      onClick={onRemove}
      className="text-dim hover:text-neon-pink hover:drop-shadow-[0_0_4px_rgba(244,86,157,0.3)] cursor-pointer transition-all duration-150"
    >
      ×
    </div>
  </motion.div>
);
