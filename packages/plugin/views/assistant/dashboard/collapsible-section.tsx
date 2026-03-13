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
            ? 'bg-[var(--bg-depth-3)] hover:bg-[var(--bg-depth-4)]'
            : 'bg-[var(--bg-depth-2)] hover:bg-[var(--bg-depth-3)]'
        }`}
        onClick={onToggle}
        variant="ghost"
      >
        <span className="font-semibold bg-gradient-to-r from-[var(--gradient-blue)] to-[var(--gradient-lavender)] bg-clip-text text-transparent text-sm tracking-wide">{title}</span>
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
          {isOpen
            ? <ChevronDown className="h-4 w-4 text-[var(--text-accent)]" />
            : <ChevronDown className="h-4 w-4 text-[var(--text-dim)] opacity-60" />}
        </span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="bg-[var(--bg-depth-1)] border-t border-[rgba(14,210,247,0.08)]"
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
