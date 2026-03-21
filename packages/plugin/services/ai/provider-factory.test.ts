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
});
