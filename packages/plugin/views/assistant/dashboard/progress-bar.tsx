import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
}

/**
 * Obsidianite-themed progress bar with neon glow
 */
export function ProgressBar({ value }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const isNearFull = clampedValue > 90;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Progress</span>
        <span className={`text-[10px] font-semibold ${
          isNearFull ? 'text-[var(--text-sub-accent)]' : 'text-[var(--text-accent)]'
        }`}>{clampedValue}%</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-depth-1)] rounded-full overflow-hidden border border-[var(--border-defined)]" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedValue}%`,
            background: isNearFull
              ? 'linear-gradient(90deg, var(--text-sub-accent), rgba(244,86,157,0.7))'
              : 'linear-gradient(90deg, var(--text-accent), var(--interactive-accent-rgb))',
            boxShadow: isNearFull
              ? '0 0 8px rgba(244,86,157,0.5)'
              : '0 0 8px rgba(14,210,247,0.5)',
          }}
        />
      </div>
    </div>
  );
}
