import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import { CatalystGate } from "./catalyst-gate";

interface ExperimentTabProps {
  plugin: ZenithAI;
}

export const ExperimentTab: React.FC<ExperimentTabProps> = ({ plugin }) => {

  const [enableAtomicNotes, setEnableAtomicNotes] = useState(
    plugin.settings.enableAtomicNotes
  );

  const [showLocalLLMInChat, setShowLocalLLMInChat] = useState(
    plugin.settings.showLocalLLMInChat
  );
  const [enableTitleSuggestions, setEnableTitleSuggestions] = useState(
    plugin.settings.enableTitleSuggestions
  );
  const [enableSearchGrounding, setEnableSearchGrounding] = useState(
    plugin.settings.enableSearchGrounding
  );
  const [enableDeepSearch, setEnableDeepSearch] = useState(
    plugin.settings.enableDeepSearch
  );
  const [showSyncTab, setShowSyncTab] = useState(
    plugin.settings.showSyncTab
  );
  const [enableScreenpipe, setEnableScreenpipe] = useState(
    plugin.settings.enableScreenpipe
  );
  const [screenpipeTimeRange, setScreenpipeTimeRange] = useState(
    plugin.settings.screenpipeTimeRange
  );
  const [queryScreenpipeLimit, setQueryScreenpipeLimit] = useState(
    plugin.settings.queryScreenpipeLimit
  );

  useEffect(() => {
    setEnableScreenpipe(plugin.settings.enableScreenpipe);
    setScreenpipeTimeRange(plugin.settings.screenpipeTimeRange);
    setQueryScreenpipeLimit(plugin.settings.queryScreenpipeLimit);
  }, [plugin.settings.enableScreenpipe, plugin.settings.screenpipeTimeRange, plugin.settings.queryScreenpipeLimit]);

  const handleToggleChange = async (
    value: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    settingKey: keyof typeof plugin.settings
  ) => {
    setter(value);
    (plugin.settings[settingKey] as boolean) = value;
    await plugin.saveSettings();
  };

  return (
    <CatalystGate plugin={plugin}>
      <div className="experiment-settings p-4 space-y-8">
        <div className="mb-8">
          <p className="text-[#7aa2f7] mb-4">
            These experimental features enhance your File Organizer experience.
            Enable them to:
          </p>
          <ul className="list-disc pl-6 text-[#7aa2f7] space-y-1 mb-6">
            <li>Generate atomic notes from your content</li>
            <li>Integrate with external tools</li>
            <li>Use AI-powered formatting</li>
          </ul>
          <div className="p-4 bg-[#100e17] rounded-lg border border-[rgba(14,210,247,0.08)]">
            <p className="text-sm text-[#0fb6d6]">
              💡 Tip: Start with one experimental feature at a time to better
              understand its impact on your workflow.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-[#bebebe] mb-4">
              Core Experiments
            </h3>
            <div className="space-y-3">
             
              <ToggleSetting
                name="Atomic Notes"
                description="Enable the generation of atomic notes in the assistant sidebar."
                value={enableAtomicNotes}
                onChange={value =>
                  handleToggleChange(
                    value,
                    setEnableAtomicNotes,
                    "enableAtomicNotes"
                  )
                }
              />

              <ToggleSetting
                name="Local LLM Integration"
                description={
                  <div className="space-y-2">
                    <p>
                      Enable local LLM options in the chat interface for offline
                      AI processing.
                    </p>
                    <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-2">
                      <p className="text-[#ffb74d]">
                        ⚡ Requires a compatible local LLM setup
                      </p>
                      <p className="text-[#7aa2f7]">Currently supports:</p>
                      <ul className="list-disc pl-4 text-[#7aa2f7]">
                        <li>Any Ollama local model (e.g. Llama 3.2, Deepseek r1)</li>
                      </ul>
                      <p className="text-xs text-[rgba(122,162,247,0.4)]">
                        More models coming soon
                      </p>
                    </div>
                  </div>
                }
                value={showLocalLLMInChat}
                onChange={value =>
                  handleToggleChange(
                    value,
                    setShowLocalLLMInChat,
                    "showLocalLLMInChat"
                  )
                }
              />
              <ToggleSetting
                name="Web Search for AI Responses"
                description={
                  <div className="space-y-2">
                    <p>Enable web search capabilities to enhance AI responses with up-to-date information.</p>
                    <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                      <p className="text-[#0fb6d6]">
                        🌎 Powered by OpenAI's web search feature
                      </p>
                      <p className="text-[#7aa2f7]">
                        Automatically includes citations for information from the web
                      </p>
                    </div>
                  </div>
                }
                value={enableSearchGrounding}
                onChange={value =>
                  handleToggleChange(
                    value,
                    setEnableSearchGrounding,
                    "enableSearchGrounding"
                  )
                }
              />

              {enableSearchGrounding && (
                <div className="ml-4 border-l-2 border-[#0fb6d6] pl-4">
                  <ToggleSetting
                    name="Deep Search Context"
                    description={
                      <div className="space-y-2">
                        <p>Use a larger search context size for more comprehensive web results.</p>
                        <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                          <p className="text-[#ffb74d]">
                            ⚠️ Uses more tokens
                          </p>
                          <p className="text-[#7aa2f7]">
                            Provides more detailed information from web sources but consumes additional tokens
                          </p>
                        </div>
                      </div>
                    }
                    value={enableDeepSearch}
                    onChange={value =>
                      handleToggleChange(
                        value,
                        setEnableDeepSearch,
                        "enableDeepSearch"
                      )
                    }
                  />
                </div>
              )}
              
              <ToggleSetting
                name="Title Suggestions (Deprecated)"
                description={
                  <div className="space-y-2">
                    <p>Show title suggestions in the sidebar.</p>
                    <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                      <p className="text-[#ffb74d]">
                        ⚠️ Deprecated Feature
                      </p>
                      <p className="text-[#7aa2f7]">
                        This feature will be removed in a future update. For
                        file renaming:
                      </p>
                      <ul className="list-disc pl-4 text-[#7aa2f7]">
                        <li>
                          Use the rename instructions in Organization
                          preferences
                        </li>
                        <li>
                          Configure file renaming behavior for inbox processing
                        </li>
                      </ul>
                    </div>
                  </div>
                }
                value={enableTitleSuggestions}
                onChange={value =>
                  handleToggleChange(
                    value,
                    setEnableTitleSuggestions,
                    "enableTitleSuggestions"
                  )
                }
              />
            </div>
          </div>

          <div className="border-t border-[rgba(14,210,247,0.08)] pt-6">
            <h3 className="text-lg font-medium text-[#bebebe] mb-4">
              Integrations (Beta)
            </h3>
            <div className="bg-[#191621] p-4 rounded-lg mb-4">
              <p className="text-sm text-[#7aa2f7]">
                These integrations are in early beta. Your feedback helps us
                improve and prioritize features.
              </p>
            </div>

            <div className="space-y-3">


              <div className="space-y-3">
                <ToggleSetting
                  name="Show Sync Tab (Advanced)"
                  description={
                    <div className="space-y-2">
                      <p>Enable the Sync tab in the Assistant sidebar for mobile app file synchronization.</p>
                      <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                        <p className="text-[#ffb74d]">
                          ⚠️ Advanced Feature
                        </p>
                        <p className="text-[#7aa2f7]">
                          This feature is designed for users of the Zenith-AI mobile app who want to sync files between mobile and desktop.
                        </p>
                        <p className="text-xs text-[rgba(122,162,247,0.4)]">
                          Requires Zenith-AI mobile app setup
                        </p>
                      </div>
                    </div>
                  }
                  value={showSyncTab}
                  onChange={value =>
                    handleToggleChange(value, setShowSyncTab, "showSyncTab")
                  }
                />
                <ToggleSetting
                  name="ScreenPipe Integration"
                  description={
                    <div className="space-y-2">
                      <p>Enable ScreenPipe integration to search your screen activity and audio transcriptions in the AI chat.</p>
                      <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                        <p className="text-[#0fb6d6]">
                          📺 Requires ScreenPipe running on localhost:3030
                        </p>
                        <p className="text-[#7aa2f7]">
                          Search your screen recordings and meeting transcriptions directly from chat.
                        </p>
                        <p className="text-xs text-[rgba(122,162,247,0.4)]">
                          Make sure ScreenPipe is running before using this feature
                        </p>
                      </div>
                      {enableScreenpipe && (
                        <div className="mt-4 ml-4 p-4 bg-[#100e17] rounded-lg border-l-2 border-[#0fb6d6] space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm text-[#bebebe] font-medium">
                              Time Range (hours)
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="24"
                                value={screenpipeTimeRange}
                                onChange={async e => {
                                  const value = Number(e.target.value);
                                  setScreenpipeTimeRange(value);
                                  plugin.settings.screenpipeTimeRange = value;
                                  await plugin.saveSettings();
                                }}
                                className="w-20 px-2 py-1 bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] rounded"
                              />
                              <span className="text-sm text-[#7aa2f7]">hours</span>
                            </div>
                            <p className="text-xs text-[#7aa2f7]">
                              Adjust how far back Screenpipe should look for data. Lower
                              values mean faster processing but may miss important
                              context.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-[#bebebe] font-medium">
                              Query Limit
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={queryScreenpipeLimit}
                                onChange={async e => {
                                  const value = Number(e.target.value);
                                  setQueryScreenpipeLimit(value);
                                  plugin.settings.queryScreenpipeLimit = value;
                                  await plugin.saveSettings();
                                }}
                                className="w-20 px-2 py-1 bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] rounded"
                              />
                              <span className="text-sm text-[#7aa2f7]">items</span>
                            </div>
                            <p className="text-xs text-[#7aa2f7]">
                              Maximum number of items to fetch per query. Higher limits
                              provide more context but may impact performance.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  }
                  value={enableScreenpipe}
                  onChange={value =>
                    handleToggleChange(value, setEnableScreenpipe, "enableScreenpipe")
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CatalystGate>
  );
};

interface ToggleSettingProps {
  name: string;
  description: string | JSX.Element;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  name,
  description,
  value,
  onChange,
}) => (
  <div className="setting-item flex items-center justify-between p-4 bg-[#0d0b12] rounded-lg border border-[rgba(14,210,247,0.08)] hover:border-[rgba(14,210,247,0.2)]">
    <div className="setting-item-info flex-1">
      <div className="setting-item-name font-medium text-[#bebebe]">
        {name}
      </div>
      <div className="setting-item-description text-sm text-[#7aa2f7]">
        {description}
      </div>
    </div>
    <div className="setting-item-control">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="text-[#0fb6d6] rounded border-[rgba(14,210,247,0.08)] accent-[#0fb6d6]"
      />
    </div>
  </div>
);
