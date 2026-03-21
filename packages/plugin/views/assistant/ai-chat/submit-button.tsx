import React from "react";
import { Button } from "./button";

interface SubmitButtonProps {
  isGenerating: boolean;
  className?: string;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isGenerating,
  className = "",
}) => {
  return (
    <Button
      type="submit"
      title={isGenerating ? "Stop generation" : "Send message"}
      className={`flex-none ml-2 font-bold px-3.5 flex items-center justify-center h-full rounded-md transition-all duration-150 ${
        isGenerating
          ? "bg-[var(--bg-sub-accent-55)] text-neon-pink border border-[var(--bg-sub-accent-55)] hover:bg-[var(--bg-sub-accent-55)] hover:border-[var(--bg-sub-accent-55)] hover:shadow-[0_0_10px_rgba(244,86,157,0.25)] cursor-pointer"
          : "bg-neon-cyan hover:bg-[rgba(14,210,247,0.85)] text-primary-foreground active:scale-[0.96] shadow-[0_0_10px_rgba(14,210,247,0.3)] hover:shadow-[0_0_18px_rgba(14,210,247,0.5)] border border-transparent"
      } ${className}`}
    >
      {isGenerating ? (
        /* Stop icon: filled square */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
        >
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      ) : (
        /* Send arrow */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-4.5 h-4.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      )}
    </Button>
  );
}; 