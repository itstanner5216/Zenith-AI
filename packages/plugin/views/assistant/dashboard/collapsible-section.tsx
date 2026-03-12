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
    <div className={`mb-2 rounded-md overflow-hidden transition-all duration-200 ${
      isOpen
        ? 'border border-[rgba(14,210,247,0.14)] shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_8px_rgba(14,210,247,0.06)]'
        : 'border border-[rgba(14,210,247,0.07)] shadow-[0_2px_8px_rgba(0,0,0,0.35)]'
    }`}>
      <Button
        className={`w-full flex justify-between items-center px-3 py-2.5 transition-all duration-150 cursor-pointer ${
          isOpen
            ? 'bg-[#191621] hover:bg-[#1e1a2e]'
            : 'bg-[#100e17] hover:bg-[#191621]'
        }`}
        onClick={onToggle}
        variant="ghost"
      >
        <span className="font-semibold bg-gradient-to-r from-[#87c2fd] to-[#dcb9fc] bg-clip-text text-transparent text-sm tracking-wide">{title}</span>
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
          {isOpen
            ? <ChevronDown className="h-4 w-4 text-[#0fb6d6]" />
            : <ChevronDown className="h-4 w-4 text-[#45aaff] opacity-60" />}
        </span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="bg-[#0d0b12] border-t border-[rgba(14,210,247,0.08)]"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
