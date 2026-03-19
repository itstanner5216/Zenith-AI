import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import { validateApiKey } from "../../apiUtils";

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
    setKeyStatus("checking");
    const validation = validateApiKey(licenseKey);
    const isValid = validation.isValid;
    setKeyStatus(isValid ? "valid" : "invalid");
  };

  const handleLicenseKeyChange = async (value: string) => {
    setLicenseKey(value);
    setKeyStatus("idle");
    setValidationError(null);

    const validation = validateApiKey(value);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid API key format");
      plugin.settings.API_KEY = value;
      await plugin.saveSettings();
      return;
    }

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
    </div>
  );
};
