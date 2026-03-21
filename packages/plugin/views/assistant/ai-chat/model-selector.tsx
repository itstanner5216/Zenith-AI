import React from "react";
import { usePlugin } from "../provider";
import type { ModelConfig } from "../../../services/ai/types";

interface ModelSelectorProps {
  selectedModelConfigId: string;
  onModelSelect: (configId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelConfigId,
  onModelSelect,
}) => {
  const plugin = usePlugin();
  const { modelConfigs } = plugin.settings;

  if (modelConfigs.length === 0) {
    return (
      <span
        className="text-xs text-dim opacity-40"
        title="Add models in Settings → Providers"
      >
        No models configured
      </span>
    );
  }

  const getLabel = (config: ModelConfig): string => {
    if (config.displayName) return config.displayName;
    return config.modelId;
  };

  return (
    <select
      value={selectedModelConfigId}
      onChange={e => {
        onModelSelect(e.target.value);
        plugin.settings.activeModelConfigId = e.target.value;
        plugin.saveSettings();
      }}
      className="text-xs px-2 py-0.5 rounded bg-transparent text-dim border border-transparent hover:border-[rgba(14,210,247,0.15)] hover:text-foreground hover:bg-[rgba(14,210,247,0.06)] focus:outline-none focus:border-[rgba(14,210,247,0.3)] cursor-pointer transition-all duration-150 appearance-none max-w-[200px] truncate"
      title="Select model"
    >
      {modelConfigs.map(config => (
        <option key={config.id} value={config.id}>
          {getLabel(config)}
        </option>
      ))}
    </select>
  );
};
