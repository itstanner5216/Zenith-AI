import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
}

/**
 * Obsidianite-themed progress bar with neon glow
 */
export function ProgressBar({ value }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="h-1.5 bg-[#0d0b12] rounded-full overflow-hidden border border-[rgba(14,210,247,0.08)]">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${clampedValue}%`,
          background: 'linear-gradient(90deg, #0fb6d6, #3dd7fb)',
          boxShadow: '0 0 8px rgba(14,210,247,0.4)',
        }}
      />
    </div>
  );
}
