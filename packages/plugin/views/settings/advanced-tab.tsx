import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import { logger } from "../../services/logger";
import { ToggleSetting, handleSettingChange } from "./components";

interface AdvancedTabProps {
  plugin: ZenithAI;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({ plugin }) => {
  const [selfHostingURL, setSelfHostingURL] = useState(
    plugin.settings.selfHostingURL,
  );
  const [debugMode, setDebugMode] = useState(plugin.settings.debugMode);

  useEffect(() => {
    setDebugMode(plugin.settings.debugMode);
    setSelfHostingURL(plugin.settings.selfHostingURL);
  }, [
    plugin.settings.debugMode,
    plugin.settings.selfHostingURL,
  ]);

  const handleURLChange = async (value: string) => {
    setSelfHostingURL(value);
    plugin.settings.selfHostingURL = value;
    await plugin.saveSettings();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-depth-3 p-4 rounded-lg border border-defined shadow-[0_2px_8px_rgba(0,0,0,0.4)] space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-neon-cyan">Logging & Debug</h3>
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

      <div className="bg-depth-3 p-4 rounded-lg border border-defined shadow-[0_2px_8px_rgba(0,0,0,0.4)] space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-neon-cyan">Server</h3>
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Server URL</div>
            <div className="setting-item-description text-xs text-dim opacity-60">
              Your self-hosted Zenith AI backend URL
            </div>
          </div>
          <div className="setting-item-control">
            <input
              type="text"
              placeholder="http://localhost:3010"
              value={selfHostingURL}
              onChange={e => handleURLChange(e.target.value)}
              className="w-full bg-depth-1 text-foreground text-xs border border-[rgba(14,210,247,0.12)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[rgba(14,210,247,0.5)] focus:ring-1 focus:ring-neon-cyan focus:shadow-[0_0_8px_rgba(14,210,247,0.1)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
            />
          </div>
        </div>
      </div>

    </div>
  );
};
