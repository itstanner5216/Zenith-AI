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

  it("TokenUsage fields are all optional", () => {
    const usage: TokenUsage = {};
    expect(usage.promptTokens).toBeUndefined();
    expect(usage.completionTokens).toBeUndefined();
    expect(usage.totalTokens).toBeUndefined();
  });
});
