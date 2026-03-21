import React from "react";
import ZenithAI from "../../index";

interface GeneralTabProps {
  plugin: ZenithAI;
}

export const GeneralTab: React.FC<GeneralTabProps> = () => {
  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-depth-3 p-4 rounded-lg border border-neon-cyan/8 shadow-elevation-md">
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
