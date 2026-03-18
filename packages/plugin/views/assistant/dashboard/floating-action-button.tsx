import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
}

/**
 * Simple FAB in bottom-right corner:
 *   - 'label' may be dynamic based on current note or plugin context
 */
export function FloatingActionButton({
  label,
  onClick,
}: FloatingActionButtonProps) {
  return (
    <motion.div
      className="fixed bottom-4 right-4"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        className="rounded-full flex items-center gap-2 bg-[#0fb6d6] text-[#0d0b12] font-semibold shadow-[0_0_20px_rgba(14,210,247,0.4)] hover:bg-[rgba(14,210,247,0.85)] hover:shadow-[0_0_30px_rgba(14,210,247,0.6)] transition-all duration-300 border border-[rgba(14,210,247,0.45)]"
        onClick={onClick}
        size="lg"
      >
        <Sparkles className="h-4 w-4" />
        {label}
      </Button>
    </motion.div>
  );
} 