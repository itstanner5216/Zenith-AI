import type { ProviderKey, ModelConfig } from "./services/ai/types";

export class ZenithAISettings {
  /** Named API key entries — users register keys with a label + provider type */
  providerKeys: ProviderKey[] = [];

  /** Model configurations — each references a provider key */
  modelConfigs: ModelConfig[] = [];

  /** ID of the currently active model config (used for chat) */
  activeModelConfigId: string = "";

  /** Self-hosted backend URL (retained for future features) */
  selfHostingURL: string = "http://localhost:3010";

  /** Enable debug logging */
  debugMode: boolean = false;
}

export const DEFAULT_SETTINGS = new ZenithAISettings();
