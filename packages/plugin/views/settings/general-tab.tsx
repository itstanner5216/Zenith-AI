import React, { useState, useEffect } from "react";
import { Notice } from "obsidian";
import ZenithAI from "../../index";
import { validateApiKey } from "../../apiUtils";

interface GeneralTabProps {
  plugin: ZenithAI;
  userId?: string; // Make userId optional
  email?: string; // Make email optional
}

interface UsageData {
  tokenUsage: number;
  maxTokenUsage: number;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  plugin
}) => {
  const [apiKey, setApiKey] = useState(plugin.settings.API_KEY);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (plugin.settings.API_KEY) {
      fetchUsageData();
    }
  }, []);

  const fetchUsageData = async () => {
    if (!plugin.settings.API_KEY) {
      setUsageData(null);
      return;
    }

    try {
      setIsLoadingUsage(true);
      const data = await plugin.fetchUsageStats();

      if (data) {
        setUsageData(data);

        if (data.tokenUsage >= data.maxTokenUsage) {
          new Notice(
            "Token quota reached for the current cycle. Usage will reset on the next cycle.",
            5000
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setValidationError(null);
  };

  const handleSaveApiKey = async () => {
    const validation = validateApiKey(apiKey);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid API key format");
      return;
    }

    if (validation.error) {
      setValidationError(validation.error);
    }

    try {
      setIsSavingKey(true);
      plugin.settings.API_KEY = apiKey;
      await plugin.saveSettings();
      new Notice("API key saved", 3000);
      await fetchUsageData();
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 mt-0 text-[var(--text-accent)]">
              Provider API Key
            </h3>
            <p className="text-xs text-[var(--text-dim)] opacity-70 mb-4">
              Add your provider key to enable assistant requests and usage stats.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className={`flex-1 bg-[var(--bg-depth-1)] text-[var(--text-normal)] border rounded-md px-3 py-1.5 text-sm outline-none transition-all duration-150 placeholder:text-[var(--text-dim)] placeholder:opacity-60 ${
                  validationError
                    ? "border-[var(--text-sub-accent)] shadow-glow-pink-sm"
                    : "border-[var(--border-defined)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-accent)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)]"
                }`}
                placeholder="Enter API key"
                value={apiKey}
                onChange={e => handleApiKeyChange(e.target.value)}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey || !!validationError || isSavingKey}
                className="bg-[var(--text-accent)] text-[var(--bg-depth-1)] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(14,210,247,0.2)] hover:shadow-[0_0_12px_rgba(14,210,247,0.35)]"
              >
                {isSavingKey ? "Saving..." : "Save"}
              </button>
            </div>
            {validationError && (
              <div className="text-sm text-[var(--text-sub-accent)] mt-1">
                {validationError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Usage Stats Section - Always visible */}
      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md">
        <h3 className="text-lg font-semibold mb-2 mt-0 text-[var(--text-accent)]">Usage Statistics</h3>
        {isLoadingUsage ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-accent)] border-t-[var(--text-accent)]" style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}></div>
          </div>
        ) : usageData ? (
          <div className="space-y-3">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-[var(--text-normal)]">
                    Token Usage
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-[var(--text-normal)]">
                    {usageData.tokenUsage.toLocaleString()} /{" "}
                    {usageData.maxTokenUsage.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-[var(--bg-depth-1)] border border-[var(--border-defined)]" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (usageData.tokenUsage / usageData.maxTokenUsage) * 100
                    )}%`,
                    background: usageData.tokenUsage > usageData.maxTokenUsage * 0.9
                      ? 'linear-gradient(90deg, var(--text-sub-accent), rgba(244,86,157,0.7))'
                      : 'linear-gradient(90deg, var(--text-accent), var(--interactive-accent-rgb))',
                    boxShadow: usageData.tokenUsage > usageData.maxTokenUsage * 0.9
                      ? '0 0 8px rgba(244,86,157,0.4)'
                      : '0 0 8px rgba(14,210,247,0.4)',
                    transition: 'width 0.5s ease-out',
                  }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap justify-center rounded-full"
                ></div>
              </div>
            </div>
            {usageData && usageData.tokenUsage >= usageData.maxTokenUsage && (
              <div className="mt-2 p-3 bg-[rgba(244,86,157,0.1)] rounded text-[var(--text-sub-accent)] text-sm border border-[rgba(244,86,157,0.2)]">
                <strong>Token quota reached.</strong> Usage will reset on the
                next cycle.
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-dim)] opacity-70">
            {!plugin.settings.API_KEY
              ? "Add an API key and save to see usage statistics."
              : "No usage data available. Please check your connection and try again."}
          </p>
        )}
      </div>

      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md">
        <h3 className="text-lg font-semibold mb-4 mt-0 text-[var(--text-accent)]">Quick Tutorial</h3>
      </div>

      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md">
        <p className="zenith-ai-support-text mb-4">
          Zenith-AI is an open-source initiative. If you find it valuable,
          please{" "}
          <a
            href="https://notecompanion.ai/?utm_source=obsidian&utm_medium=in-app&utm_campaign=support-us"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-accent)] hover:text-[rgba(14,210,247,0.7)] transition-colors duration-150"
          >
            consider supporting us
          </a>{" "}
          to help improve and maintain the project. 🙏
        </p>
        <p className="text-[var(--text-dim)]">
          <a
            href="https://discord.gg/UWH53WqFuE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-accent)] hover:text-[rgba(14,210,247,0.7)] transition-colors duration-150"
          >
            Need help? Ask me on Discord.
          </a>
        </p>
      </div>
    </div>
  );
};
