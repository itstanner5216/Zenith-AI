import ZenithAI from "../../index";
import { useState, useEffect } from "react";

interface CatalystGateProps {
  plugin: ZenithAI;
  children: React.ReactNode;
}

export const CatalystGate: React.FC<CatalystGateProps> = ({
  plugin,
  children,
}) => {
  const [isCatalyst, setIsCatalyst] = useState(
    plugin.settings.hasCatalystAccess
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      setIsChecking(true);
      const isPremium = await plugin.checkCatalystAccess();
      plugin.settings.hasCatalystAccess = isPremium;
      await plugin.saveSettings();
      setIsCatalyst(isPremium);
    } catch (error) {
      console.error("Error checking premium status:", error);
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-[#7aa2f7]">Loading...</div>
      </div>
    );
  }

  if (!isCatalyst) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-[#191621] p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold mb-3 text-[#bebebe]">
            Catalyst Experiments
          </h3>
          <p className="text-[#7aa2f7] mb-4">
            Experimental features are available exclusively for Catalyst
            members. Upgrade to unlock:
          </p>
          <ul className="text-left text-[#7aa2f7] mb-4 space-y-2">
            <li>• Local LLM Integration</li>
            <li>• Atomic Notes Generation</li>
            <li>• And more experimental features...</li>
          </ul>
          <div className="flex flex-col gap-3">
            <a
              href="https://notecompanion.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-[#0fb6d6] text-[#0d0b12] rounded-lg hover:bg-[rgba(14,210,247,0.7)] transition-colors"
            >
              Upgrade to Catalyst
            </a>
            <button
              onClick={checkPremiumStatus}
              disabled={isChecking}
              className="px-4 py-2 bg-[rgba(14,210,247,0.08)] text-[#7aa2f7] rounded-lg hover:bg-[rgba(14,210,247,0.12)] transition-colors disabled:opacity-50"
            >
              {isChecking ? "Checking access..." : "Check Catalyst Access"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
