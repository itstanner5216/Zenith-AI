## Layer 2: AI Core

### Task 2.1 — Create provider factory

**New file:** `packages/plugin/services/ai/provider-factory.ts`

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { ProviderKey } from "./types";

/**
 * Creates an AI SDK LanguageModel instance from a ProviderKey + model ID.
 * This is the only place where provider-specific SDK code lives.
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
      return provider(modelId);
    }

    case "anthropic": {
      const provider = createAnthropic({
        apiKey: key.apiKey,
      });
      return provider(modelId);
    }

    case "openai-compatible": {
      if (!key.baseUrl) {
        throw new Error(`OpenAI-compatible provider "${key.name}" requires a base URL`);
      }
      const provider = createOpenAI({
        apiKey: key.apiKey || "not-needed",
        baseURL: key.baseUrl,
      });
      return provider(modelId);
    }

    default:
      throw new Error(`Unknown provider type: ${(key as ProviderKey).provider}`);
  }
}
```

**Test file:** `packages/plugin/services/ai/provider-factory.test.ts`

```typescript
import { createModelFromKey } from "./provider-factory";
import type { ProviderKey } from "./types";

// We can't call the actual providers without real keys, but we can test:
// 1. That each provider type creates without throwing
// 2. That openai-compatible without baseUrl throws
// 3. That unknown provider type throws

// Mock the provider SDKs since we can't hit real APIs
jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn((opts: any) => {
    return (modelId: string) => ({ modelId, provider: "openai", opts });
  }),
}));

jest.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: jest.fn((opts: any) => {
    return (modelId: string) => ({ modelId, provider: "anthropic", opts });
  }),
}));

describe("createModelFromKey", () => {
  it("creates an OpenAI model", () => {
    const key: ProviderKey = {
      id: "1",
      name: "Test OpenAI",
      provider: "openai",
      apiKey: "sk-test",
    };
    const model = createModelFromKey(key, "gpt-4o") as any;
    expect(model.modelId).toBe("gpt-4o");
    expect(model.provider).toBe("openai");
  });

  it("creates an OpenAI model with custom base URL", () => {
    const key: ProviderKey = {
      id: "2",
      name: "Custom OpenAI",
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://custom.openai.com/v1",
    };
    const model = createModelFromKey(key, "gpt-4o") as any;
    expect(model.opts.baseURL).toBe("https://custom.openai.com/v1");
  });

  it("creates an Anthropic model", () => {
    const key: ProviderKey = {
      id: "3",
      name: "Test Anthropic",
      provider: "anthropic",
      apiKey: "sk-ant-test",
    };
    const model = createModelFromKey(key, "claude-sonnet-4") as any;
    expect(model.modelId).toBe("claude-sonnet-4");
    expect(model.provider).toBe("anthropic");
  });

  it("creates an OpenAI-compatible model with base URL", () => {
    const key: ProviderKey = {
      id: "4",
      name: "Ollama",
      provider: "openai-compatible",
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
    };
    const model = createModelFromKey(key, "llama3:8b") as any;
    expect(model.modelId).toBe("llama3:8b");
    expect(model.opts.baseURL).toBe("http://localhost:11434/v1");
  });

  it("throws for openai-compatible without base URL", () => {
    const key: ProviderKey = {
      id: "5",
      name: "Missing URL",
      provider: "openai-compatible",
      apiKey: "",
    };
    expect(() => createModelFromKey(key, "model")).toThrow("requires a base URL");
  });

  it("throws for unknown provider type", () => {
    const key = {
      id: "6",
      name: "Unknown",
      provider: "unknown" as any,
      apiKey: "",
    };
    expect(() => createModelFromKey(key, "model")).toThrow("Unknown provider type");
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test -- --testPathPattern="services/ai/provider-factory.test"
```

---

### Task 2.2 — Create tool adapter

**New file:** `packages/plugin/services/ai/tool-adapter.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { ToolSet } from "ai";

/**
 * Creates AI SDK tool definitions for the plugin's vault operations.
 *
 * Tools are defined WITHOUT execute functions — execution happens client-side
 * via ToolCallHandler React components. The AI SDK will emit tool calls,
 * and the chat hook collects results from the UI before re-sending.
 */
export function createPluginTools(): ToolSet {
  return {
    getSearchQuery: tool({
      description: "Generate a semantic search query to find relevant notes in the vault.",
      parameters: z.object({
        query: z.string().describe("The search query"),
        reasoning: z.string().optional().describe("Why this query was chosen"),
      }),
    }),

    getLastModifiedFiles: tool({
      description: "Get recently modified files in the vault.",
      parameters: z.object({
        count: z.number().optional().describe("Number of files to return"),
      }),
    }),

    openFile: tool({
      description: "Open a file in the vault.",
      parameters: z.object({
        filePath: z.string().describe("Path to the file to open"),
      }),
    }),

    moveFiles: tool({
      description: "Move files to a different folder in the vault.",
      parameters: z.object({
        filePaths: z.array(z.string()).describe("Paths of files to move"),
        destinationFolder: z.string().describe("Target folder path"),
      }),
    }),

    renameFiles: tool({
      description: "Rename files in the vault.",
      parameters: z.object({
        renames: z.array(z.object({
          oldPath: z.string(),
          newName: z.string(),
        })).describe("List of files to rename"),
      }),
    }),
  };
}
```

**Test file:** `packages/plugin/services/ai/tool-adapter.test.ts`

```typescript
import { createPluginTools } from "./tool-adapter";

describe("createPluginTools", () => {
  it("returns a ToolSet with all expected tools", () => {
    const tools = createPluginTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("getSearchQuery");
    expect(toolNames).toContain("getLastModifiedFiles");
    expect(toolNames).toContain("openFile");
    expect(toolNames).toContain("moveFiles");
    expect(toolNames).toContain("renameFiles");
    expect(toolNames).toHaveLength(5);
  });

  it("each tool has parameters but no execute function", () => {
    const tools = createPluginTools();
    for (const [name, t] of Object.entries(tools)) {
      expect(t.parameters).toBeDefined();
      // Tools without execute return undefined for tool.execute
      // The AI SDK handles this as "client-side execution"
      expect((t as any).execute).toBeUndefined();
    }
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test -- --testPathPattern="services/ai/tool-adapter.test"
```

---

### Task 2.3 — Create AI service

**New file:** `packages/plugin/services/ai/ai-service.ts`

```typescript
import { streamText } from "ai";
import type { LanguageModel, ToolSet, StepResult } from "ai";
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
    messages: Parameters<typeof streamText>[0]["messages"];
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
      ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
      ...(params.tools ? { tools: params.tools } : {}),
      ...(params.maxSteps ? { maxSteps: params.maxSteps } : {}),
      ...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
      ...(params.onStepFinish ? { onStepFinish: params.onStepFinish } : {}),
    });
  }

  /** Validate that a provider key works by sending a minimal request */
  async validateKey(key: ProviderKey): Promise<{ valid: boolean; error?: string }> {
    try {
      const testModel = key.provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini";
      const model = createModelFromKey(key, testModel);
      const result = await streamText({
        model,
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 1,
      });
      // Consume the stream to trigger the request
      for await (const _ of result.textStream) { break; }
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message || "Unknown error" };
    }
  }
}
```

**Test file:** `packages/plugin/services/ai/ai-service.test.ts`

```typescript
import { AIService } from "./ai-service";
import { ZenithAISettings } from "../../settings";
import type { ProviderKey, ModelConfig } from "./types";

// Mock provider factory
jest.mock("./provider-factory", () => ({
  createModelFromKey: jest.fn((key: any, modelId: string) => ({
    modelId,
    provider: key.provider,
  })),
}));

// Mock streamText
jest.mock("ai", () => ({
  streamText: jest.fn(() => ({
    textStream: (async function* () { yield "test"; })(),
  })),
}));

describe("AIService", () => {
  let settings: ZenithAISettings;
  let testKey: ProviderKey;
  let testConfig: ModelConfig;

  beforeEach(() => {
    settings = new ZenithAISettings();
    testKey = {
      id: "key-1",
      name: "Test Key",
      provider: "openai",
      apiKey: "sk-test",
    };
    testConfig = {
      id: "config-1",
      modelId: "gpt-4o",
      providerKeyId: "key-1",
      displayName: "Test Model",
    };
    settings.providerKeys = [testKey];
    settings.modelConfigs = [testConfig];
    settings.activeModelConfigId = "config-1";
  });

  it("getActiveModel resolves config and key", () => {
    const service = new AIService(settings);
    const result = service.getActiveModel();

    expect(result.config).toBe(testConfig);
    expect(result.key).toBe(testKey);
    expect(result.model).toBeDefined();
  });

  it("getActiveModel throws when no active config", () => {
    settings.activeModelConfigId = "nonexistent";
    const service = new AIService(settings);

    expect(() => service.getActiveModel()).toThrow("No active model configured");
  });

  it("getActiveModel throws when provider key missing", () => {
    settings.providerKeys = [];
    const service = new AIService(settings);

    expect(() => service.getActiveModel()).toThrow("Provider key not found");
  });

  it("getModelForConfig resolves a specific config", () => {
    const service = new AIService(settings);
    const model = service.getModelForConfig("config-1");

    expect(model).toBeDefined();
  });

  it("getModelForConfig throws for unknown config", () => {
    const service = new AIService(settings);

    expect(() => service.getModelForConfig("nonexistent")).toThrow("Model config not found");
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test -- --testPathPattern="services/ai/ai-service.test"
```

---
