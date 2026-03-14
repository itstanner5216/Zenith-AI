export class ZenithAISettings {

  API_KEY = "";
  useLogs = true;
  defaultDestinationPath = "_ZenithAI/Processed";
  referencePath = "_ZenithAI/References";
  attachmentsPath = "_ZenithAI/Processed/Attachments";
  pathToWatch = "_ZenithAI/Inbox";
  logFolderPath = "_ZenithAI/Logs";
  backupFolderPath = "_ZenithAI/Backups";
  templatePaths = "_ZenithAI/Templates";
  bypassedFilePath = "_ZenithAI/Bypassed";
  errorFilePath = "_ZenithAI/Errors";
  syncFolderPath = "_ZenithAI/Sync";

  // inbox settings
  useSimilarTags = true;
  enableDocumentClassification = false;
  // not working atm
  enableFileRenaming = true;

  renameInstructions =
    "If document has a human readable name, use it. Otherwise, create a concise, descriptive name for the document based on its key content. Prioritize clarity and searchability, using specific terms that will make the document easy to find later. Avoid generic words and focus on unique, identifying elements.";
  usePro = true;
  useSimilarTagsInFrontmatter = false;
  enableAtomicNotes = false;
  ignoreFolders = [""];
  stagingFolder = ".notecompanion/staging";
  enableSelfHosting = false;
  selfHostingURL = "http://localhost:3010";

  useFolderEmbeddings = false;
  useVaultTitles = true;
  enableSearchGrounding = false;
  enableDeepSearch = false;
  customFolderInstructions = "";
  selectedModel: "gpt-4o-mini" | "llama3.2" = "gpt-4o-mini";
  customModelName = "llama3.2";
  tagScoreThreshold = 70;
  formatBehavior: "override" | "newFile" | "append" = "override";
  useInbox = false;
  debugMode = false;
  enableTitleSuggestions = false;
  // use for sampling of the recommend fucntions
  contentCutoffChars = 1000;
  // use to prevent formatting of big file
  maxFormattingTokens = 100 * 1000;

  maxChatTokens = 100 * 1000;
  customTagInstructions =
    "Generate tags that capture the main topics, themes, and type of content in the document. Focus on specific, meaningful tags that will help with organization and retrieval.";
  hasRunOnboarding = false;
  pdfPageLimit = 10; // default to 10 pages
  enableProcessingNotifications = true; // Show toast notifications during file processing
  // Vault Intelligence (Vertex Brain integration)
  vertexBrainUrl = "http://localhost:8085";
  enableVectorAutoSort = true;
  autoSortConfidenceThreshold = 0.75;
  organizationRulesPath = "System/Cosmic Vault Structure.md";
  generalMergeThreshold = 0.50; // General directory → Project threshold
  globalMergeThreshold = 0.70; // Non-General → Project threshold
  pinnedTag = "pinned"; // Tag that locks files from auto-sort
  projectsPath = "Projects"; // Root signal directory
  autoDetectProjectContext = true;
  backgroundScribeEnabled = false;
  backgroundScribeOutputFile = "TODO.md";
}

export const DEFAULT_SETTINGS = new ZenithAISettings();
