import React from 'react';
import { ModelType } from './types';
import { usePlugin } from '../provider';

// Add a mapping for display names
const MODEL_DISPLAY_NAMES: Record<ModelType, string> = {
  'gpt-4o-mini': 'Cloud',
  'custom': 'Ollama Model'
} as const;

// Helper to get display name
const getDisplayName = (model: ModelType): string => {
  return MODEL_DISPLAY_NAMES[model] || model;
};

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelSelect: (model: ModelType) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelSelect,
}) => {
  const plugin = usePlugin();
  const [isModelSelectorOpen, setIsModelSelectorOpen] = React.useState(false);
  const [isCustomizing, setIsCustomizing] = React.useState(false);
  const [customModel, setCustomModel] = React.useState(plugin.settings.customModelName || "llama3.2");

  const handleModelSelect = async (model: ModelType) => {
    if (model === "custom") {
      setIsCustomizing(true);
      return;
    }
    onModelSelect(model);
    if (model === "gpt-4o-mini" || model === "llama3.2") {
      plugin.settings.selectedModel = model;
    }
    await plugin.saveSettings();
    setIsModelSelectorOpen(false);
  };

  const handleCustomModelSave = async () => {
    plugin.settings.customModelName = customModel;
    plugin.settings.selectedModel = customModel as "gpt-4o-mini" | "llama3.2";
    await plugin.saveSettings();
    onModelSelect(customModel);
    setIsCustomizing(false);
    setIsModelSelectorOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-end">
        <div
          onClick={() => plugin.settings.showLocalLLMInChat && setIsModelSelectorOpen(!isModelSelectorOpen)}
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all duration-150 ${
            plugin.settings.showLocalLLMInChat
              ? 'text-[#45aaff] hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.06)] cursor-pointer border border-transparent hover:border-[rgba(14,210,247,0.15)]'
              : 'text-[#45aaff] opacity-75'
          }`}
        >
          <span className="font-medium">{getDisplayName(selectedModel)}</span>
          {plugin.settings.showLocalLLMInChat && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-3 h-3 transition-transform ${
                isModelSelectorOpen ? "rotate-180" : ""
              }`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        {isModelSelectorOpen && plugin.settings.showLocalLLMInChat && (
          <div className="absolute bottom-full right-0 mb-1.5 bg-[rgba(25,22,33,0.85)] border border-[rgba(14,210,247,0.15)] rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_6px_rgba(14,210,247,0.2)] z-50 min-w-[140px] overflow-hidden">
            <div className="py-1">
              <div
                onClick={() => handleModelSelect("gpt-4o-mini")}
                className={`cursor-pointer flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-all duration-150 ${
                  selectedModel === "gpt-4o-mini"
                    ? 'bg-[rgba(14,210,247,0.08)] text-[#0fb6d6] border-l-2 border-l-[#0fb6d6]'
                    : 'text-[#bebebe] hover:bg-[#191621] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:text-[#0fb6d6]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#50fa7b] shadow-[0_0_4px_rgba(80,250,123,0.5)] flex-shrink-0" />
                {getDisplayName("gpt-4o-mini")}
              </div>

              {isCustomizing ? (
                <div className="px-4 py-2">
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full px-2 py-1 text-sm border bg-[#0d0b12] text-[#bebebe] border-[rgba(14,210,247,0.08)] rounded focus:outline-none focus:border-[rgba(14,210,247,0.45)] focus:ring-1 focus:ring-[rgba(14,210,247,0.15)] focus:shadow-[0_0_6px_rgba(14,210,247,0.2)] transition-all duration-150"
                    placeholder="Enter model name..."
                  />
                  <div className="flex justify-end mt-2 space-x-2">
                    <button
                      onClick={() => setIsCustomizing(false)}
                      className="px-2 py-1 text-xs text-[#45aaff] hover:text-[#bebebe] cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCustomModelSave}
                      className="px-2 py-1 text-xs bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] rounded hover:bg-[rgba(14,210,247,0.18)] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)] cursor-pointer active:scale-[0.97] transition-all duration-150"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleModelSelect("custom")}
                  className={`cursor-pointer flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-all duration-150 border-t border-[rgba(14,210,247,0.05)] ${
                    selectedModel === "custom"
                      ? 'bg-[rgba(14,210,247,0.08)] text-[#0fb6d6] border-l-2 border-l-[#0fb6d6]'
                      : 'text-[#bebebe] hover:bg-[#191621] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:text-[#0fb6d6]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f4569d] shadow-[0_0_4px_rgba(244,86,157,0.5)] flex-shrink-0" />
                  {getDisplayName("custom")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
