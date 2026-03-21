# AI Provider Integration — Implementation Plan

> **Design doc:** `docs/plans/2026-03-21-ai-provider-integration-design.md`
> **Status:** Ready for execution
> **Approach:** Ground-up rebuild. No patches. Each task produces working, testable code.

---

## Execution Order

Tasks are grouped into layers. Within each layer, tasks are independent and can run in parallel. Across layers, each layer depends on the previous.

```
Layer 0: Dependencies
Layer 1: Foundation (types, settings, migration)
Layer 2: AI Core (provider factory, tool adapter, AI service)
Layer 3: Chat Hook (useZenithChat)
Layer 4: UI (providers tab, model selector, general tab, settings tabs)
Layer 5: Integration (chat.tsx swap, prop cleanup)
Layer 6: Cleanup (remove dead code, build, verify)
```

---

## Layer 0: Dependencies

### Task 0.1 — Add `@ai-sdk/anthropic` dependency

**File:** `packages/plugin/package.json`

**Change:** Add `@ai-sdk/anthropic` to dependencies.

```jsonc
// In "dependencies", add:
"@ai-sdk/anthropic": "catalog:",
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI && pnpm install
```

---

## Layer 1: Foundation

### Task 1.1 — Create AI types

**New file:** `packages/plugin/services/ai/types.ts`

```typescript
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
```

**Test file:** `packages/plugin/services/ai/types.test.ts`

```typescript
import type { ProviderType, ProviderKey, ModelConfig, TokenUsage } from "./types";

describe("AI types", () => {
  it("ProviderKey satisfies the interface", () => {
    const key: ProviderKey = {
      id: "test-id",
      name: "Test Key",
      provider: "openai",
      apiKey: "sk-test",
    };
    expect(key.provider).toBe("openai");
  });

  it("ModelConfig references a provider key", () => {
    const config: ModelConfig = {
      id: "config-id",
      modelId: "gpt-4o",
      providerKeyId: "test-id",
      displayName: "Daily Driver",
    };
    expect(config.providerKeyId).toBe("test-id");
  });

  it("ProviderType only allows valid values", () => {
    const types: ProviderType[] = ["openai", "anthropic", "openai-compatible"];
    expect(types).toHaveLength(3);
  });

  it("ProviderKey.baseUrl is optional", () => {
    const key: ProviderKey = {
      id: "id",
      name: "Name",
      provider: "openai",
      apiKey: "key",
    };
    expect(key.baseUrl).toBeUndefined();
  });

  it("ModelConfig.displayName is optional", () => {
    const config: ModelConfig = {
      id: "id",
      modelId: "model",
      providerKeyId: "key-id",
    };
    expect(config.displayName).toBeUndefined();
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && npx tsc --noEmit && pnpm test -- --testPathPattern="services/ai/types.test"
```

---

### Task 1.2 — Rewrite settings.ts

**File:** `packages/plugin/settings.ts`

**Replace entire file** with:

```typescript
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
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && npx tsc --noEmit
```

> **Note:** This will cause type errors in files that reference `API_KEY` or `selectedModel`. Those are fixed in later tasks. Typecheck verification is deferred to Layer 6.

---

### Task 1.3 — Add settings migration logic

**New file:** `packages/plugin/services/settings-migration.ts`

This runs on plugin load to migrate old `API_KEY` + `selectedModel` to the new structure.

```typescript
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
```

**Test file:** `packages/plugin/services/settings-migration.test.ts`

```typescript
import { migrateSettings } from "./settings-migration";
import { ZenithAISettings } from "../settings";

// Mock crypto.randomUUID for deterministic tests
const originalRandomUUID = crypto.randomUUID;
beforeEach(() => {
  let counter = 0;
  crypto.randomUUID = () => `test-uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`;
});
afterEach(() => {
  crypto.randomUUID = originalRandomUUID;
});

describe("migrateSettings", () => {
  it("migrates API_KEY and selectedModel to new format", () => {
    const settings = new ZenithAISettings();
    const rawData = { API_KEY: "sk-test-key", selectedModel: "gpt-4o" };

    const migrated = migrateSettings(settings, rawData);

    expect(migrated).toBe(true);
    expect(settings.providerKeys).toHaveLength(1);
    expect(settings.providerKeys[0].name).toBe("Migrated Key");
    expect(settings.providerKeys[0].provider).toBe("openai");
    expect(settings.providerKeys[0].apiKey).toBe("sk-test-key");

    expect(settings.modelConfigs).toHaveLength(1);
    expect(settings.modelConfigs[0].modelId).toBe("gpt-4o");
    expect(settings.modelConfigs[0].providerKeyId).toBe(settings.providerKeys[0].id);
    expect(settings.activeModelConfigId).toBe(settings.modelConfigs[0].id);
  });

  it("migrates API_KEY without selectedModel", () => {
    const settings = new ZenithAISettings();
    const rawData = { API_KEY: "sk-test-key" };

    const migrated = migrateSettings(settings, rawData);

    expect(migrated).toBe(true);
    expect(settings.providerKeys).toHaveLength(1);
    expect(settings.modelConfigs).toHaveLength(0);
    expect(settings.activeModelConfigId).toBe("");
  });

  it("does nothing when no legacy data exists", () => {
    const settings = new ZenithAISettings();
    const rawData = {};

    const migrated = migrateSettings(settings, rawData);

    expect(migrated).toBe(false);
    expect(settings.providerKeys).toHaveLength(0);
    expect(settings.modelConfigs).toHaveLength(0);
  });

  it("does not re-migrate if providerKeys already exist", () => {
    const settings = new ZenithAISettings();
    settings.providerKeys = [{ id: "existing", name: "Existing", provider: "openai", apiKey: "sk-existing" }];
    const rawData = { API_KEY: "sk-old", selectedModel: "old-model" };

    const migrated = migrateSettings(settings, rawData);

    expect(migrated).toBe(false);
    expect(settings.providerKeys).toHaveLength(1);
    expect(settings.providerKeys[0].id).toBe("existing");
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test -- --testPathPattern="services/settings-migration.test"
```

---

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

## Layer 3: Chat Hook

### Task 3.1 — Create useZenithChat hook

**New file:** `packages/plugin/views/assistant/ai-chat/hooks/use-zenith-chat.ts`

This is the most critical file. It replaces `useChat` from `@ai-sdk/react`.

```typescript
import { useState, useCallback, useRef } from "react";
import { convertToCoreMessages } from "ai";
import type { UIMessage, ToolSet, StepResult } from "ai";
import type { AIService } from "../../../../services/ai/ai-service";

/** Status states that match the existing ToolCallHandler's expectations */
export type ChatStatus = "ready" | "submitted" | "streaming";

export interface UseZenithChatOptions {
  aiService: AIService;
  tools?: ToolSet;
  maxSteps?: number;
  onFinish?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
  onStepFinish?: (step: StepResult<any>) => void;
}

export interface UseZenithChatReturn {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | null;
  sendMessage: (content: string, opts?: {
    context?: string;
    systemPrompt?: string;
  }) => Promise<void>;
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  stop: () => void;
  reload: (opts?: { context?: string; systemPrompt?: string }) => Promise<void>;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
}

/**
 * useZenithChat — replaces @ai-sdk/react's useChat.
 *
 * Calls AIService.streamChat() directly (no server needed).
 * Manages message state, streaming, tool result collection, abort, reload.
 */
export function useZenithChat(options: UseZenithChatOptions): UseZenithChatReturn {
  const { aiService, tools, maxSteps = 5, onFinish, onError, onStepFinish } = options;

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  /**
   * Core streaming function. Converts current messages to core format,
   * calls streamText, and processes the stream chunk by chunk.
   */
  const runStream = useCallback(async (
    currentMessages: UIMessage[],
    systemPrompt?: string,
  ) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setStatus("submitted");

      const coreMessages = convertToCoreMessages(currentMessages);

      const result = aiService.streamChat({
        messages: coreMessages,
        systemPrompt,
        tools,
        maxSteps,
        abortSignal: abortController.signal,
        onStepFinish,
      });

      // Create the assistant message shell
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        parts: [],
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStatus("streaming");

      let accumulatedText = "";

      // Process the text stream
      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break;
        accumulatedText += chunk;

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: accumulatedText,
              parts: [{ type: "text" as const, text: accumulatedText }],
            };
          }
          return updated;
        });
      }

      // After stream completes, get the final result with tool calls etc.
      const finalResult = await result;

      // Build final parts from the response
      const finalParts: UIMessage["parts"] = [];

      // Add tool call parts if any
      if (finalResult.toolCalls && finalResult.toolCalls.length > 0) {
        for (const tc of finalResult.toolCalls) {
          finalParts.push({
            type: "tool-invocation" as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
            state: "call" as const,
          } as any);
        }
      }

      // Add text part
      const finalText = finalResult.text || accumulatedText;
      if (finalText) {
        finalParts.push({ type: "text" as const, text: finalText });
      }

      // Update the assistant message with final parts
      const finalMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: finalText,
        parts: finalParts.length > 0 ? finalParts : [{ type: "text" as const, text: finalText }],
      };

      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
          updated[lastIdx] = finalMessage;
        }
        return updated;
      });

      onFinish?.(finalMessage);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — not an error
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      isGeneratingRef.current = false;
      abortControllerRef.current = null;
      setStatus("ready");
    }
  }, [aiService, tools, maxSteps, onFinish, onError, onStepFinish]);

  /** Send a new user message and stream the assistant response */
  const sendMessage = useCallback(async (
    content: string,
    opts?: { context?: string; systemPrompt?: string },
  ) => {
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      parts: [{ type: "text" as const, text: content }],
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Build system prompt with optional context
    let systemPrompt = opts?.systemPrompt || "";
    if (opts?.context) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n<context>\n${opts.context}\n</context>`
        : `<context>\n${opts.context}\n</context>`;
    }

    await runStream(updatedMessages, systemPrompt || undefined);
  }, [messages, runStream]);

  /** Add a tool result and potentially re-stream for multi-step */
  const addToolResult = useCallback((result: { toolCallId: string; result: string }) => {
    setMessages(prev => {
      const updated = prev.map(msg => {
        if (msg.role !== "assistant") return msg;

        const updatedParts = msg.parts?.map(part => {
          if (
            part.type === "tool-invocation" &&
            (part as any).toolCallId === result.toolCallId
          ) {
            return {
              ...part,
              state: "output-available" as const,
              output: result.result,
            };
          }
          return part;
        });

        return { ...msg, parts: updatedParts };
      });

      return updated;
    });
  }, []);

  /** Stop the current generation */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /** Reload: remove last assistant message and re-stream */
  const reload = useCallback(async (opts?: { context?: string; systemPrompt?: string }) => {
    // Find and remove the last assistant message
    const lastAssistantIdx = messages.findLastIndex(m => m.role === "assistant");
    if (lastAssistantIdx === -1) return;

    const messagesWithoutLast = messages.slice(0, lastAssistantIdx);
    setMessages(messagesWithoutLast);

    let systemPrompt = opts?.systemPrompt || "";
    if (opts?.context) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n<context>\n${opts.context}\n</context>`
        : `<context>\n${opts.context}\n</context>`;
    }

    await runStream(messagesWithoutLast, systemPrompt || undefined);
  }, [messages, runStream]);

  return {
    messages,
    status,
    error,
    sendMessage,
    addToolResult,
    stop,
    reload,
    setMessages,
  };
}
```

**Test file:** `packages/plugin/views/assistant/ai-chat/hooks/use-zenith-chat.test.ts`

```typescript
/**
 * Note: This hook is tightly coupled to React state and the AI SDK streaming APIs.
 * Unit tests cover the pure logic; integration behavior is verified by building
 * and manually testing the chat in the plugin.
 *
 * The hook's contract is:
 * - It exposes messages, status, error, sendMessage, addToolResult, stop, reload, setMessages
 * - status transitions: ready → submitted → streaming → ready
 * - addToolResult updates the correct tool part's state to "output-available"
 */

// Basic smoke test — the hook module exports the expected function
import { useZenithChat } from "./use-zenith-chat";

describe("useZenithChat module", () => {
  it("exports useZenithChat function", () => {
    expect(typeof useZenithChat).toBe("function");
  });
});
```

**Verify:**
```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test -- --testPathPattern="hooks/use-zenith-chat.test"
```

---

## Layer 4: UI

### Task 4.1 — Create Providers settings tab

**New file:** `packages/plugin/views/settings/providers-tab.tsx`

```typescript
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
    <div className="bg-[#0d0b12] p-3 rounded-md border border-[rgba(14,210,247,0.15)] space-y-2 mb-2">
      <input
        type="text"
        placeholder="Key name (e.g., My OpenAI)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
      />
      <select
        value={provider}
        onChange={e => setProvider(e.target.value as ProviderType)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
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
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
      />
      {(provider === "openai-compatible" || provider === "openai") && (
        <input
          type="text"
          placeholder={provider === "openai-compatible" ? "Base URL (required)" : "Base URL (optional override)"}
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
        />
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || (provider === "openai-compatible" && !baseUrl.trim())}
          className="px-3 py-1 text-xs bg-[#0fb6d6] text-[#0d0b12] rounded font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-[#45aaff] hover:text-[#bebebe] transition-colors"
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
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  const handleTest = async () => {
    setTestStatus("testing");
    onTest();
    // Test status will be updated externally in a real implementation
    // For now, set a timeout to reset
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  const maskedKey = providerKey.apiKey
    ? `${"*".repeat(4)}${providerKey.apiKey.slice(-4)}`
    : "(empty)";

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-[#191621] rounded-md border border-[rgba(14,210,247,0.06)] group hover:border-[rgba(14,210,247,0.15)] transition-all duration-150">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#bebebe] truncate">{providerKey.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(14,210,247,0.08)] text-[#0fb6d6]">
            {providerKey.provider}
          </span>
        </div>
        <div className="text-[10px] text-[#45aaff] opacity-50 mt-0.5 font-mono">
          {maskedKey}
          {providerKey.baseUrl && (
            <span className="ml-2">{providerKey.baseUrl}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleTest}
          className="text-[10px] px-2 py-0.5 text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] rounded hover:bg-[rgba(14,210,247,0.08)] transition-all duration-150"
        >
          Test
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] px-2 py-0.5 text-[#f4569d] border border-[rgba(244,86,157,0.15)] rounded hover:bg-[rgba(244,86,157,0.08)] transition-all duration-150"
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
    <div className="bg-[#0d0b12] p-3 rounded-md border border-[rgba(14,210,247,0.15)] space-y-2 mb-2">
      <input
        type="text"
        placeholder="Model ID (e.g., gpt-4o, claude-sonnet-4)"
        value={modelId}
        onChange={e => setModelId(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
      />
      <select
        value={providerKeyId}
        onChange={e => setProviderKeyId(e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
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
        className="w-full px-3 py-1.5 text-xs rounded-md bg-[#191621] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 placeholder:text-[#45aaff] placeholder:opacity-40"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!modelId.trim() || !providerKeyId}
          className="px-3 py-1 text-xs bg-[#0fb6d6] text-[#0d0b12] rounded font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-[#45aaff] hover:text-[#bebebe] transition-colors"
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
    <div className="flex items-center justify-between py-2 px-3 bg-[#191621] rounded-md border border-[rgba(14,210,247,0.06)] group hover:border-[rgba(14,210,247,0.15)] transition-all duration-150">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#bebebe] truncate font-mono">{config.modelId}</span>
        </div>
        <div className="text-[10px] text-[#45aaff] opacity-50 mt-0.5">
          {config.displayName && <span className="mr-2">{config.displayName}</span>}
          Key: {key?.name || "Unknown"}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-[10px] px-2 py-0.5 text-[#f4569d] border border-[rgba(244,86,157,0.15)] rounded hover:bg-[rgba(244,86,157,0.08)] transition-all duration-150"
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

  // Sync state back to plugin settings
  const saveSettings = async () => {
    plugin.settings.providerKeys = providerKeys;
    plugin.settings.modelConfigs = modelConfigs;
    plugin.settings.activeModelConfigId = activeModelConfigId;
    await plugin.saveSettings();
  };

  useEffect(() => {
    saveSettings();
  }, [providerKeys, modelConfigs, activeModelConfigId]);

  const handleAddKey = (keyData: Omit<ProviderKey, "id">) => {
    const newKey: ProviderKey = { id: crypto.randomUUID(), ...keyData };
    setProviderKeys(prev => [...prev, newKey]);
    setShowAddKey(false);
  };

  const handleDeleteKey = (keyId: string) => {
    setProviderKeys(prev => prev.filter(k => k.id !== keyId));
    // Also remove any model configs that reference this key
    setModelConfigs(prev => {
      const remaining = prev.filter(c => c.providerKeyId !== keyId);
      // If active model was using this key, clear it
      if (!remaining.find(c => c.id === activeModelConfigId)) {
        setActiveModelConfigId(remaining[0]?.id || "");
      }
      return remaining;
    });
  };

  const handleTestKey = async (key: ProviderKey) => {
    const aiService = new AIService(plugin.settings);
    const result = await aiService.validateKey(key);
    // Show result via Obsidian Notice
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
    // Auto-select if first model
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
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold m-0 text-[#0fb6d6]">Provider Keys</h3>
          <button
            onClick={() => setShowAddKey(!showAddKey)}
            className="text-xs px-2.5 py-1 bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] rounded hover:bg-[rgba(14,210,247,0.18)] active:scale-[0.97] transition-all duration-150"
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
            <p className="text-xs text-[#45aaff] opacity-50 py-2 text-center">
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
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold m-0 text-[#0fb6d6]">Model Configurations</h3>
          <button
            onClick={() => setShowAddModel(!showAddModel)}
            disabled={providerKeys.length === 0}
            className="text-xs px-2.5 py-1 bg-[rgba(14,210,247,0.1)] text-[#0fb6d6] border border-[rgba(14,210,247,0.15)] rounded hover:bg-[rgba(14,210,247,0.18)] active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-xs text-[#45aaff] opacity-50 py-2 text-center">
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
        <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <h3 className="text-lg font-semibold mb-3 mt-0 text-[#0fb6d6]">Active Model</h3>
          <select
            value={activeModelConfigId}
            onChange={e => handleActiveModelChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-[#0d0b12] text-[#bebebe] border border-[rgba(14,210,247,0.12)] focus:outline-none focus:border-[rgba(14,210,247,0.5)] transition-all duration-150 cursor-pointer"
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
```

**Verify:** Deferred to Layer 6 (requires full typecheck with updated settings).

---

### Task 4.2 — Rewrite general-tab.tsx

**File:** `packages/plugin/views/settings/general-tab.tsx`

**Replace entire file** with:

```typescript
import React from "react";
import ZenithAI from "../../index";

interface GeneralTabProps {
  plugin: ZenithAI;
}

export const GeneralTab: React.FC<GeneralTabProps> = () => {
  return (
    <div className="zenith-ai-settings space-y-6">
      <div className="bg-[#191621] p-4 rounded-lg border border-[rgba(14,210,247,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
        <h3 className="text-lg font-semibold mb-2 mt-0 text-[#0fb6d6]">
          AI Providers
        </h3>
        <p className="text-xs text-[#45aaff] opacity-70">
          Configure your AI providers and models in the <strong className="text-[#0fb6d6]">Providers</strong> tab.
        </p>
      </div>
    </div>
  );
};
```

---

### Task 4.3 — Add Providers tab to settings main

**File:** `packages/plugin/views/settings/main.tsx`

**Changes:**
1. Add import for `ProvidersTab`
2. Add it to the `tabs` array

**Line 3:** Add import:
```typescript
import { ProvidersTab } from './providers-tab';
```

**Lines 18-21:** Update tabs array:
```typescript
  const tabs: Tab[] = [
    { name: 'General', component: GeneralTab },
    { name: 'Providers', component: ProvidersTab },
    { name: 'Advanced', component: AdvancedTab },
  ];
```

---

### Task 4.4 — Rewrite model-selector.tsx

**File:** `packages/plugin/views/assistant/ai-chat/model-selector.tsx`

**Replace entire file** with a dropdown of configured models:

```typescript
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
  const { modelConfigs, providerKeys } = plugin.settings;

  if (modelConfigs.length === 0) {
    return (
      <span className="text-[10px] text-[#45aaff] opacity-40">
        No models configured
      </span>
    );
  }

  const getLabel = (config: ModelConfig): string => {
    if (config.displayName) return `${config.displayName}`;
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
      className="text-xs px-2 py-0.5 rounded bg-transparent text-[#45aaff] border border-transparent hover:border-[rgba(14,210,247,0.15)] hover:text-[#0fb6d6] hover:bg-[rgba(14,210,247,0.06)] focus:outline-none focus:border-[rgba(14,210,247,0.3)] cursor-pointer transition-all duration-150 appearance-none max-w-[200px] truncate"
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
```

**Also update:** `packages/plugin/views/assistant/ai-chat/types.ts`

**Replace entire file:**
```typescript
export type ModelType = string;

// Re-export AI types for convenience
export type { ProviderType, ProviderKey, ModelConfig, TokenUsage } from "../../../services/ai/types";
```

---

## Layer 5: Integration

### Task 5.1 — Swap useChat → useZenithChat in chat.tsx

This is the largest single change. The `ChatComponent` in `chat.tsx` (1742 lines) needs its core hook swapped.

**File:** `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Changes summary:**

1. **Remove imports** (lines 10, 25-26):
   - Remove: `import { useChat, UseChatOptions } from "@ai-sdk/react";`
   - Remove: `import { UIMessage } from "@ai-sdk/ui-utils";`
   - Keep: `import { convertToCoreMessages, UIMessage as AIUIMessage, isToolUIPart, ToolUIPart } from "ai";`

2. **Add imports:**
   ```typescript
   import { useZenithChat } from "./hooks/use-zenith-chat";
   import { AIService } from "../../../services/ai/ai-service";
   import { createPluginTools } from "../../../services/ai/tool-adapter";
   import type { UIMessage } from "ai";
   ```

3. **Remove `apiKey` from ChatComponentProps** (line 62):
   ```typescript
   // BEFORE
   interface ChatComponentProps {
     plugin: ZenithAI;
     apiKey: string;          // REMOVE THIS
     inputRef: ...
   }

   // AFTER
   interface ChatComponentProps {
     plugin: ZenithAI;
     inputRef: React.RefObject<HTMLDivElement | null>;
     onTokenLimitError?: (error: string) => void;
     activeChatId: string | null;
     onSessionUpdate?: (session: ChatSession) => void;
     chatSessions?: ChatSession[];
     onSelectChat?: (id: string) => void;
     onDeleteChat?: (id: string) => void;
     isChatTabActive?: boolean;
   }
   ```

4. **Remove `apiKey` from destructuring** (line 74):
   ```typescript
   // Remove: apiKey,
   ```

5. **Remove `selectedModel` state** (line 180-182) and replace with `activeModelConfigId`:
   ```typescript
   const [activeModelConfigId, setActiveModelConfigId] = useState(
     plugin.settings.activeModelConfigId
   );
   ```

6. **Remove `ModelType` import** (line 30):
   Remove: `import { ModelType } from "./types";`

7. **Add AIService + useZenithChat** — replace the entire `useChat(...)` block (lines 223-419+) with:
   ```typescript
   const aiService = useMemo(() => new AIService(plugin.settings), [plugin.settings]);
   const pluginTools = useMemo(() => createPluginTools(), []);

   const {
     status,
     messages,
     sendMessage,
     addToolResult,
     stop,
     error,
     reload,
     setMessages,
   } = useZenithChat({
     aiService,
     tools: pluginTools,
     maxSteps: 5,
     onError: error => {
       logger.error("Chat error:", error);
       setErrorMessage(error.message || "An error occurred");
     },
     onFinish: message => {
       // Context snapshot storage
       const contextUsed = lastContextSentRef.current;
       if (message.id) {
         contextByAssistantIdRef.current[message.id] = contextUsed;
       }
       clearEphemeralContext();

       // Session saving
       if (activeChatId) {
         chatHistoryManager.updateSession(activeChatId, {
           messages: messages.concat(message),
         });
         onSessionUpdate?.({
           ...chatHistoryManager.getSession(activeChatId)!,
           messages: messages.concat(message),
         });
       }

       // Vault intelligence event dispatch (for BackgroundScribe)
       plugin.app.workspace.trigger("vault-intelligence:chat-turn" as any, {
         sessionId: activeChatId,
         message,
         context: contextUsed,
       });
     },
   });
   ```

8. **Remove** the `chatBody`, `fullContext`, `contextString` memos (lines 175-218) — context will be built at send time.

9. **Remove** `input`, `handleInputChange`, `handleSubmit` from the hook output (they no longer exist).

10. **Rewrite `handleSendMessage`** (lines 1195-1259):
    ```typescript
    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (status !== "ready") {
        stop();
        return;
      }

      const editor = tiptapEditorRef.current;
      const editorContent = editor?.getText() || "";
      if (!editorContent.trim()) return;

      // Validate that a model is configured
      if (!plugin.settings.activeModelConfigId) {
        new Notice("No model configured. Go to Settings → Providers to set up a model.", 5000);
        return;
      }

      // Build context from Zustand store (same logic as old prepareRequestBody)
      const store = useContextItems.getState();
      const freshContextItems = {
        files: store.files || {},
        folders: store.folders || {},
        tags: store.tags || {},
        currentFile: store.currentFile || null,
        searchResults: store.searchResults || {},
        textSelections: store.textSelections || {},
      };
      const contextJson = JSON.stringify(freshContextItems);

      const contextFilePaths = [
        ...Object.values(freshContextItems.files).map((f: { path: string }) => f.path),
        ...(freshContextItems.currentFile &&
        !Object.values(freshContextItems.files).some(
          (f: { path: string }) => f.path === freshContextItems.currentFile?.path
        )
          ? [freshContextItems.currentFile.path]
          : []),
      ];
      const filePathsBlock =
        contextFilePaths.length > 0
          ? `Attached file paths — use these exact strings for mergeFiles sourceFiles, deleteFiles filePaths (do not modify):\n${contextFilePaths.join("\n")}\n\n`
          : "";
      const freshContextString = filePathsBlock + contextJson;

      // Get fresh editor context
      let freshEditorContext = "";
      try {
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          freshEditorContext = formatEditorContextForAI({
            selectedText: view.editor.getSelection(),
            cursorPosition: view.editor.getCursor(),
            currentLine: view.editor.getLine(view.editor.getCursor().line),
            lineNumber: view.editor.getCursor().line,
            hasSelection: view.editor.getSelection().length > 0,
            filePath: view.file?.path || null,
            fileName: view.file?.basename || null,
            selection: view.editor.getSelection().length > 0
              ? { anchor: view.editor.getCursor("from"), head: view.editor.getCursor("to") }
              : null,
          });
        }
      } catch (err) {
        logger.warn("Failed to get editor context:", err);
      }

      const fullContext = freshEditorContext
        ? `${freshContextString}\n\n${freshEditorContext}`
        : freshContextString;

      // Save for onFinish snapshotting
      lastContextSentRef.current = fullContext;

      // Clear the editor
      editor?.commands.setContent("");

      await sendMessage(editorContent, { context: fullContext });

      setAttachments([]);
    };
    ```

11. **Rewrite `handleMessageRefresh`** — simplified since we use `reload`:
    ```typescript
    const handleMessageRefresh = async (messageIndex: number) => {
      // Remove messages from the index onward (including the one being refreshed)
      const trimmed = messages.slice(0, messageIndex);
      setMessages(trimmed);

      // Rebuild context for reload
      const store = useContextItems.getState();
      const contextJson = JSON.stringify({
        files: store.files || {},
        folders: store.folders || {},
        tags: store.tags || {},
        currentFile: store.currentFile || null,
        searchResults: store.searchResults || {},
        textSelections: store.textSelections || {},
      });
      lastContextSentRef.current = contextJson;

      await reload({ context: contextJson });
    };
    ```

12. **Update `ModelSelector` usage** (lines 1733-1736):
    ```typescript
    <ModelSelector
      selectedModelConfigId={activeModelConfigId}
      onModelSelect={setActiveModelConfigId}
    />
    ```

13. **Remove the `handleTiptapChange` callback** that syncs to `handleInputChange` (line 1265-1268). The Tiptap editor now manages its own state — content is read directly from the editor ref in `handleSendMessage`.

14. **Remove the `onDataChunk` handler** (lines 362-366) — grounding metadata was from the server, no longer applicable.

15. **Remove `groundingMetadata` state and `SourcesSection`** rendering — this was server-side data, not from direct provider calls.

---

### Task 5.2 — Remove `apiKey` prop from container and view

**File:** `packages/plugin/views/assistant/ai-chat/container.tsx`

**Changes:**
1. Remove `apiKey` from `AIChatSidebarProps` (line 20)
2. Remove `apiKey` from destructuring (line 27)
3. Remove `apiKey={apiKey}` from `<ChatComponent>` (line 219)

**File:** `packages/plugin/views/assistant/view.tsx`

**Changes:**
1. Remove `apiKey={plugin.settings.API_KEY}` from both `<AIChatSidebar>` usages (lines 110 and 122)

---

### Task 5.3 — Update index.ts with migration and AIService

**File:** `packages/plugin/index.ts`

**Changes:**

1. **Add imports:**
   ```typescript
   import { migrateSettings } from "./services/settings-migration";
   import { AIService } from "./services/ai/ai-service";
   ```

2. **Remove `getApiKey()` method** (lines 77-79)

3. **Update `loadSettings()` to run migration** (lines 48-50):
   ```typescript
   async loadSettings() {
     const rawData = await this.loadData();
     this.settings = Object.assign({}, DEFAULT_SETTINGS, rawData);

     // Run migration from legacy API_KEY + selectedModel format
     if (migrateSettings(this.settings, rawData || {})) {
       await this.saveSettings();
     }
   }
   ```

4. **Add `aiService` property** to the class:
   ```typescript
   export default class ZenithAI extends Plugin {
     settings: ZenithAISettings;
     backgroundScribe: BackgroundScribe | null = null;
     aiService: AIService | null = null;
   ```

5. **Initialize AIService in onload** (after loadSettings):
   ```typescript
   async onload() {
     await this.initializePlugin();
     logger.configure(this.settings.debugMode);
     await this.saveSettings();

     this.aiService = new AIService(this.settings);

     initializeOrganizer(this);
     // ... rest unchanged
   }
   ```

---

## Layer 6: Cleanup

### Task 6.1 — Remove `@ai-sdk/react` import from chat.tsx

After the swap, `@ai-sdk/react` should have no remaining imports in chat.tsx. Search the entire codebase for any remaining `@ai-sdk/react` usage:

```bash
cd /home/tanner/Projects/Zenith-AI && grep -r "@ai-sdk/react" packages/plugin/ --include="*.ts" --include="*.tsx"
```

If only `package.json` remains, evaluate whether to keep or remove the dependency. The `UIMessage` type now comes from `"ai"` directly, so `@ai-sdk/react` may be fully removable.

### Task 6.2 — Run deletion verification for removed symbols

```bash
cd /home/tanner/Projects/Zenith-AI && ./scripts/verify-deletion.sh "API_KEY" "getApiKey" "selectedModel"
```

### Task 6.3 — TypeScript typecheck

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && npx tsc --noEmit
```

Fix any remaining type errors from the integration.

### Task 6.4 — Run all tests

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test
```

### Task 6.5 — Build

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && rm -rf dist && pnpm build
```

### Task 6.6 — Final verification

```bash
cd /home/tanner/Projects/Zenith-AI && ./scripts/verify-deletion.sh "API_KEY" "getApiKey" "selectedModel" "useChat" "@ai-sdk/react"
```

---

## File Inventory

### New files (8)
| File | Layer | Purpose |
|------|-------|---------|
| `packages/plugin/services/ai/types.ts` | 1 | Type definitions |
| `packages/plugin/services/ai/types.test.ts` | 1 | Type tests |
| `packages/plugin/services/settings-migration.ts` | 1 | Legacy settings migration |
| `packages/plugin/services/settings-migration.test.ts` | 1 | Migration tests |
| `packages/plugin/services/ai/provider-factory.ts` | 2 | Creates LanguageModel instances |
| `packages/plugin/services/ai/provider-factory.test.ts` | 2 | Provider factory tests |
| `packages/plugin/services/ai/tool-adapter.ts` | 2 | Plugin tools → AI SDK format |
| `packages/plugin/services/ai/tool-adapter.test.ts` | 2 | Tool adapter tests |
| `packages/plugin/services/ai/ai-service.ts` | 2 | Main AI orchestrator |
| `packages/plugin/services/ai/ai-service.test.ts` | 2 | AI service tests |
| `packages/plugin/views/assistant/ai-chat/hooks/use-zenith-chat.ts` | 3 | Custom chat hook |
| `packages/plugin/views/assistant/ai-chat/hooks/use-zenith-chat.test.ts` | 3 | Hook smoke test |
| `packages/plugin/views/settings/providers-tab.tsx` | 4 | Provider/model settings UI |

### Modified files (7)
| File | Layer | Change |
|------|-------|--------|
| `packages/plugin/package.json` | 0 | Add `@ai-sdk/anthropic` |
| `packages/plugin/settings.ts` | 1 | Complete rewrite — new field structure |
| `packages/plugin/views/settings/main.tsx` | 4 | Add Providers tab |
| `packages/plugin/views/settings/general-tab.tsx` | 4 | Remove API key, add redirect message |
| `packages/plugin/views/assistant/ai-chat/model-selector.tsx` | 4 | Complete rewrite — dropdown of configs |
| `packages/plugin/views/assistant/ai-chat/types.ts` | 4 | Add re-exports |
| `packages/plugin/views/assistant/ai-chat/chat.tsx` | 5 | Swap useChat → useZenithChat, remove apiKey |
| `packages/plugin/views/assistant/ai-chat/container.tsx` | 5 | Remove apiKey prop |
| `packages/plugin/views/assistant/view.tsx` | 5 | Remove apiKey prop |
| `packages/plugin/index.ts` | 5 | Add migration, AIService init, remove getApiKey |

### Unchanged files
- `packages/plugin/views/settings/advanced-tab.tsx`
- `packages/plugin/views/settings/components.tsx`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/*.tsx` (all individual handlers)
- `packages/plugin/services/background-scribe.ts`
- `packages/plugin/services/logger.ts`
- `packages/plugin/views/assistant/ai-chat/services/chat-history-manager.ts`

---

## Execution Choice

This plan has **6 layers, ~15 tasks**. Recommended execution approach:

**Option A — Subagent-driven (parallel within layers):**
- Layers 0-1: 4 tasks, 3 can run in parallel after 0.1
- Layer 2: 3 tasks, all independent — full parallel
- Layer 3: 1 task (depends on Layer 2)
- Layer 4: 4 tasks, all independent — full parallel
- Layer 5: 3 tasks, can partially parallel (5.1 first, then 5.2 + 5.3)
- Layer 6: sequential verification

**Option B — Single-agent sequential:**
Execute tasks in order, committing after each layer. Slower but simpler to debug.
