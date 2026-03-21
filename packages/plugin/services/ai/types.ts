/** Supported first-class provider types */
export type ProviderType = "openai" | "anthropic" | "openai-compatible";

/** A named API key entry stored in plugin settings */
export interface ProviderKey {
  id: string;              // crypto.randomUUID()
  name: string;            // user-facing label ("My OpenAI", "Work Claude")
  provider: ProviderType;  // determines which AI SDK provider to instantiate
  apiKey: string;          // stored in Obsidian data.json
  baseUrl?: string;        // required for openai-compatible, optional override for openai
}

/** A model configuration that references a provider key */
export interface ModelConfig {
  id: string;              // crypto.randomUUID()
  modelId: string;         // free-text ("gpt-4o", "claude-sonnet-4", any string)
  providerKeyId: string;   // FK to ProviderKey.id
  displayName?: string;    // optional friendly name shown in selectors
}

/** Token usage reported after completion */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}
