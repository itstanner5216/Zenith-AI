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
