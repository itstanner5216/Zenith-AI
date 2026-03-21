# AI Provider Integration — Design Document

> **Date:** 2026-03-21
> **Status:** Approved
> **Scope:** Full AI provider integration for the Obsidian plugin — multi-provider support (OpenAI, Anthropic, OpenAI-compatible), named key management, direct-from-plugin streaming via AI SDK, and settings UI.

---

## 1. Problem Statement

The current AI integration is broken:
- `useChat` from `@ai-sdk/react` expects a server endpoint — the web API at `localhost:3010`
- The web API's `models.ts` loads a single model from env vars at startup; the `getModel(_name?)` function ignores its parameter
- Plugin sends `model` in the request body but the backend discards it
- Settings UI has a single "API Key" field (vestige of old cloud auth) with no provider configuration
- No way to use multiple providers or keys without editing `.env` files and restarting the server
- The web server is a stub — it shouldn't be a required dependency for basic chat

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API key storage | Plugin-side named keys | Users configure everything from Obsidian UI, no .env editing |
| Backend dependency | None (direct from plugin) | Plugin calls provider APIs directly. Web API left as-is for future features |
| Chat hook | Custom hook + `streamText()` | `useChat` requires a server. `streamText()` works directly in Electron |
| Provider SDKs | `@ai-sdk/openai` + `@ai-sdk/anthropic` | AI SDK handles streaming, tool calling, format differences. Already a dependency |
| Model selection | Free-text input | Users type any model ID. No hardcoded registry to maintain |
| Custom providers | Dedicated "OpenAI-Compatible" type | Clean separation. Requires base URL. Covers Ollama, LM Studio, OpenRouter, etc. |
| System prompt | Caller-provided slot | No global prompt in settings. Future mode system injects per-mode prompts |
| Web API cleanup | Leave as-is | Untouched for now. Will be rebuilt when genuinely needed |
| Duplicate provider keys | Supported | Users can register multiple keys for the same provider (e.g., two OpenAI keys) |
| Generation parameters | None | Per AGENTS.md hard constraint. Exception: future user-facing settings UI only |

## 3. Data Model

### 3.1 Types

```typescript
// packages/plugin/services/ai/types.ts

/** Supported first-class provider types */
type ProviderType = "openai" | "anthropic" | "openai-compatible";

/** A named API key entry stored in plugin settings */
interface ProviderKey {
  id: string;              // crypto.randomUUID()
  name: string;            // user-facing label ("My OpenAI", "Work Claude")
  provider: ProviderType;  // determines which AI SDK provider to instantiate
  apiKey: string;          // stored in Obsidian data.json
  baseUrl?: string;        // required for openai-compatible, optional override for openai
}

/** A model configuration that references a provider key */
interface ModelConfig {
  id: string;              // crypto.randomUUID()
  modelId: string;         // free-text ("gpt-4o", "claude-sonnet-4", any string)
  providerKeyId: string;   // FK to ProviderKey.id
  displayName?: string;    // optional friendly name shown in selectors
}

/** Normalized message format used throughout the plugin */
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  parts?: MessagePart[];   // for tool calls, etc.
}

/** Token usage reported after completion */
interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}
```

### 3.2 Updated Settings

```typescript
// packages/plugin/settings.ts

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

// REMOVED: API_KEY (replaced by providerKeys)
// REMOVED: selectedModel (replaced by activeModelConfigId + modelConfigs)
```

### 3.3 Migration

On plugin load, if old fields exist:
1. If `API_KEY` is non-empty → create a `ProviderKey` named "Migrated Key" with provider `"openai"`
2. If `selectedModel` is non-empty → create a `ModelConfig` referencing that key with the model ID
3. Set `activeModelConfigId` to the new config's ID
4. Clear old fields from the stored data

## 4. Architecture

### 4.1 Directory Structure

```
packages/plugin/services/ai/
├── types.ts                   # ProviderType, ProviderKey, ModelConfig, ChatMessage, TokenUsage
├── ai-service.ts              # AIService class — main orchestrator
├── provider-factory.ts        # Creates AI SDK LanguageModel instances from ProviderKey
└── tool-adapter.ts            # Converts plugin tool definitions to AI SDK tool format
```

### 4.2 Provider Factory

```typescript
// packages/plugin/services/ai/provider-factory.ts

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";

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
        apiKey: key.apiKey || "not-needed",  // some local providers don't need keys
        baseURL: key.baseUrl,
      });
      return provider(modelId);
    }

    default:
      throw new Error(`Unknown provider type: ${key.provider}`);
  }
}
```

### 4.3 AI Service

```typescript
// packages/plugin/services/ai/ai-service.ts

import { streamText, LanguageModel, ToolSet, StepResult } from "ai";
import { createModelFromKey } from "./provider-factory";

export class AIService {
  constructor(private settings: ZenithAISettings) {}

  /** Resolve the active model config + provider key */
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

  /** Validate that a provider key works (sends a minimal request) */
  async validateKey(key: ProviderKey): Promise<{ valid: boolean; error?: string }> {
    try {
      const model = createModelFromKey(key, key.provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
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

### 4.4 Custom Chat Hook

```typescript
// packages/plugin/views/assistant/ai-chat/hooks/use-zenith-chat.ts

/**
 * useZenithChat — replaces @ai-sdk/react's useChat
 *
 * Calls AIService.streamChat() directly (no server needed).
 * Manages message state, streaming, tool calling, abort, reload.
 */
function useZenithChat(options: {
  aiService: AIService;
  tools?: ToolSet;
  maxSteps?: number;
  onFinish?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
  onStepFinish?: (step: StepResult<any>) => void;
}): {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming";
  error: Error | null;
  sendMessage: (content: string, opts?: {
    context?: string;
    systemPrompt?: string;
    attachments?: Attachment[];
  }) => Promise<void>;
  stop: () => void;
  reload: () => Promise<void>;
  setMessages: (messages: UIMessage[]) => void;
}
```

**Implementation responsibilities:**
- Maintains `messages: UIMessage[]` state (same shape as the existing chat UI uses)
- On `sendMessage`: appends user message, sets status to "submitted", calls `aiService.streamChat()`
- As `streamText` yields text/tool-call chunks: updates the assistant message in state, sets status to "streaming"
- Handles tool results: when tool calls have results, re-sends the conversation (multi-step)
- On `stop`: calls `AbortController.abort()`
- On `reload`: removes last assistant message, re-sends
- On error: sets `error` state, calls `onError` callback
- On completion: calls `onFinish` callback with the final assistant message
- Emits vault-intelligence events for BackgroundScribe (existing behavior)

### 4.5 Tool Calling Integration

The existing tool handlers stay as-is. The connection changes:

**Before (useChat + server):**
```
useChat → HTTP to server → server streamText with tools → SSE back → useChat handles tool UI
```

**After (useZenithChat + direct):**
```
useZenithChat → streamText() directly → tool calls in result → hook renders tool UI → collects results → re-calls streamText
```

The existing `ToolCallHandler` components and individual tool handlers (`search-handler.tsx`, `open-file-handler.tsx`, etc.) remain unchanged. They receive tool call data and return results — the plumbing that delivers/collects this data changes from `useChat`'s protocol to the custom hook's state management.

Tool definitions for the AI SDK are created from the existing tool schemas. The `tool-adapter.ts` module converts the plugin's tool definitions into AI SDK `ToolSet` format:

```typescript
// packages/plugin/services/ai/tool-adapter.ts

import { tool } from "ai";
import { z } from "zod";

/**
 * Creates AI SDK tool definitions that delegate execution back to the plugin.
 * Tool execution happens client-side (in the plugin), not on a server.
 *
 * Tools return a result object that the AI can use in subsequent steps.
 * The actual vault operations (search, file open, move, rename) are
 * performed by the existing tool handler components.
 */
export function createPluginTools(): ToolSet {
  return {
    getSearchQuery: tool({
      description: "Generate a semantic search query to find relevant notes in the vault.",
      parameters: z.object({
        query: z.string().describe("The search query"),
        reasoning: z.string().optional().describe("Why this query was chosen"),
      }),
      // execute omitted — handled client-side by tool handler components
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

## 5. Settings UI

### 5.1 Tab Structure

```
Settings
├── General        (cleaned up — no old API key field)
├── Providers      (NEW — key management + model configuration)
└── Advanced       (unchanged — debug mode, server URL)
```

### 5.2 Providers Tab Layout

```
┌─────────────────────────────────────────────────┐
│  PROVIDER KEYS                          [+ Add] │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔑 My OpenAI          openai     ••••k3Qf  │ │
│ │                              [Test] [Delete] │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 🔑 Work Claude        anthropic  ••••xR2m  │ │
│ │                              [Test] [Delete] │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 🔑 Local Ollama       compatible ••••      │ │
│ │   http://localhost:11434/v1      [Test] [Del]│ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│  MODEL CONFIGURATIONS                   [+ Add] │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✦ gpt-4o              Key: My OpenAI       │ │
│ │   "Daily Driver"                   [Delete] │ │
│ ├─────────────────────────────────────────────┤ │
│ │ ✦ claude-sonnet-4     Key: Work Claude     │ │
│ │   "Code Review"                    [Delete] │ │
│ ├─────────────────────────────────────────────┤ │
│ │ ✦ llama3:8b           Key: Local Ollama    │ │
│ │                                    [Delete] │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│  ACTIVE MODEL                                    │
│  [ gpt-4o (Daily Driver)            ▾ ]          │
└─────────────────────────────────────────────────┘
```

**Add Key form (inline, appears when [+ Add] clicked):**
- Name: text input
- Provider: dropdown (OpenAI / Anthropic / OpenAI-Compatible)
- API Key: password input (masked after save)
- Base URL: text input (shown only for OpenAI-Compatible, optional for OpenAI)
- [Save] [Cancel] buttons

**Add Model form (inline):**
- Model ID: text input (free-text)
- Provider Key: dropdown of existing keys (shows key name)
- Display Name: text input (optional)
- [Save] [Cancel] buttons

**Test button on keys:** Calls `AIService.validateKey()` and shows success/failure indicator.

### 5.3 Chat Header Model Selector

The existing `ModelSelector` component in the chat header changes from a free-text input to a dropdown of configured models:

```
Before: [set model ✎] (click to type any string)
After:  [gpt-4o (Daily Driver) ▾] (dropdown of configured ModelConfigs)
```

Selecting a model from this dropdown updates `settings.activeModelConfigId` and persists.

### 5.4 General Tab Changes

- Remove the "Zenith-AI API Key" section entirely
- Add a brief message: "Configure your AI providers in the Providers tab"
- Keep any other general settings that may be added later

## 6. Chat Component Changes

### 6.1 Swap useChat → useZenithChat

The `ChatComponent` in `chat.tsx` replaces:

```typescript
// BEFORE
const { status, messages, handleSubmit, stop, ... } = useChat({
  api: `${plugin.getServerUrl()}/api/chat`,
  headers: { Authorization: `Bearer ${apiKey}` },
  experimental_prepareRequestBody: (...) => { ... },
  ...
});

// AFTER
const aiService = useMemo(() => new AIService(plugin.settings), [plugin.settings]);

const { status, messages, sendMessage, stop, ... } = useZenithChat({
  aiService,
  tools: createPluginTools(),
  maxSteps: 5,
  onFinish: (message) => { /* existing onFinish logic */ },
  onError: (error) => { /* existing onError logic */ },
});
```

### 6.2 What stays the same

- All tool handler components (`ToolCallHandler`, `search-handler.tsx`, etc.)
- Chat history manager and session persistence
- Context items store (Zustand) and context building
- Editor selection tracking
- Attachment handling
- Message rendering
- BackgroundScribe event dispatch
- Error display and handling patterns
- Export/copy functionality

### 6.3 What changes

- `useChat` → `useZenithChat` (different hook, same output shape)
- `experimental_prepareRequestBody` → context passed via `sendMessage(content, { context })`
- `api` + `headers` config → removed (no server endpoint)
- `handleSubmit` → `sendMessage` (direct call instead of form submission)
- `ModelSelector` → dropdown of configured models instead of free-text
- `apiKey` prop → no longer needed (keys come from AIService)

## 7. Plugin Dependencies

### 7.1 Add

```json
{
  "@ai-sdk/anthropic": "catalog:"
}
```

### 7.2 Keep

```json
{
  "ai": "catalog:",
  "@ai-sdk/openai": "catalog:",
  "@ai-sdk/react": "catalog:"  // may still be used for types, evaluate during implementation
}
```

### 7.3 Evaluate for removal

- `@ai-sdk/react` — if `useChat` is fully replaced and no other exports are used, this can be removed. However, it may still provide useful types (`UIMessage`, etc.). Evaluate during implementation.

## 8. Mode System Integration Points

The design provides two clean hooks for the future mode system:

1. **`systemPrompt?: string`** parameter on `sendMessage()` and `AIService.streamChat()` — modes inject their prompt here
2. **`tools?: ToolSet`** parameter — modes provide their scoped tool set

When the mode system is built, a mode manifest provides:
```typescript
interface ModeManifest {
  id: string;
  name: string;
  systemPrompt: string;          // injected into streamChat
  tools: ToolSet;                // mode-scoped tools
  modelConfigId?: string;        // optional: override active model for this mode
}
```

The chat component passes `mode.systemPrompt` and `mode.tools` to `useZenithChat`. Zero changes to the AI service layer.

## 9. Security Considerations

- API keys are stored in Obsidian's `data.json` (same security model as all plugin settings)
- Keys are never displayed after entry (masked in UI)
- Keys are sent directly to provider APIs over HTTPS — never to a third-party server
- The "Test" button sends a minimal request to validate the key
- No keys are logged (logger service must filter key fields)

## 10. What's NOT in This Plan

- No changes to `packages/web` (left as-is)
- No hardcoded model registry
- No generation/sampling parameters (per AGENTS.md)
- No global system prompt (deferred to mode system)
- No new packages beyond `@ai-sdk/anthropic`
- No auth/billing/analytics infrastructure (per AGENTS.md)
