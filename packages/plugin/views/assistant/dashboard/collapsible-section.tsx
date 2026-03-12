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
    <div className="mb-2 border border-[rgba(14,210,247,0.08)] rounded-md overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
      <Button
        className="w-full flex justify-between items-center px-3 py-2.5 bg-[#0d0b12] hover:bg-[rgba(14,210,247,0.06)] active:scale-[0.99] transition-all duration-150"
        onClick={onToggle}
        variant="ghost"
      >
        <span className="font-semibold text-[#0fb6d6] text-sm tracking-wide">{title}</span>
        {isOpen
          ? <ChevronUp className="h-4 w-4 text-[#45aaff]" />
          : <ChevronDown className="h-4 w-4 text-[#45aaff]" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="bg-[#100e17] border-t border-[rgba(14,210,247,0.06)]"
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
