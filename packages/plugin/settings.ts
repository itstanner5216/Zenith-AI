export class ZenithAISettings {

  API_KEY = "";
  defaultDestinationPath = "_ZenithAI/Processed";
  pathToWatch = "_ZenithAI/Inbox";
  logFolderPath = "_ZenithAI/Logs";
  backupFolderPath = "_ZenithAI/Backups";
  templatePaths = "_ZenithAI/Templates";
  ignoreFolders = [""];

  // inbox settings
  enableFileRenaming = true;
  enableAtomicNotes = false;

  // model / chat
  enableSearchGrounding = false;
  enableDeepSearch = false;
  selectedModel: "gpt-4o-mini" | "llama3.2" = "gpt-4o-mini";
  customModelName = "llama3.2";
  showLocalLLMInChat = false;
  backgroundScribeEnabled = false;
  debugMode = false;
  enableTitleSuggestions = false;

  enableSelfHosting = false;
  selfHostingURL = "http://localhost:3010";

  // Vault Intelligence (Vertex Brain integration)
  vertexBrainUrl = "http://localhost:8085";
  enableVectorAutoSort = true;
  autoSortConfidenceThreshold = 0.75;
  organizationRulesPath = "System/Cosmic Vault Structure.md";
  pinnedTag = "pinned"; // Tag that locks files from auto-sort
  projectsPath = "Projects"; // Root signal directory
  autoDetectProjectContext = true;
  backgroundScribeOutputFile = "TODO.md";
}

export const DEFAULT_SETTINGS = new ZenithAISettings();
