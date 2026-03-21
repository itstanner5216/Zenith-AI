import { createModelFromKey } from "./provider-factory";
import type { ProviderKey } from "./types";

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

  it("creates OpenAI model without baseUrl — opts.baseURL is undefined", () => {
    const key: ProviderKey = {
      id: "7",
      name: "Plain OpenAI",
      provider: "openai",
      apiKey: "sk-test",
    };
    const model = createModelFromKey(key, "gpt-4o") as any;
    expect(model.opts.baseURL).toBeUndefined();
  });

  it("openai-compatible uses the provided apiKey", () => {
    const key: ProviderKey = {
      id: "8",
      name: "LocalAI",
      provider: "openai-compatible",
      apiKey: "my-secret-key",
      baseUrl: "http://localhost:8080/v1",
    };
    const model = createModelFromKey(key, "mistral") as any;
    expect(model.opts.apiKey).toBe("my-secret-key");
  });

  it("anthropic model opts has no baseURL", () => {
    const key: ProviderKey = {
      id: "9",
      name: "Test Anthropic",
      provider: "anthropic",
      apiKey: "sk-ant-test",
    };
    const model = createModelFromKey(key, "claude-3-haiku") as any;
    expect(model.opts.baseURL).toBeUndefined();
  });

  it("openai with baseUrl creates model with correct modelId and baseUrl", () => {
    const key: ProviderKey = {
      id: "10",
      name: "Azure OpenAI",
      provider: "openai",
      apiKey: "sk-azure",
      baseUrl: "https://my-azure.openai.azure.com/v1",
    };
    const model = createModelFromKey(key, "gpt-4-turbo") as any;
    expect(model.modelId).toBe("gpt-4-turbo");
    expect(model.opts.baseURL).toBe("https://my-azure.openai.azure.com/v1");
  });

  it("returns distinct model objects for different modelIds from the same key", () => {
    const key: ProviderKey = {
      id: "11",
      name: "Shared OpenAI Key",
      provider: "openai",
      apiKey: "sk-test",
    };
    const model1 = createModelFromKey(key, "gpt-4o") as any;
    const model2 = createModelFromKey(key, "gpt-3.5-turbo") as any;
    expect(model1).not.toBe(model2);
    expect(model1.modelId).toBe("gpt-4o");
    expect(model2.modelId).toBe("gpt-3.5-turbo");
  });

  it("openai-compatible passes the correct modelId to the provider", () => {
    const key: ProviderKey = {
      id: "12",
      name: "LM Studio",
      provider: "openai-compatible",
      apiKey: "",
      baseUrl: "http://localhost:1234/v1",
    };
    const model = createModelFromKey(key, "phi-3") as any;
    expect(model.modelId).toBe("phi-3");
  });
});
