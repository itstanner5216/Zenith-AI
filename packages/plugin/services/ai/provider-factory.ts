import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { ProviderKey } from "./types";

/**
 * Creates an AI SDK LanguageModel instance from a ProviderKey + model ID.
 * This is the only place where provider-specific SDK code lives.
 *
 * The provider SDKs return LanguageModelV1 but streamText expects
 * LanguageModelV2. At runtime they're compatible via internal adapters.
 * We cast through unknown to bridge the type gap cleanly.
 */
export function createModelFromKey(
  key: ProviderKey,
  modelId: string
): LanguageModel {
  switch (key.provider) {
    case "openai": {
      const provider = createOpenAI({
        apiKey: key.apiKey,
        ...(key.baseUrl ? { baseURL: key.baseUrl } : {}),
      });
      return provider(modelId) as unknown as LanguageModel;
    }

    case "anthropic": {
      const provider = createAnthropic({
        apiKey: key.apiKey,
      });
      return provider(modelId) as unknown as LanguageModel;
    }

    case "openai-compatible": {
      if (!key.baseUrl) {
        throw new Error(`OpenAI-compatible provider "${key.name}" requires a base URL`);
      }
      const provider = createOpenAI({
        apiKey: key.apiKey,
        baseURL: key.baseUrl,
      });
      return provider(modelId) as unknown as LanguageModel;
    }

    default:
      throw new Error(`Unknown provider type: ${key.provider}`);
  }
}
