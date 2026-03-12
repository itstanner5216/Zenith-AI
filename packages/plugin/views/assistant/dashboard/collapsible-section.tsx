import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * A generic collapsible panel for each major feature section
 */
export function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="mb-2 border border-[rgba(14,210,247,0.08)] rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
      <Button
        className="w-full flex justify-between items-center px-3 py-2.5 bg-[#100e17] hover:bg-[#191621] active:scale-[0.99] transition-all duration-150"
        onClick={onToggle}
        variant="ghost"
      >
        <span className="font-semibold bg-gradient-to-r from-[#87c2fd] to-[#dcb9fc] bg-clip-text text-transparent text-sm tracking-wide">{title}</span>
        {isOpen
          ? <ChevronUp className="h-4 w-4 text-[#45aaff]" />
          : <ChevronDown className="h-4 w-4 text-[#45aaff]" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="bg-[#0d0b12] border-t border-[rgba(14,210,247,0.05)]"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
