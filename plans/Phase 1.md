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

