import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import { logger } from "../../services/logger";
import { ToggleSetting, handleSettingChange } from "./components";

interface AdvancedTabProps {
  plugin: ZenithAI;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({ plugin }) => {
  const [enableSelfHosting, setEnableSelfHosting] = useState(
    plugin.settings.enableSelfHosting,
  );
  const [selfHostingURL, setSelfHostingURL] = useState(
    plugin.settings.selfHostingURL,
  );
  const [debugMode, setDebugMode] = useState(plugin.settings.debugMode);

  useEffect(() => {
    setDebugMode(plugin.settings.debugMode);
    setEnableSelfHosting(plugin.settings.enableSelfHosting);
    setSelfHostingURL(plugin.settings.selfHostingURL);
  }, [
    plugin.settings.debugMode,
    plugin.settings.enableSelfHosting,
    plugin.settings.selfHostingURL,
  ]);

  const handleToggleChange = async (value: boolean) => {
    await handleSettingChange(
      plugin,
      value,
      setEnableSelfHosting,
      "enableSelfHosting",
    );
  };

  const handleURLChange = async (value: string) => {
    setSelfHostingURL(value);
    plugin.settings.selfHostingURL = value;
    await plugin.saveSettings();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[#0fb6d6]">Logging & Debug</h3>
        <ToggleSetting
          name="Debug Mode"
          description="Enable detailed logging for troubleshooting. This may impact performance."
          value={debugMode}
          onChange={async value => {
            await handleSettingChange(plugin, value, setDebugMode, "debugMode");
            logger.configure(value);
          }}
        />
      </div>

      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[#0fb6d6]">Self-Hosting</h3>
        <ToggleSetting
          name="Enable Self-Hosting"
          description="Run Zenith AI on your own infrastructure with your OpenAI API key. Keep disabled if you use the cloud subscription."
          value={enableSelfHosting}
          onChange={value => handleToggleChange(value)}
        />
        {enableSelfHosting && (
          <div className="setting-item">
            <div className="setting-item-info">
              <div className="setting-item-name">Server URL</div>
            </div>
            <div className="setting-item-control">
              <input
                type="text"
                placeholder="Enter your Server URL"
                value={selfHostingURL}
                onChange={e => handleURLChange(e.target.value)}
                className="w-full bg-[#0d0b12] text-[#bebebe] text-xs border border-[rgba(14,210,247,0.12)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] focus:shadow-[0_0_8px_rgba(14,210,247,0.1)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
