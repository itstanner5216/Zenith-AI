import React, { useState, useEffect } from "react";
import ZenithAI from "../../index";
import type { ProviderKey, ModelConfig, ProviderType } from "../../services/ai/types";
import { AIService } from "../../services/ai/ai-service";

interface ProvidersTabProps {
  plugin: ZenithAI;
}

// --- Provider Key Management ---

function AddKeyForm({ onSave, onCancel }: {
  onSave: (key: Omit<ProviderKey, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      provider,
      apiKey: apiKey.trim(),
      baseUrl: provider === "openai-compatible" || baseUrl.trim() ? baseUrl.trim() : undefined,
    });
  };

  return (
    <div className="bg-depth-1 p-3 rounded-md border border-accent-border space-y-2 mb-2">
      <input
        type="text"
        placeholder="Key name (e.g., My OpenAI)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
      />
      <select
        value={provider}
        onChange={e => setProvider(e.target.value as ProviderType)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
      >
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="openai-compatible">OpenAI-Compatible</option>
      </select>
      <input
        type="password"
        placeholder="API Key"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
      />
      {(provider === "openai-compatible" || provider === "openai") && (
        <input
          type="text"
          placeholder={provider === "openai-compatible" ? "Base URL (required)" : "Base URL (optional override)"}
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
        />
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || (provider === "openai-compatible" && !baseUrl.trim())}
          className="px-3 py-1 text-xs bg-neon-cyan text-primary-foreground rounded font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-dim hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProviderKeyItem({ providerKey, onTest, onDelete }: {
  providerKey: ProviderKey;
  onTest: () => void;
  onDelete: () => void;
}) {
  const maskedKey = providerKey.apiKey
    ? `${"*".repeat(4)}${providerKey.apiKey.slice(-4)}`
    : "(empty)";

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-depth-3 rounded-md border border-[rgba(14,210,247,0.06)] group hover:border-[rgba(14,210,247,0.15)] transition-all duration-150">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{providerKey.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(14,210,247,0.08)] text-neon-cyan">
            {providerKey.provider}
          </span>
        </div>
        <div className="text-[10px] text-dim opacity-50 mt-0.5 font-mono">
          {maskedKey}
          {providerKey.baseUrl && (
            <span className="ml-2">{providerKey.baseUrl}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onTest}
          className="text-[10px] px-2 py-0.5 text-neon-cyan border border-accent-border rounded hover:bg-[rgba(14,210,247,0.08)] transition-all duration-150"
        >
          Test
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] px-2 py-0.5 text-neon-pink border border-[rgba(244,86,157,0.15)] rounded hover:bg-[rgba(244,86,157,0.08)] transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// --- Model Config Management ---

function AddModelForm({ providerKeys, onSave, onCancel }: {
  providerKeys: ProviderKey[];
  onSave: (config: Omit<ModelConfig, "id">) => void;
  onCancel: () => void;
}) {
  const [modelId, setModelId] = useState("");
  const [providerKeyId, setProviderKeyId] = useState(providerKeys[0]?.id || "");
  const [displayName, setDisplayName] = useState("");

  const handleSave = () => {
    if (!modelId.trim() || !providerKeyId) return;
    onSave({
      modelId: modelId.trim(),
      providerKeyId,
      displayName: displayName.trim() || undefined,
    });
  };

  return (
    <div className="bg-depth-1 p-3 rounded-md border border-accent-border space-y-2 mb-2">
      <input
        type="text"
        placeholder="Model ID (e.g., gpt-4o, claude-sonnet-4)"
        value={modelId}
        onChange={e => setModelId(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
      />
      <select
        value={providerKeyId}
        onChange={e => setProviderKeyId(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
      >
        {providerKeys.map(k => (
          <option key={k.id} value={k.id}>{k.name} ({k.provider})</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Display name (optional)"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-depth-3 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-dim placeholder:opacity-40"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!modelId.trim() || !providerKeyId}
          className="px-3 py-1 text-xs bg-neon-cyan text-primary-foreground rounded font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-dim hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ModelConfigItem({ config, providerKeys, onDelete }: {
  config: ModelConfig;
  providerKeys: ProviderKey[];
  onDelete: () => void;
}) {
  const key = providerKeys.find(k => k.id === config.providerKeyId);

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-depth-3 rounded-md border border-[rgba(14,210,247,0.06)] group hover:border-[rgba(14,210,247,0.15)] transition-all duration-150">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate font-mono">{config.modelId}</span>
        </div>
        <div className="text-[10px] text-dim opacity-50 mt-0.5">
          {config.displayName && <span className="mr-2">{config.displayName}</span>}
          Key: {key?.name || "Unknown"}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-[10px] px-2 py-0.5 text-neon-pink border border-[rgba(244,86,157,0.15)] rounded hover:bg-[rgba(244,86,157,0.08)] transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// --- Main Tab ---

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ plugin }) => {
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>(plugin.settings.providerKeys);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(plugin.settings.modelConfigs);
  const [activeModelConfigId, setActiveModelConfigId] = useState(plugin.settings.activeModelConfigId);
  const [showAddKey, setShowAddKey] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);

  const saveSettings = async (
    keys: ProviderKey[],
    configs: ModelConfig[],
    activeId: string,
  ) => {
    plugin.settings.providerKeys = keys;
    plugin.settings.modelConfigs = configs;
    plugin.settings.activeModelConfigId = activeId;
    await plugin.saveSettings();
  };

  useEffect(() => {
    saveSettings(providerKeys, modelConfigs, activeModelConfigId);
  }, [providerKeys, modelConfigs, activeModelConfigId]);

  const handleAddKey = (keyData: Omit<ProviderKey, "id">) => {
    const newKey: ProviderKey = { id: crypto.randomUUID(), ...keyData };
    setProviderKeys(prev => [...prev, newKey]);
    setShowAddKey(false);
  };

  const handleDeleteKey = (keyId: string) => {
    setProviderKeys(prev => prev.filter(k => k.id !== keyId));
    setModelConfigs(prev => {
      const remaining = prev.filter(c => c.providerKeyId !== keyId);
      if (!remaining.find(c => c.id === activeModelConfigId)) {
        setActiveModelConfigId(remaining[0]?.id || "");
      }
      return remaining;
    });
  };

  const handleTestKey = async (key: ProviderKey) => {
    const aiService = new AIService(plugin.settings);
    const result = await aiService.validateKey(key);
    const { Notice } = await import("obsidian");
    if (result.valid) {
      new Notice(`Key "${key.name}" is valid`, 3000);
    } else {
      new Notice(`Key "${key.name}" failed: ${result.error}`, 5000);
    }
  };

  const handleAddModel = (configData: Omit<ModelConfig, "id">) => {
    const newConfig: ModelConfig = { id: crypto.randomUUID(), ...configData };
    setModelConfigs(prev => [...prev, newConfig]);
    if (modelConfigs.length === 0) {
      setActiveModelConfigId(newConfig.id);
    }
    setShowAddModel(false);
  };

  const handleDeleteModel = (configId: string) => {
    setModelConfigs(prev => {
      const remaining = prev.filter(c => c.id !== configId);
      if (activeModelConfigId === configId) {
        setActiveModelConfigId(remaining[0]?.id || "");
      }
      return remaining;
    });
  };

  const handleActiveModelChange = (configId: string) => {
    setActiveModelConfigId(configId);
  };

  return (
    <div className="space-y-6">
      {/* Provider Keys Section */}
      <div className="bg-depth-3 p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold m-0 text-neon-cyan">Provider Keys</h3>
          <button
            onClick={() => setShowAddKey(!showAddKey)}
            className="text-xs px-2.5 py-1 bg-[rgba(14,210,247,0.1)] text-neon-cyan border border-accent-border rounded hover:bg-[rgba(14,210,247,0.18)] active:scale-[0.97] transition-all duration-150"
          >
            + Add
          </button>
        </div>
        {showAddKey && (
          <AddKeyForm
            onSave={handleAddKey}
            onCancel={() => setShowAddKey(false)}
          />
        )}
        <div className="space-y-1.5">
          {providerKeys.length === 0 && !showAddKey && (
            <p className="text-xs text-dim opacity-50 py-2 text-center">
              No provider keys configured. Click + Add to get started.
            </p>
          )}
          {providerKeys.map(key => (
            <ProviderKeyItem
              key={key.id}
              providerKey={key}
              onTest={() => handleTestKey(key)}
              onDelete={() => handleDeleteKey(key.id)}
            />
          ))}
        </div>
      </div>

      {/* Model Configurations Section */}
      <div className="bg-depth-3 p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold m-0 text-neon-cyan">Model Configurations</h3>
          <button
            onClick={() => setShowAddModel(!showAddModel)}
            disabled={providerKeys.length === 0}
            className="text-xs px-2.5 py-1 bg-[rgba(14,210,247,0.1)] text-neon-cyan border border-accent-border rounded hover:bg-[rgba(14,210,247,0.18)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add
          </button>
        </div>
        {showAddModel && (
          <AddModelForm
            providerKeys={providerKeys}
            onSave={handleAddModel}
            onCancel={() => setShowAddModel(false)}
          />
        )}
        <div className="space-y-1.5">
          {modelConfigs.length === 0 && !showAddModel && (
            <p className="text-xs text-dim opacity-50 py-2 text-center">
              {providerKeys.length === 0
                ? "Add a provider key first, then configure models."
                : "No models configured. Click + Add to configure a model."}
            </p>
          )}
          {modelConfigs.map(config => (
            <ModelConfigItem
              key={config.id}
              config={config}
              providerKeys={providerKeys}
              onDelete={() => handleDeleteModel(config.id)}
            />
          ))}
        </div>
      </div>

      {/* Active Model Selector */}
      {modelConfigs.length > 0 && (
        <div className="bg-depth-3 p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <h3 className="text-lg font-semibold mb-3 mt-0 text-neon-cyan">Active Model</h3>
          <select
            value={activeModelConfigId}
            onChange={e => handleActiveModelChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-depth-1 text-foreground border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
          >
            <option value="">Select a model...</option>
            {modelConfigs.map(config => {
              const key = providerKeys.find(k => k.id === config.providerKeyId);
              const label = config.displayName
                ? `${config.modelId} (${config.displayName})`
                : config.modelId;
              return (
                <option key={config.id} value={config.id}>
                  {label} — {key?.name || "Unknown key"}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
};
