import React, { useState, useEffect } from "react";
import { Notice } from "obsidian";
import ZenithAI from "../../index";
import { logger } from "../../services/logger";
import { UsageStats } from "../../components/usage-stats";
import { TopUpCredits } from "../../views/settings/top-up-credits";
import { AccountData } from "./account-data";
import { validateApiKey } from "../../apiUtils";
import { FREE_TIER_TOKEN_LIMIT } from "../../constants";

interface GeneralTabProps {
  plugin: ZenithAI;
  userId?: string; // Make userId optional
  email?: string; // Make email optional
}

interface UsageData {
  tokenUsage: number;
  maxTokenUsage: number;
  audioTranscriptionMinutes: number;
  maxAudioTranscriptionMinutes: number;
  subscriptionStatus: string;
  currentPlan: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  plugin,
  userId,
  email,
}) => {
  const [licenseKey, setLicenseKey] = useState(plugin.settings.API_KEY);
  const [keyStatus, setKeyStatus] = useState<
    "valid" | "invalid" | "checking" | "idle"
  >(plugin.settings.API_KEY ? "checking" : "idle");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check key status on mount if we have a key
  useEffect(() => {
    if (plugin.settings.API_KEY) {
      checkLicenseStatus();
    }

    // Always fetch usage data regardless of license key status
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      setIsLoadingUsage(true);

      // Try to fetch usage data with current key
      const data = await plugin.fetchUsageStats();

      if (data) {
        setUsageData(data);

        // If the token usage meets or exceeds the limit, show a specific notice
        if (data.tokenUsage >= data.maxTokenUsage) {
          if (data.maxTokenUsage === FREE_TIER_TOKEN_LIMIT) {
            new Notice(
              "Token limit reached. Please upgrade your plan for more tokens.",
              5000
            );
          } else {
            new Notice(
              "Token limit reached for this month. Tokens reset on the 1st. Top up credits if you need more before then.",
              5000
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
      // Don't set usage data to null on error - keep previous state
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const checkLicenseStatus = async () => {
    if (!licenseKey) return;
    setKeyStatus("checking");
    const validation = validateApiKey(licenseKey);
    const isValid = validation.isValid;
    setKeyStatus(isValid ? "valid" : "invalid");

    // Refresh usage data after key validation
    if (isValid) {
      fetchUsageData();
    }
  };

  const handleLicenseKeyChange = async (value: string) => {
    setLicenseKey(value);
    setKeyStatus("idle");
    setValidationError(null);

    // Validate key format before saving
    const validation = validateApiKey(value);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid API key format");
      // Still save the value but mark as invalid
      plugin.settings.API_KEY = value;
      await plugin.saveSettings();
      return;
    }

    // Warn if key seems too short but still allow it
    if (validation.error) {
      setValidationError(validation.error);
    }

    plugin.settings.API_KEY = value;
    await plugin.saveSettings();
  };

  const handleActivate = async () => {
    await checkLicenseStatus();
  };

  const getStatusIndicator = () => {
    switch (keyStatus) {
      case "valid":
        return (
          <div className="flex items-center text-[#0fb6d6] text-sm" style={{ textShadow: '0 0 8px rgba(14,210,247,0.4)' }}>
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            License key activated
          </div>
        );
      case "invalid":
        return (
          <div className="flex items-center text-[#f4569d] text-sm">
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Invalid license key
          </div>
        );
      case "checking":
        return (
          <div className="flex items-center text-[#45aaff] text-sm">
            <svg
              className="w-4 h-4 mr-1.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Checking license key...
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 mt-0 text-[#0fb6d6]">
              Zenith-AI License Key
            </h3>
            <p className="text-xs text-[#45aaff] opacity-70 mb-4">
              Enter your license key to activate Zenith-AI.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className={`flex-1 bg-[#0d0b12] text-[#bebebe] border rounded-md px-3 py-1.5 text-sm outline-none transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40 ${
                  keyStatus === "valid"
                    ? "border-[#0fb6d6] shadow-[0_0_6px_rgba(14,210,247,0.2)]"
                    : keyStatus === "invalid" || validationError
                    ? "border-[#f4569d] shadow-[0_0_6px_rgba(244,86,157,0.2)]"
                    : "border-[rgba(14,210,247,0.12)] focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)]"
                }`}
                placeholder="Enter your license key"
                value={licenseKey}
                onChange={e => handleLicenseKeyChange(e.target.value)}
              />
              <button
                onClick={handleActivate}
                disabled={!licenseKey || !!validationError}
                className="bg-[#0fb6d6] text-[#0d0b12] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(14,210,247,0.2)] hover:shadow-[0_0_12px_rgba(14,210,247,0.35)]"
              >
                Activate
              </button>
            </div>
            {validationError && (
              <div className="text-sm text-[#f4569d] mt-1">
                {validationError}
              </div>
            )}
            {getStatusIndicator()}
          </div>
        </div>
      </div>

      {/* Usage Stats Section - Always visible */}
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <h3 className="text-lg font-semibold mb-2 mt-0 text-[#0fb6d6]">Usage Statistics</h3>
        {isLoadingUsage ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(14,210,247,0.2)] border-t-[#0fb6d6]" style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}></div>
          </div>
        ) : usageData ? (
          <div className="space-y-3">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-[#bebebe]">
                    Token Usage
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-[#bebebe]">
                    {usageData.tokenUsage.toLocaleString()} /{" "}
                    {usageData.maxTokenUsage.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[rgba(14,210,247,0.08)]" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      (usageData.tokenUsage / usageData.maxTokenUsage) * 100
                    )}%`,
                  }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-[#0d0b12] justify-center ${
                    usageData.tokenUsage > usageData.maxTokenUsage * 0.9
                      ? "bg-[#f4569d]"
                      : "bg-[#0fb6d6]"
                  }`}
                ></div>
              </div>
            </div>
            {/* Audio Transcription Usage */}
            {(usageData.maxAudioTranscriptionMinutes || 0) > 0 && (
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-[#bebebe]">
                      Audio Transcription
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-[#bebebe]">
                      {(usageData.audioTranscriptionMinutes || 0).toFixed(1)} /{" "}
                      {usageData.maxAudioTranscriptionMinutes} min
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[rgba(14,210,247,0.08)]">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        ((usageData.audioTranscriptionMinutes || 0) /
                          usageData.maxAudioTranscriptionMinutes) *
                          100
                      )}%`,
                    }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-[#0d0b12] justify-center ${
                      (usageData.audioTranscriptionMinutes || 0) >
                      usageData.maxAudioTranscriptionMinutes * 0.9
                        ? "bg-[#f4569d]"
                        : "bg-[#0fb6d6]"
                    }`}
                  ></div>
                </div>
              </div>
            )}
            <div className="text-sm text-[#45aaff]">
              <p>
                Plan:{" "}
                <span className="font-medium text-[#0fb6d6]">
                  {usageData.currentPlan || "Free"}
                </span>
              </p>
              <p>
                Status:{" "}
                <span
                  className={`font-medium ${
                    usageData.subscriptionStatus === "active"
                      ? "text-[#0fb6d6]"
                      : "text-[#ffb74d]"
                  }`}
                  style={usageData.subscriptionStatus !== "active" ? { textShadow: '0 0 8px rgba(255,183,77,0.3)' } : undefined}
                >
                  {usageData.subscriptionStatus === "active"
                    ? "Active"
                    : "Inactive"}
                </span>
              </p>
            </div>
            {usageData &&
              usageData.maxAudioTranscriptionMinutes > 0 &&
              usageData.audioTranscriptionMinutes >=
                usageData.maxAudioTranscriptionMinutes && (
                <div className="mt-2 p-3 bg-[rgba(244,86,157,0.1)] rounded text-[#f4569d] text-sm border border-[rgba(244,86,157,0.2)]">
                  Audio transcription quota reached. Please upgrade your plan or
                  wait for the next billing cycle.
                </div>
              )}
            {usageData && usageData.tokenUsage >= usageData.maxTokenUsage && (
              <div className="mt-2 p-3 bg-[rgba(244,86,157,0.1)] rounded text-[#f4569d] text-sm border border-[rgba(244,86,157,0.2)]">
                {usageData.maxTokenUsage === FREE_TIER_TOKEN_LIMIT ? (
                  <>
                    <strong>Token limit reached!</strong> You've used all your
                    tokens for this month. Next reset is on the 1st of the
                    coming month.
                    <br />
                    <br />
                    Upgrade your plan if you'd like to to continue using Note
                    Companion.
                  </>
                ) : (
                  <>
                    <strong>Token limit reached!</strong> You've used all your
                    tokens for this month. Next reset is on the 1st of the
                    coming month. Top up credits if you'd like to continue before
                    then.
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#45aaff] opacity-70">
            {!plugin.settings.API_KEY
              ? "Please enter a license key to see usage statistics."
              : keyStatus === "invalid"
              ? "License key appears to be invalid. Enter a valid key to see detailed usage statistics."
              : "No usage data available. Please check your connection and try again."}
          </p>
        )}
      </div>

      <AccountData
        plugin={plugin}
        onLicenseKeyChange={handleLicenseKeyChange}
      />

      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <h3 className="text-lg font-semibold mb-4 mt-0 text-[#0fb6d6]">Quick Tutorial</h3>
        <div className="youtube-embed">
          <iframe
            width="100%"
            height="315"
            src="https://www.youtube.com/embed/X4yN4ykTJIo?si=QoMN-wNZSo1woQcB"
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <p className="zenith-ai-support-text mb-4">
          Zenith-AI is an open-source initiative. If you find it valuable,
          please{" "}
          <a
            href="https://notecompanion.ai/?utm_source=obsidian&utm_medium=in-app&utm_campaign=support-us"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0fb6d6] hover:text-[rgba(14,210,247,0.7)]"
          >
            consider supporting us
          </a>{" "}
          to help improve and maintain the project. 🙏
        </p>
        <p className="text-[#45aaff]">
          <a
            href="https://discord.gg/UWH53WqFuE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0fb6d6] hover:text-[rgba(14,210,247,0.7)]"
          >
            Need help? Ask me on Discord.
          </a>
        </p>
      </div>
    </div>
  );
};
