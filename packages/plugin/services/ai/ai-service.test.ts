import { AIService } from "./ai-service";
import { ZenithAISettings } from "../../settings";
import type { ProviderKey, ModelConfig } from "./types";
import { streamText, stepCountIs } from "ai";

// Mock provider factory
jest.mock("./provider-factory", () => ({
  createModelFromKey: jest.fn((key: any, modelId: string) => ({
    modelId,
    provider: key.provider,
  })),
}));

jest.mock("ai", () => ({
  streamText: jest.fn(() => ({
    textStream: (async function* () { yield "test"; })(),
    fullStream: (async function* () {
      yield { type: "text-delta", textDelta: "test" };
    })(),
  })),
  // Returns a placeholder StopCondition function; the test only verifies
  // that stopWhen was passed a function (not what the function evaluates to).
  stepCountIs: jest.fn((_n: number) => () => false),
}));

describe("AIService", () => {
  let settings: ZenithAISettings;
  let testKey: ProviderKey;
  let testConfig: ModelConfig;

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe("streamChat", () => {
    it("calls streamText with the correct model and messages", () => {
      const service = new AIService(settings);
      const mockMessages = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }];
      service.streamChat({ messages: mockMessages });
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({ messages: mockMessages })
      );
    });

    it("passes stopWhen when maxSteps is provided", () => {
      const service = new AIService(settings);
      service.streamChat({ messages: [], maxSteps: 3 });
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({ stopWhen: expect.any(Function) })
      );
      expect(stepCountIs as jest.Mock).toHaveBeenCalledWith(3);
    });

    it("does not pass stopWhen when maxSteps is not provided", () => {
      const service = new AIService(settings);
      service.streamChat({ messages: [] });
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({ stopWhen: undefined })
      );
      expect(stepCountIs as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe("validateKey", () => {
    it("returns valid: true when streamText succeeds", async () => {
      const service = new AIService(settings);
      const result = await service.validateKey(testKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns valid: false with error message when streamText throws", async () => {
      (streamText as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Invalid API key");
      });
      const service = new AIService(settings);
      const result = await service.validateKey(testKey);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });
});
