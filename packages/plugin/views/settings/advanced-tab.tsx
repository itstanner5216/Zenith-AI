import React, { useState, useEffect } from "react";
import { Notice } from "obsidian";
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
  const [useLogs, setUseLogs] = useState(plugin.settings.useLogs);
  const [debugMode, setDebugMode] = useState(plugin.settings.debugMode);
  const [showLogs, setShowLogs] = useState(false);
  const [contentCutoffChars, setContentCutoffChars] = useState(
    plugin.settings.contentCutoffChars,
  );
  const [maxFormattingTokens, setMaxFormattingTokens] = useState(
    plugin.settings.maxFormattingTokens,
  );
  const [pdfPageLimit, setPdfPageLimit] = useState(
    plugin.settings.pdfPageLimit,
  );
  const [showLocalLLMInChat, setShowLocalLLMInChat] = useState(
    plugin.settings.showLocalLLMInChat,
  );
  const [backgroundScribeEnabled, setBackgroundScribeEnabled] = useState(
    plugin.settings.backgroundScribeEnabled,
  );

  // Sync state with plugin settings when they change
  useEffect(() => {
    setUseLogs(plugin.settings.useLogs);
    setDebugMode(plugin.settings.debugMode);
    setEnableSelfHosting(plugin.settings.enableSelfHosting);
    setSelfHostingURL(plugin.settings.selfHostingURL);
    setShowLocalLLMInChat(plugin.settings.showLocalLLMInChat);
    setBackgroundScribeEnabled(plugin.settings.backgroundScribeEnabled);
  }, [
    plugin.settings.useLogs,
    plugin.settings.debugMode,
    plugin.settings.enableSelfHosting,
    plugin.settings.selfHostingURL,
    plugin.settings.showLocalLLMInChat,
    plugin.settings.backgroundScribeEnabled,
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
      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[var(--text-accent)]">
          Logging & Debug
        </h3>
        <ToggleSetting
          name="Zenith-AI File Logs"
          description="Allows you to keep track of the changes made by file Organizer."
          value={useLogs}
          onChange={value =>
            handleSettingChange(plugin, value, setUseLogs, "useLogs")
          }
        />

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

      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[var(--text-accent)]">
          Self-Hosting
        </h3>
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
                className="w-full bg-[var(--bg-depth-1)] text-[var(--text-normal)] text-xs border border-[var(--border-defined)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150 placeholder:text-[var(--text-dim)] placeholder:opacity-60"
              />
            </div>
          </div>
        )}
      </div>

      {useLogs && (
        <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[var(--text-normal)]">
                View Logs
              </div>
              <div className="text-sm text-[var(--text-dim)]">
                {logger.getLogs().length} log entries available
              </div>
            </div>
            <div className="flex gap-2">
              {logger.getLogs().length > 0 && (
                <>
                  <button
                    onClick={async () => {
                      const logs = logger.getLogs();
                      const logText = logs
                        .map(
                          log =>
                            `[${new Date(
                              log.timestamp,
                            ).toLocaleString()}] [${log.level.toUpperCase()}] ${
                              log.message
                            }${log.details ? `\n${log.details}` : ""}`,
                        )
                        .join("\n\n");
                      try {
                        await navigator.clipboard.writeText(logText);
                        new Notice(
                          `Copied ${logs.length} log entries to clipboard`,
                          2000,
                        );
                      } catch (error) {
                        console.error("Failed to copy logs:", error);
                        new Notice("Failed to copy logs to clipboard", 3000);
                      }
                    }}
                    className="clickable-icon"
                    aria-label="Copy all logs"
                    title="Copy all logs to clipboard"
                  >
                    <svg
                      className="w-[--icon-size] h-[--icon-size]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-dim)"
                      strokeWidth="2"
                    >
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      logger.clearLogs();
                      setShowLogs(false);
                    }}
                    className="clickable-icon"
                    aria-label="Clear logs"
                    title="Clear all logs"
                  >
                    <svg
                      className="w-[--icon-size] h-[--icon-size]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-dim)"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="clickable-icon"
                aria-label={showLogs ? "Hide logs" : "Show logs"}
                title={showLogs ? "Hide logs" : "Show logs"}
              >
                <svg
                  className="w-[--icon-size] h-[--icon-size]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-dim)"
                  strokeWidth="2"
                >
                  {showLogs ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          {showLogs && (
            <div
              className="max-h-96 overflow-y-auto border border-[var(--border-defined)] rounded p-2 bg-[var(--bg-depth-1)] select-text"
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
            >
              {logger.getLogs().length === 0 ? (
                <div className="text-sm text-[var(--text-dim)] py-4 text-center">
                  No logs available. Enable Debug Mode to start logging.
                </div>
              ) : (
                logger.getLogs().map((log, index) => (
                  <div
                    key={index}
                    className={`py-1 border-b border-[var(--border-defined)] last:border-0 select-text ${
                      log.level === "error"
                        ? "text-[var(--text-sub-accent)]"
                        : log.level === "warn"
                          ? "text-[var(--text-warning)]"
                          : "text-[var(--text-normal)]"
                    }`}
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                  >
                    <span className="text-[var(--text-dim)] text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>{" "}
                    <span className="font-medium">
                      [{log.level.toUpperCase()}]
                    </span>{" "}
                    {log.message}
                    {log.details && (
                      <pre className="text-xs mt-1 text-[var(--text-dim)] whitespace-pre-wrap break-words select-text">
                        {log.details}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[var(--text-accent)]">
          Performance Limits
        </h3>
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Content Analysis Cutoff</div>
            <div className="setting-item-description">
              Maximum number of characters to analyze for folder suggestions,
              tagging, and titles. Lower values improve performance and reduce
              API costs. Default: 1000
            </div>
          </div>
          <div className="setting-item-control">
            <input
              type="number"
              min="100"
              max="10000"
              value={contentCutoffChars}
              onChange={e => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setContentCutoffChars(value);
                  plugin.settings.contentCutoffChars = value;
                  plugin.saveSettings();
                }
              }}
              className="w-24 bg-[var(--bg-depth-1)] text-[var(--text-normal)] text-xs border border-[var(--border-defined)] rounded-md px-2 py-1 text-center focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150"
            />
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Max Formatting Tokens</div>
            <div className="setting-item-description">
              Maximum number of tokens allowed for document formatting in the
              inbox. Documents exceeding this limit will be skipped. Default:
              100,000
            </div>
          </div>
          <div className="setting-item-control">
            <input
              type="number"
              min="1000"
              max="500000"
              step="1000"
              value={maxFormattingTokens}
              onChange={e => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setMaxFormattingTokens(value);
                  plugin.settings.maxFormattingTokens = value;
                  plugin.saveSettings();
                }
              }}
              className="w-24 bg-[var(--bg-depth-1)] text-[var(--text-normal)] text-xs border border-[var(--border-defined)] rounded-md px-2 py-1 text-center focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150"
            />
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-b-0">
          <div className="setting-item-info">
            <div className="setting-item-name">PDF Page Cutoff</div>
            <div className="setting-item-description">
              Maximum number of PDF pages to analyze for context. Default: 10
            </div>
          </div>
          <div className="setting-item-control">
            <input
              type="number"
              min="1"
              max="500"
              value={pdfPageLimit}
              onChange={e => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  setPdfPageLimit(value);
                  plugin.settings.pdfPageLimit = value;
                  plugin.saveSettings();
                }
              }}
              className="w-24 bg-[var(--bg-depth-1)] text-[var(--text-normal)] text-xs border border-[var(--border-defined)] rounded-md px-2 py-1 text-center focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-1 focus:ring-[var(--interactive-accent)] transition-all duration-150"
            />
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-depth-3)] p-4 rounded-lg border border-[var(--border-defined)] shadow-elevation-md space-y-3">
        <h3 className="text-lg font-semibold mb-3 mt-0 text-[var(--text-accent)]">
          Chat Features
        </h3>
        <ToggleSetting
          name="Enable Local LLM in Chat"
          description="Show local Ollama model option in the chat model selector."
          value={showLocalLLMInChat}
          onChange={value =>
            handleSettingChange(
              plugin,
              value,
              setShowLocalLLMInChat,
              "showLocalLLMInChat",
            )
          }
        />
        <ToggleSetting
          name="Background Scribe"
          description="Enable Background Scribe to buffer chat conversations and synthesize actionable TODO items."
          value={backgroundScribeEnabled}
          onChange={async value => {
            // Save setting FIRST so activate() guard sees the updated value
            await handleSettingChange(
              plugin,
              value,
              setBackgroundScribeEnabled,
              "backgroundScribeEnabled",
            );
            // Now safe to activate/deactivate
            if (!value) {
              plugin.backgroundScribe?.deactivate();
            } else {
              const activated = plugin.backgroundScribe?.activate();
              if (!activated) {
                new Notice(
                  "Failed to activate Background Scribe. Check settings.",
                );
              }
            }
          }}
        />
      </div>
    </div>
  );
};
