import React, { useState } from "react";
import ZenithAI from "../../index";

interface ExperimentTabProps {
  plugin: ZenithAI;
}

export const ExperimentTab: React.FC<ExperimentTabProps> = ({ plugin }) => {

  const [enableAtomicNotes, setEnableAtomicNotes] = useState(
    plugin.settings.enableAtomicNotes
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
    <div className="experiment-settings p-4 space-y-8">
      <div className="mb-8">
        <p className="text-[var(--text-dim)] mb-4">
          These experiments are the pieces still worth hardening for the new
          development-vault workflow.
        </p>
        <ul className="list-disc pl-6 text-[var(--text-dim)] space-y-1 mb-6">
          <li>Decompose plans into smaller notes</li>
          <li>Ground AI responses with live web search when needed</li>
          <li>Keep transitional features isolated while the mode runtime lands</li>
        </ul>
        <div className="p-4 bg-[var(--bg-depth-2)] rounded-lg border border-[var(--border-defined)]">
          <p className="text-sm text-[var(--text-accent)]">
            Focus on the features you actively use. Everything else is being
            trimmed or repurposed.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-accent)] mb-4">
            Core Experiments
          </h3>
          <div className="space-y-3">
            <ToggleSetting
              name="Atomic Notes"
              description="Enable plan decomposition in the assistant sidebar."
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
              name="Web Search for AI Responses"
              description={
                <div className="space-y-2">
                  <p>Enable web search capabilities to enhance AI responses with up-to-date information.</p>
                  <div className="mt-2 p-3 bg-[var(--bg-depth-3)] rounded text-sm space-y-1">
                    <p className="text-[var(--text-accent)]">
                      Uses web search only when the active mode supports it.
                    </p>
                    <p className="text-[var(--text-dim)]">
                      This stays intentionally separate from vault retrieval features like Cosmic Context.
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
              <div className="ml-4 border-l-2 border-[var(--text-accent)] pl-4">
                <ToggleSetting
                  name="Deep Search Context"
                  description="Use a larger search context window for richer web results."
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
                  <div className="mt-2 p-3 bg-[var(--bg-depth-3)] rounded text-sm space-y-1">
                    <p className="text-[var(--text-dim)]">
                      This feature is transitional and will likely be replaced by narrower mode-specific flows.
                    </p>
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
      </div>
    </div>
  );
};

interface ToggleSettingProps {
  name: string;
  description: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  name,
  description,
  value,
  onChange,
}) => (
  <div className="setting-item flex items-center justify-between p-4 bg-[var(--bg-depth-1)] rounded-lg border border-[var(--border-defined)] hover:border-[var(--border-accent)] transition-all duration-150">
    <div className="setting-item-info flex-1">
      <div className="setting-item-name font-medium text-[var(--text-normal)]">
        {name}
      </div>
      <div className="setting-item-description text-xs text-[var(--text-dim)] opacity-70">
        {description}
      </div>
    </div>
    <div className="setting-item-control">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={e => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`relative w-8 h-4 rounded-full border transition-all duration-200 ${
          value
            ? 'bg-[rgba(14,210,247,0.25)] border-[var(--text-accent)] shadow-[0_0_6px_rgba(14,210,247,0.3)]'
            : 'bg-[var(--bg-depth-1)] border-[var(--border-accent)]'
        }`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
            value
              ? 'right-0.5 bg-[var(--text-accent)]'
              : 'left-0.5 bg-[var(--text-dim)] opacity-60'
          }`} />
        </div>
      </label>
    </div>
  </div>
);
