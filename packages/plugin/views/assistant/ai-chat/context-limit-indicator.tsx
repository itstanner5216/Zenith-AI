import React from "react";
import { init, get_encoding } from "tiktoken/init";
import wasmBinary from "tiktoken/tiktoken_bg.wasm";
import { useDebouncedCallback } from "use-debounce";
import { logger } from "../../../services/logger";

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
      <div className="mt-2 p-2 rounded text-xs text-[#f4569d] border border-[rgba(244,86,157,0.3)]">
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
              ? "border border-[rgba(244,86,157,0.35)] text-[#f4569d] shadow-[0_0_6px_rgba(244,86,157,0.15)]"
              : shouldWarn
              ? "border border-[rgba(255,183,77,0.35)] text-[#ffb74d] shadow-[0_0_6px_rgba(255,183,77,0.2)]"
              : "border border-[rgba(14,210,247,0.08)] text-[#45aaff] hover:border-[rgba(14,210,247,0.15)]"
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
      </div>
    </div>
  );
}
