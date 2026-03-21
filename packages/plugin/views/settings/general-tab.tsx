import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";

interface GeneralTabProps {
  plugin: ZenithAI;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  plugin,
}) => {
  const [licenseKey, setLicenseKey] = useState(plugin.settings.API_KEY);
  const [keyStatus, setKeyStatus] = useState<
    "valid" | "invalid" | "checking" | "idle"
  >(plugin.settings.API_KEY ? "checking" : "idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check key status on mount if we have a key
  useEffect(() => {
    if (plugin.settings.API_KEY) {
      checkLicenseStatus();
    }
  }, []);

  const checkLicenseStatus = async () => {
    if (!licenseKey) return;
    setKeyStatus(licenseKey.trim().length >= 10 ? "valid" : "invalid");
  };

  const handleLicenseKeyChange = async (value: string) => {
    setLicenseKey(value);
    setKeyStatus("idle");
    setValidationError(null);

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
          <div className="flex items-center text-neon-cyan text-sm" style={{ textShadow: '0 0 8px rgba(14,210,247,0.4)' }}>
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
            API key set
          </div>
        );
      case "invalid":
        return (
          <div className="flex items-center text-neon-pink text-sm">
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
            Invalid API key
          </div>
        );
      case "checking":
        return (
          <div className="flex items-center text-dim text-sm">
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
            Checking...
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-depth-3 p-4 rounded-lg border border-defined shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 mt-0 text-neon-cyan">
              Zenith-AI API Key
            </h3>
            <p className="text-xs text-dim opacity-70 mb-4">
              Enter your API key.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className={`flex-1 bg-depth-1 text-foreground border rounded-md px-3 py-1.5 text-sm outline-none transition-all duration-150 placeholder:text-dim placeholder:opacity-40 ${
                  keyStatus === "valid"
                    ? "border-neon-cyan shadow-glow-cyan-sm"
                    : keyStatus === "invalid" || validationError
                    ? "border-neon-pink shadow-glow-pink-sm"
                    : "border-[rgba(14,210,247,0.12)] focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-neon-cyan focus:shadow-[0_0_8px_rgba(14,210,247,0.1)]"
                }`}
                placeholder="Enter your API key"
                value={licenseKey}
                onChange={e => handleLicenseKeyChange(e.target.value)}
              />
              <button
                onClick={handleActivate}
                disabled={!licenseKey || !!validationError}
                className="bg-neon-cyan text-primary-foreground px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(14,210,247,0.2)] hover:shadow-glow-cyan-md"
              >
                Save
              </button>
            </div>
            {validationError && (
              <div className="text-sm text-neon-pink mt-1">
                {validationError}
              </div>
            )}
            {getStatusIndicator()}
          </div>
        </div>
      </div>
    </div>
  );
};
