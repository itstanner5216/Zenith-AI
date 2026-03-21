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
