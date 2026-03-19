export class ZenithAISettings {
  API_KEY = "";
  enableSelfHosting = true;
  selfHostingURL = "http://localhost:3010";
  selectedModel: "gpt-4o-mini" | "llama3.2" = "gpt-4o-mini";
  customModelName = "llama3.2";
  debugMode = false;
  enableSearchGrounding = false;
  enableDeepSearch = false;
}

export const DEFAULT_SETTINGS = new ZenithAISettings();
