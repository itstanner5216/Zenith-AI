import type { ZenithAISettings } from "../settings";
import type { ProviderKey, ModelConfig } from "./ai/types";

/** Shape of the old settings format (pre-migration) */
interface LegacySettingsData {
  API_KEY?: string;
  selectedModel?: string;
  selfHostingURL?: string;
  debugMode?: boolean;
  providerKeys?: ProviderKey[];
  modelConfigs?: ModelConfig[];
  activeModelConfigId?: string;
}

/**
 * Migrates legacy settings to the new provider key + model config format.
 * Mutates the settings object in-place. Returns true if migration occurred.
 */
export function migrateSettings(settings: ZenithAISettings, rawData: LegacySettingsData): boolean {
  const legacyKey = rawData.API_KEY;
  const legacyModel = rawData.selectedModel;

  // Already migrated or no legacy data
  if (!legacyKey && !legacyModel) return false;
  // Don't re-migrate if new data already exists
  if (settings.providerKeys.length > 0) return false;

  const keyId = crypto.randomUUID();
  const configId = crypto.randomUUID();

  if (legacyKey) {
    const providerKey: ProviderKey = {
      id: keyId,
      name: "Migrated Key",
      provider: "openai",
      apiKey: legacyKey,
    };
    settings.providerKeys.push(providerKey);

    if (legacyModel) {
      const modelConfig: ModelConfig = {
        id: configId,
        modelId: legacyModel,
        providerKeyId: keyId,
        displayName: legacyModel,
      };
      settings.modelConfigs.push(modelConfig);
      settings.activeModelConfigId = configId;
    }
  }

  return true;
}
