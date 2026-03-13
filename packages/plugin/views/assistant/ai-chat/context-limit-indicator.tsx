import React from "react";
import { init, get_encoding } from "tiktoken/init";
import wasmBinary from "tiktoken/tiktoken_bg.wasm";
import { useDebouncedCallback } from "use-debounce";
import { logger } from "../../../services/logger";
import { useContextItems } from "./use-context-items";

interface TokenStats {
  contextSize: number;
  percentUsed: number;
}

export function ContextLimitIndicator({
  unifiedContext,
  maxContextSize,
}: {
  unifiedContext: string;
  maxContextSize: number;
}) {
  const [stats, setStats] = React.useState<TokenStats>({
    contextSize: 0,
    percentUsed: 0,
  });
  const [error, setError] = React.useState<string>();
  const [tiktokenInitialized, setTiktokenInitialized] = React.useState(false);
  const { isLightweightMode, toggleLightweightMode } = useContextItems();

  // Initialize encoder once on mount
  React.useEffect(() => {
    async function setup() {
      try {
        if (!tiktokenInitialized) {
          await init(imports => WebAssembly.instantiate(wasmBinary, imports));
          setTiktokenInitialized(true);
        }
      } catch (e) {
        setError("Failed to initialize token counter");
      }
    }

    setup();
  }, []);

  // Debounced token calculation
  const calculateTokens = useDebouncedCallback((text: string) => {
    if (!text || !tiktokenInitialized) return;
    const encoder = get_encoding("cl100k_base");

    try {
      const tokens = encoder.encode(text);
      logger.debug("tokens", { tokens });
      setStats({
        contextSize: tokens.length,
        percentUsed: (tokens.length / maxContextSize) * 100,
      });
    } catch {
      setError("Token counting failed");
    } finally {
      encoder.free();
    }
  }, 300);

  // Update tokens when context changes
  React.useEffect(() => {
    calculateTokens(unifiedContext);
  }, [unifiedContext]);

  if (error) {
    return (
      <div className="mt-2 p-2 rounded text-xs text-[var(--text-sub-accent)] border border-[rgba(244,86,157,0.3)]">
        {error}
      </div>
    );
  }

  const isOverLimit = stats.contextSize > maxContextSize;
  const shouldWarn = stats.percentUsed > 80;

  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

  return (
    <div className="mt-2 space-y-2 flex">
      <div className="relative">
        <div
          className={`px-2 py-1 min-w-max rounded-md text-xs flex gap-1.5 items-center justify-between cursor-pointer hover:bg-[rgba(14,210,247,0.06)] transition-all duration-150
          ${
            isOverLimit
              ? "border border-[rgba(244,86,157,0.35)] text-[var(--text-sub-accent)] shadow-[0_0_6px_rgba(244,86,157,0.15)]"
              : shouldWarn
              ? "border border-[rgba(255,183,77,0.35)] text-[var(--text-warning)] shadow-[0_0_6px_rgba(255,183,77,0.2)]"
              : "border border-[var(--border-defined)] text-[var(--text-dim)] hover:border-[var(--border-accent)]"
          }`}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          <span>
            {isOverLimit
              ? "Context size exceeds maximum"
              : shouldWarn
              ? "Context size nearing limit"
              : "Context used"}
          </span>
          <span className="font-mono">{stats.percentUsed.toFixed(0)}%</span>
        </div>

        {/* Enhanced menu-style tooltip - renders above, stays open on hover */}
        <div
          className={`absolute left-0 bottom-full mb-1 w-72 bg-[var(--bg-depth-3)] border border-[var(--border-accent)] rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_8px_rgba(14,210,247,0.12)] transition-opacity z-20 ${
            isTooltipOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          <div
            onClick={toggleLightweightMode}
            className={`w-full px-4 py-3.5 text-left text-xs flex items-center gap-3 hover:bg-[rgba(14,210,247,0.08)] cursor-pointer rounded-md
              ${
                isLightweightMode
                  ? "text-[var(--text-accent)]"
                  : "text-[var(--text-normal)]"
              }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
              ${
                isLightweightMode
                  ? "border-[var(--text-accent)] bg-[var(--text-accent)]"
                  : "border-[var(--text-dim)] bg-[var(--bg-depth-1)]"
              }`}
            >
              {isLightweightMode && (
                <svg
                  className="w-3.5 h-3.5 text-[var(--bg-depth-2)]"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="font-medium">Disable Context</div>
              <div className="text-[var(--text-dim)] text-[11px] leading-relaxed opacity-70">
                Removes file content from context while preserving metadata.
                Useful for batch operations like moving, renaming, or tagging
                files.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
