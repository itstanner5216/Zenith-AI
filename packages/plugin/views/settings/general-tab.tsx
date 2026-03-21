import React from "react";
import ZenithAI from "../../index";

interface GeneralTabProps {
  plugin: ZenithAI;
}

export const GeneralTab: React.FC<GeneralTabProps> = () => {
  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-depth-3 p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <h3 className="text-lg font-semibold mb-2 mt-0 text-neon-cyan">
          AI Providers
        </h3>
        <p className="text-xs text-dim opacity-70">
          Configure your AI providers and models in the{" "}
          <strong className="text-neon-cyan opacity-100">Providers</strong> tab.
        </p>
      </div>
    </div>
  );
};
