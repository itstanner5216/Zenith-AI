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
        <p className="text-[#45aaff] mb-4">
          These experimental features enhance your File Organizer experience.
          Enable them to:
        </p>
        <ul className="list-disc pl-6 text-[#45aaff] space-y-1 mb-6">
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
          <h3 className="text-lg font-semibold text-[#0fb6d6] mb-4">
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
              name="Title Suggestions (Deprecated)"
              description={
                <div className="space-y-2">
                  <p>Show title suggestions in the sidebar.</p>
                  <div className="mt-2 p-3 bg-[#191621] rounded text-sm space-y-1">
                    <p className="text-[#ffb74d]" style={{ textShadow: '0 0 8px rgba(255,183,77,0.3)' }}>
                      ⚡ Deprecated
                    </p>
                    <p className="text-[#45aaff]">
                      This feature will be removed in a future update. For
                      file renaming:
                    </p>
                    <ul className="list-disc pl-4 text-[#45aaff]">
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
      </div>
    </div>
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
  <div className="setting-item flex items-center justify-between p-4 bg-[#0d0b12] rounded-lg border border-[rgba(14,210,247,0.08)] hover:border-[rgba(14,210,247,0.2)] transition-all duration-150">
    <div className="setting-item-info flex-1">
      <div className="setting-item-name font-medium text-[#bebebe]">
        {name}
      </div>
      <div className="setting-item-description text-xs text-[#45aaff] opacity-70">
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
            ? 'bg-[rgba(14,210,247,0.25)] border-[#0fb6d6] shadow-[0_0_6px_rgba(14,210,247,0.3)]'
            : 'bg-[#0d0b12] border-[rgba(14,210,247,0.2)]'
        }`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
            value
              ? 'right-0.5 bg-[#0fb6d6]'
              : 'left-0.5 bg-[#45aaff] opacity-60'
          }`} />
        </div>
      </label>
    </div>
  </div>
);
