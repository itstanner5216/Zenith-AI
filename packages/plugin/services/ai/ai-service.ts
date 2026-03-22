import { streamText } from "ai";
import type { LanguageModel, ToolSet, StepResult, ModelMessage } from "ai";
import { createModelFromKey } from "./provider-factory";
import type { ProviderKey, ModelConfig } from "./types";
import type { ZenithAISettings } from "../../settings";

export class AIService {
  constructor(private settings: ZenithAISettings) {}

  /** Resolve the active model config + provider key, return a LanguageModel */
  getActiveModel(): { model: LanguageModel; config: ModelConfig; key: ProviderKey } {
    const config = this.settings.modelConfigs.find(
      c => c.id === this.settings.activeModelConfigId
    );
    if (!config) throw new Error("No active model configured");

    const key = this.settings.providerKeys.find(
      k => k.id === config.providerKeyId
    );
    if (!key) throw new Error(`Provider key not found for model "${config.displayName || config.modelId}"`);

    return {
      model: createModelFromKey(key, config.modelId),
      config,
      key,
    };
  }

  /** Create a model from a specific config ID (for future mode system) */
  getModelForConfig(configId: string): LanguageModel {
    const config = this.settings.modelConfigs.find(c => c.id === configId);
    if (!config) throw new Error(`Model config not found: ${configId}`);

    const key = this.settings.providerKeys.find(k => k.id === config.providerKeyId);
    if (!key) throw new Error(`Provider key not found: ${config.providerKeyId}`);

    return createModelFromKey(key, config.modelId);
  }

  /** Stream a chat completion using the active model */
  streamChat(params: {
    messages: ModelMessage[];
    systemPrompt?: string;
    tools?: ToolSet;
    abortSignal?: AbortSignal;
    maxSteps?: number;
    onStepFinish?: (step: StepResult<any>) => void;
  }) {
    const { model } = this.getActiveModel();

    return streamText({
      model,
      messages: params.messages,
      system: params.systemPrompt,
      tools: params.tools,
      maxSteps: params.maxSteps,
      abortSignal: params.abortSignal,
      onStepFinish: params.onStepFinish,
    });
  }

  /** Validate that a provider key works by sending a minimal request */
  async validateKey(key: ProviderKey): Promise<{ valid: boolean; error?: string }> {
    try {
      const testModel =
        key.provider === "anthropic"
          ? "claude-haiku-4-5-20250714"
          : key.provider === "openai-compatible"
            ? (key.baseUrl?.includes("localhost") ? "llama3" : "gpt-4o-mini")
            : "gpt-4o-mini";
      const model = createModelFromKey(key, testModel);
      const result = await streamText({
        model,
        messages: [{ role: "user", content: "hi" }],
      });
      // Consume the stream to trigger the request
      for await (const _ of result.textStream) { break; }
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message || "Unknown error" };
    }
  }
}
