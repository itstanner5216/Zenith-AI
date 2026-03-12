import * as React from "react";
import { motion } from "framer-motion";
import { tw } from "@/lib/utils";

// Confidence Badge Component
const ConfidenceBadge: React.FC<{ score: number }> = ({ score }) => {
  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "bg-[rgba(14,210,247,0.15)] text-[#0fb6d6]";
    if (score >= 60) return "bg-[rgba(122,162,247,0.15)] text-[#45aaff]";
    return "bg-[rgba(190,190,190,0.1)] text-[#bebebe]";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return "High";
    if (score >= 60) return "Med";
    return "Low";
  };

  return (
    <span
      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${getConfidenceColor(score)}`}
      title={`Confidence: ${score}%`}
    >
      {getConfidenceLabel(score)}
    </span>
  );
};

// Base Folder Button Component
const BaseFolderButton: React.FC<{
  folder: string;
  onClick: (folder: string) => void;
  className?: string;
  score?: number;
  reason?: string;
}> = ({ folder, onClick, className, score, reason }) => (
  <motion.button
    className={`px-2.5 py-1 text-xs transition-all duration-150 active:scale-[0.96] ${className} flex items-center justify-between rounded-md`}
    onClick={() => onClick(folder)}
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.85 }}
    transition={{ duration: 0.15 }}
    title={`Reason: ${reason}`}
  >
    <span className="truncate max-w-[120px]">{folder}</span>
    {score !== undefined && <ConfidenceBadge score={score} />}
  </motion.button>
);

// Existing Folder Button Component
export const ExistingFolderButton: React.FC<{
  folder: string;
  onClick: (folder: string) => void;
  score: number;
  reason: string;
}> = props => (
  <BaseFolderButton
    {...props}
    className="bg-[rgba(14,210,247,0.08)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.18)] hover:text-[#0fb6d6] border border-solid border-[rgba(14,210,247,0.25)] hover:border-[rgba(14,210,247,0.55)] hover:shadow-[0_0_6px_rgba(14,210,247,0.15)]"
  />
);

// New Folder Button Component
export const NewFolderButton: React.FC<{
  folder: string;
  onClick: (folder: string) => void;
  score: number;
  reason: string;
}> = props => (
  <BaseFolderButton
    {...props}
    className="bg-[rgba(14,210,247,0.03)] text-[#45aaff] hover:bg-[rgba(14,210,247,0.12)] hover:text-[#0fb6d6] border border-dashed border-[rgba(14,210,247,0.2)] hover:border-[rgba(14,210,247,0.45)] hover:shadow-[0_0_4px_rgba(14,210,247,0.1)]"
  />
);
