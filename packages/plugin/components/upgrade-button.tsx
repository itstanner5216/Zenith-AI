import React from "react";
import ZenithAI from "../index";
import { tw } from "../lib/utils";
import { ArrowUpCircle } from "lucide-react";
import { UsageData } from "../index";

interface UpgradeButtonProps {
  plugin: ZenithAI;
  variant?: "default" | "compact";
  showMessage?: boolean;
  className?: string;
  usageData?: UsageData | null;
  isForced?: boolean;
}

export function UpgradeButton({
  plugin,
  variant = "default",
  showMessage = false,
  className,
  usageData,
  isForced = false,
}: UpgradeButtonProps) {
  const handleClick = () => {
    plugin.openUpgradePlanModal();
  };

  // Generate tooltip message based on usage
  const getTooltip = (): string => {
    if (isForced) {
      return "Token limit exceeded. Upgrade your plan to continue using Zenith-AI.";
    }

    if (!usageData) {
      return "Upgrade your plan for more tokens and features.";
    }

    const usagePercent = (usageData.tokenUsage / usageData.maxTokenUsage) * 100;
    const remaining = usageData.maxTokenUsage - usageData.tokenUsage;
    const formattedRemaining = remaining.toLocaleString();
    const formattedUsed = usageData.tokenUsage.toLocaleString();
    const formattedMax = usageData.maxTokenUsage.toLocaleString();

    if (usagePercent >= 100) {
      return `Token limit reached (${formattedUsed}/${formattedMax}). Upgrade to continue using Zenith-AI.`;
    } else if (usagePercent >= 90) {
      return `Almost out of tokens (${formattedUsed}/${formattedMax} used, ${formattedRemaining} remaining). Upgrade now to avoid interruption.`;
    } else {
      return `Running low on tokens (${formattedUsed}/${formattedMax} used, ${formattedRemaining} remaining). Upgrade for more capacity.`;
    }
  };

  // Determine color based on usage
  const getColorClasses = (): string => {
    if (isForced || !usageData) {
      // Error state - hot pink
      return "bg-[rgba(244,86,157,0.15)] text-[#f4569d] border border-[rgba(244,86,157,0.4)] hover:bg-[rgba(244,86,157,0.25)] hover:border-[rgba(244,86,157,0.6)] hover:shadow-[0_0_10px_rgba(244,86,157,0.25)] cursor-pointer";
    }

    const usagePercent = (usageData.tokenUsage / usageData.maxTokenUsage) * 100;

    if (usagePercent >= 100) {
      // Critical - hot pink pulsing
      return "bg-[rgba(244,86,157,0.15)] text-[#f4569d] border border-[rgba(244,86,157,0.4)] hover:bg-[rgba(244,86,157,0.25)] hover:border-[rgba(244,86,157,0.6)] animate-pulse cursor-pointer";
    } else if (usagePercent >= 90) {
      // Warning - amber
      return "bg-[rgba(255,183,77,0.12)] text-[#ffb74d] border border-[rgba(255,183,77,0.35)] hover:bg-[rgba(255,183,77,0.2)] hover:border-[rgba(255,183,77,0.55)] hover:shadow-[0_0_8px_rgba(255,183,77,0.2)] cursor-pointer";
    } else {
      // Normal - cyan accent
      return "bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.3)] hover:bg-[rgba(14,210,247,0.18)] hover:border-[rgba(14,210,247,0.5)] hover:shadow-[0_0_8px_rgba(14,210,247,0.2)] cursor-pointer";
    }
  };

  const tooltip = getTooltip();
  const colorClasses = getColorClasses();

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className={tw(
          "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 flex items-center gap-1.5 active:scale-[0.97]",
          colorClasses,
          className
        )}
        title={tooltip}
      >
        <ArrowUpCircle className={tw("w-3.5 h-3.5")} />
        {showMessage && <span>Upgrade</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={tw(
        "px-3 py-2 text-sm font-semibold rounded-md transition-all duration-150 flex items-center gap-2 active:scale-[0.97]",
        colorClasses,
        className
      )}
      title={tooltip}
    >
      <ArrowUpCircle className={tw("w-4 h-4")} />
      <span>Upgrade Plan</span>
    </button>
  );
}

