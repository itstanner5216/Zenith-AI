import { TFile, moment, TFolder, Vault, Notice } from "obsidian";
import ZenithAI from "../index";
import { Queue } from "./services/queue";
import {
  FileRecord,
  RecordManager,
  Action,
  FileStatus,
} from "./services/record-manager";
import { QueueStatus } from "./types";
import { logMessage, sanitizeFileName } from "../someUtils";
import { IdService } from "./services/id-service";
import { logger } from "../services/logger";
import {
  initializeTokenCounter,
  getTokenCount,
  cleanup,
} from "../utils/token-counter";
import {
  isValidExtension,
  VALID_MEDIA_EXTENSIONS,
  VALID_AUDIO_EXTENSIONS,
} from "../constants";
import {
  safeCreate,
  safeRename,
  safeCopy,
  safeMove,
  safeModifyContent as safeModify,
} from "../fileUtils";
import { sanitizeContent } from "../fileUtils";
import {
  getOriginalContent,
} from "../fileUtils";

// Move constants to the top level and ensure they're used consistently
const MAX_CONCURRENT_TASKS = 5;
const MAX_CONCURRENT_MEDIA_TASKS = 2;

export interface FolderSuggestion {
  isNewFolder: boolean;
  score: number;
  folder: string;
  reason: string;
}

export interface LogEntry {
  id: string;
  fileName: string;
  timestamp: string;
  status: "queued" | "processing" | "completed" | "error";
  newPath?: string;
  newName?: string;
  classification?: string;
  addedTags?: string[];
  errors?: string[];
  messages: string[];
}

interface EventRecord {
  id: string;
  fileRecordId: string;
  timestamp: string;
  message: string;
  metadata?: Record<string, any>;
}

interface ProcessingContext {
  inboxFile: TFile;
  containerFile?: TFile;
  attachmentFile?: TFile;
  hash: string;
  content?: string;
  newPath?: string;
  newName?: string;
  tags?: string[];
  plugin: ZenithAI;
  recordManager: RecordManager;
  idService: IdService;
  queue: Queue<TFile>;
  formattedContent?: string;
  classification?: {
    documentType: string;
    confidence: number;
    reasoning: string;
  };
  suggestedTags?: Array<{
    score: number;
    isNew: boolean;
    tag: string;
    reason: string;
  }>;
}

interface StepValidation {
  isValid: boolean;
  reason?: string;
}

function validateContext(
  context: ProcessingContext,
  requiredFields: (keyof ProcessingContext)[]
): StepValidation {
  for (const field of requiredFields) {
    if (!context[field]) {
      return {
        isValid: false,
        reason: `Missing required field: ${field}`,
      };
    }
  }
  return { isValid: true };
}

function assertInvariant(condition: boolean, message: string) {
  if (!condition) {
    logger.error(`Invariant violation: ${message}`);
    throw new Error(`Invariant violation: ${message}`);
  }
}

export class Inbox {
  protected static instance: Inbox;
  private plugin: ZenithAI;
  private activeMediaTasks = 0;
  private mediaQueue: Array<TFile> = [];

  private queue: Queue<TFile>;
  private recordManager: RecordManager;
  private idService: IdService;

  private constructor(plugin: ZenithAI) {
    this.plugin = plugin;
    this.recordManager = RecordManager.getInstance(plugin.app);
    this.idService = IdService.getInstance();
    this.initializeQueue();
  }

  public static initialize(plugin: ZenithAI): Inbox {
    if (!Inbox.instance) {
      Inbox.instance = new Inbox(plugin);
    }
    return Inbox.instance;
  }

  public static getInstance(): Inbox {
    if (!Inbox.instance) {
      throw new Error("Inbox not initialized. Call initialize() first.");
    }
    return Inbox.instance;
  }

  public static cleanup(): void {
    if (Inbox.instance) {
      Inbox.instance.queue.clear();
      cleanup(); // Clean up token counter
      // @ts-ignore - We know what we're doing here
      Inbox.instance = null;
    }
  }

  public enqueueFile(file: TFile): void {
    this.enqueueFiles([file]);
  }

  public enqueueFiles(files: TFile[]): void {
    logMessage(`Enqueuing ${files.length} files`);

    // Separate media and non-media files
    const [mediaFiles, regularFiles] = files.reduce<[TFile[], TFile[]]>(
      (acc, file) => {
        if (this.plugin.shouldCreateMarkdownContainer(file)) {
          acc[0].push(file);
        } else {
          acc[1].push(file);
        }
        return acc;
      },
      [[], []]
    );

    // First enqueue regular files
    for (const file of regularFiles) {
      const hash = this.idService.generateFileHash(file);
      this.recordManager.startTracking(hash, file.basename);
      this.queue.add(file, { metadata: { hash } });
    }

    // Then enqueue media files
    for (const file of mediaFiles) {
      const hash = this.idService.generateFileHash(file);
      this.recordManager.startTracking(hash, file.basename);
      this.queue.add(file, { metadata: { hash } });
    }

    logMessage(
      `Enqueued ${regularFiles.length} regular files and ${mediaFiles.length} media files`
    );
  }

  private initializeQueue(): void {
    this.queue = new Queue<TFile>({
      concurrency: MAX_CONCURRENT_TASKS,
      timeout: 30000,
      onProcess: async (file: TFile, metadata?: Record<string, any>) => {
        try {
          const isMediaFile = this.plugin.shouldCreateMarkdownContainer(file);

          if (isMediaFile) {
            // Check if we can process more media files
            if (this.activeMediaTasks >= MAX_CONCURRENT_MEDIA_TASKS) {
              // Add to media queue and skip for now
              this.mediaQueue.push(file);
              if (metadata?.hash) {
                this.queue.remove(metadata.hash);
              }
              return;
            }
            this.activeMediaTasks++;
          }

          await this.processInboxFile(file, metadata?.hash);

          if (isMediaFile) {
            this.activeMediaTasks--;
            // Process next media file if available
            this.processNextMediaFile();
          }
        } finally {
          if (metadata?.hash) {
            this.queue.remove(metadata.hash);
          }
        }
      },
      onComplete: () => {},
      onError: (error: Error, file: TFile) => {
        logger.error("Queue processing error:", error);
        new Notice(
          `Zenith-AI: Processing failed for ${file.basename}. ${error.message}`,
          6000
        );
      },
    });
  }

  private async processNextMediaFile(): Promise<void> {
    if (
      this.mediaQueue.length === 0 ||
      this.activeMediaTasks >= MAX_CONCURRENT_MEDIA_TASKS
    ) {
      return;
    }

    const nextFile = this.mediaQueue.shift();
    if (nextFile) {
      const hash = this.idService.generateFileHash(nextFile);
      this.queue.add(nextFile, { metadata: { hash } });
    }
  }

  public getFileStatus(filePath: string): FileRecord | undefined {
    // return this.recordManager.getRecordByPath(filePath);
    return undefined;
  }

  public getFileEvents(fileId: string): EventRecord[] {
    // return this.recordManager.getFileEvents(fileId);
    return [];
  }

  public getAllFiles(): FileRecord[] {
    return this.recordManager.getAllRecords();
  }

  public getQueueStats(): QueueStatus {
    return this.queue.getStats();
  }

  public getMediaProcessingStats(): { active: number; queued: number } {
    return {
      active: this.activeMediaTasks,
      queued: this.mediaQueue.length,
    };
  }

  public getAnalytics(): {
    byStatus: Record<FileStatus, number>;
    totalFiles: number;
    mediaStats: {
      active: number;
      queued: number;
    };
    queueStats: QueueStatus;
  } {
    const records = this.getAllFiles();
    const byStatus = records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<FileStatus, number>);

    return {
      byStatus,
      totalFiles: records.length,
      mediaStats: this.getMediaProcessingStats(),
      queueStats: this.getQueueStats(),
    };
  }

  // Refactored method using parallel processing where possible
  private async processInboxFile(
    inboxFile: TFile,
    hash?: string
  ): Promise<void> {
    if (!hash) {
      throw new Error("Hash is required for processing");
    }
    this.recordManager.setStatus(hash, "processing");

    const context: ProcessingContext = {
      inboxFile,
      hash,
      plugin: this.plugin,
      recordManager: this.recordManager,
      idService: this.idService,
      queue: this.queue,
    };

    try {
      // Critical steps — must succeed
      await executeStep(
        context,
        startProcessing,
        Action.CLEANUP,
        Action.ERROR_CLEANUP
      );
      await executeStep(
        context,
        hasValidFileStep,
        Action.VALIDATE,
        Action.ERROR_VALIDATE
      );
      await executeStep(
        context,
        getContainerFileStep,
        Action.CONTAINER,
        Action.ERROR_CONTAINER
      );
      await executeStep(
        context,
        moveAttachmentFile,
        Action.MOVING_ATTACHMENT,
        Action.ERROR_MOVING_ATTACHMENT
      );
      await executeStep(
        context,
        getContentStep,
        Action.EXTRACT,
        Action.ERROR_EXTRACT
      );
      await executeStep(
        context,
        cleanupStep,
        Action.CLEANUP,
        Action.ERROR_CLEANUP
      );

      // Try embeddings first — falls through to model if unavailable or low confidence
      context = await safeExecuteStep(
        context,
        recommendFolderWithEmbeddingsStep,
        Action.MOVING,
        Action.ERROR_MOVING
      );

      // Run remaining independent API calls concurrently
      // Only call model folder routing if embeddings didn't resolve the folder
      await Promise.all([
        safeExecuteStep(context, recommendClassificationStep, Action.CLASSIFY, Action.ERROR_CLASSIFY),
        ...(!context.newPath
          ? [safeExecuteStep(context, recommendFolderStep, Action.MOVING, Action.ERROR_MOVING)]
          : []),
        safeExecuteStep(context, recommendNameStep, Action.RENAME, Action.ERROR_RENAME),
      ]);

      // These depend on results above or are local operations
      await safeExecuteStep(
        context,
        formatContentStep,
        Action.FORMATTING,
        Action.ERROR_FORMATTING
      );
      await executeStep(
        context,
        appendAttachmentStep,
        Action.APPEND,
        Action.ERROR_APPEND
      );
      await safeExecuteStep(
        context,
        recommendTagsStep,
        Action.TAGGING,
        Action.ERROR_TAGGING
      );
      await executeStep(
        context,
        completeProcessing,
        Action.COMPLETED,
        Action.ERROR_COMPLETE
      );
    } catch (error) {
      await handleError(error, context);
      logger.error("Error processing inbox file:", error);
    }
  }
}
async function moveAttachmentFile(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (VALID_MEDIA_EXTENSIONS.includes(context.inboxFile.extension)) {
    context.attachmentFile = context.inboxFile;
    const newPath = await safeMove(
      context.plugin.app,
      context.inboxFile,
      context.plugin.settings.attachmentsPath
    );
    const movedFile = context.plugin.app.vault.getAbstractFileByPath(newPath);
    if (movedFile instanceof TFile) {
      context.attachmentFile = movedFile;
      context.inboxFile = movedFile;
    }
  }
  return context;
}

async function getContainerFileStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  logger.info("Get container file step");
  if (VALID_MEDIA_EXTENSIONS.includes(context.inboxFile?.extension)) {
    const containerFile = await safeCreate(
      context.plugin.app,
      context.inboxFile.basename + ".md",
      ""
    );
    context.containerFile = containerFile;
  } else {
    context.containerFile = context.inboxFile;
  }
  context.recordManager.setFile(context.hash, context.containerFile);
  // return the inboxFile if it is not a media file
  return context;
}

async function hasValidFileStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  // check if file is valid
  logger.info("Has valid file step");
  // check if file is supported if not bypass
  if (!isValidExtension(context.inboxFile?.extension)) {
    await handleBypass(context, "Unsupported file type");
    throw new Error("Unsupported file type");
  }
  return context;
}

async function recommendNameStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping name recommendation: missing content or container file"
    );
    return context;
  }

  const newName = await context.plugin.recommendName(
    getOriginalContent(context.content),
    context.containerFile.basename
  );
  context.newName = newName[0]?.title;

  // if new name is the same as the old name then don't rename
  if (!context.newName || context.newName === context.containerFile.basename) {
    return context;
  }

  // Sanitize the new name to replace invalid characters with dashes
  const sanitizedName = sanitizeFileName(context.newName);
  context.newName = sanitizedName;

  context.recordManager.setNewName(context.hash, context.newName);
  await safeRename(context.plugin.app, context.containerFile, context.newName);
  // Update file reference after rename (TFile path is automatically updated by Obsidian)
  context.recordManager.setFile(context.hash, context.containerFile);
  return context;
}

async function recommendFolderWithEmbeddingsStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  const client = context.plugin.vertexBrainClient;
  if (!client) return context; // Brain not configured, let model handle it

  try {
    const contentSample = context.content?.slice(0, 3000) ?? "";
    if (!contentSample.trim()) return context;

    // 1. Find similar notes via vector search
    const similar = await client.vectorSearch(contentSample, 20);
    if (!similar.length) return context;

    // 2. Tally folder frequencies from similar notes
    const folderCounts = new Map<string, number>();
    for (const note of similar) {
      if (note.folder_path && note.similarity > 0.5) {
        folderCounts.set(
          note.folder_path,
          (folderCounts.get(note.folder_path) ?? 0) + note.similarity
        );
      }
    }
    if (!folderCounts.size) return context;

    // 3. Read Cosmic Vault Structure for context
    const rules =
      (await context.plugin.organizationPreferences?.getRules()) ?? "";

    // 4. Build candidates for ranker
    const candidates = Array.from(folderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([folder, score]) => ({
        id: folder,
        title: folder,
        content: `Folder: ${folder} (weighted similarity: ${score.toFixed(2)}). Rules: ${rules.slice(0, 500)}`,
      }));

    // 5. Rank candidates
    const ranked = await client.rank(
      contentSample.slice(0, 1500),
      candidates
    );
    if (!ranked.length) return context;

    const best = ranked[0];

    // 6. Context-aware threshold selection
    const isInGeneral = context.inboxFile.path.includes("/General/");
    const isInProjects = context.inboxFile.path.includes(
      `/${context.plugin.settings.projectsPath}/`
    );

    let threshold = context.plugin.settings.autoSortConfidenceThreshold;
    if (isInGeneral) {
      threshold = context.plugin.settings.generalMergeThreshold;
    } else if (!isInProjects) {
      threshold = context.plugin.settings.globalMergeThreshold;
    }

    if (best.score < threshold) return context; // low confidence, fall through to model

    // 7. Apply folder
    context.newPath = best.title;
    context.recordManager.setFolder(context.hash, best.title);
    logger.info(
      `[Embeddings] Auto-sorted to ${best.title} (score: ${best.score.toFixed(2)})`
    );
  } catch (e) {
    logger.warn(
      `[Embeddings] Folder routing failed, falling back to model: ${e}`
    );
  }

  return context;
}

async function recommendFolderStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  assertInvariant(
    !!context.content,
    "Content must be available before folder recommendation"
  );
  assertInvariant(
    !!context.containerFile,
    "Container file must exist before moving"
  );

  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping folder recommendation: missing content or container file"
    );
    return context;
  }

  // Skip auto-sort if file is #pinned
  const cache = context.plugin.app.metadataCache.getFileCache(context.containerFile);
  const inlineTags = cache?.tags?.map(t => t.tag.replace('#', '')) || [];
  const frontmatterTags = cache?.frontmatter?.tags || [];
  const allTags = [...inlineTags, ...(Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags])];
  if (allTags.includes(context.plugin.settings.pinnedTag)) {
    logger.info("Skipping folder recommendation: file has #pinned tag");
    return context;
  }

  // Get original content without transcript for folder recommendation
  const originalContent = getOriginalContent(context.content);

  const newPath = await context.plugin.recommendFolders(
    originalContent,
    context.inboxFile.basename
  );

  assertInvariant(
    !!newPath?.[0]?.folder,
    "Folder recommendation must return a valid path"
  );

  context.newPath = newPath[0]?.folder;
  await safeMove(context.plugin.app, context.containerFile, context.newPath);
  context.recordManager.setFolder(context.hash, context.newPath);
  // Update file reference after move (TFile path is automatically updated by Obsidian)
  context.recordManager.setFile(context.hash, context.containerFile);

  return context;
}

async function recommendClassificationStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  // Validate required context
  const validation = validateContext(context, ["content", "containerFile"]);
  if (!validation.isValid) {
    throw new Error(
      `Classification step validation failed: ${validation.reason}`
    );
  }

  const templateNames = await context.plugin.getTemplateNames();
  if (!context.content || !context.containerFile) {
    logger.info("Skipping classification: missing content or container file");
    return context;
  }

  const result = await context.plugin.classifyContentV2(
    `${getOriginalContent(context.content)}, ${context.containerFile.name}`,
    templateNames
  );
  logger.info("Classification result", result);
  if (!result) return context;
  context.classification = {
    documentType: result,
    confidence: 100,
    reasoning: "N/A",
  };

  // Set the classification in the record manager
  context.recordManager.setClassification(context.hash, result);

  // Explicitly log the completion of classification
  context.recordManager.completeAction(context.hash, Action.CLASSIFY_DONE);

  return context;
}

// Pipeline processing steps

async function startProcessing(
  context: ProcessingContext
): Promise<ProcessingContext> {
  return context;
}

async function getContentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  const fileToRead = context.inboxFile;
  const content = await context.plugin.getTextFromFile(fileToRead);

  // For audio files, prepend the audio file link and title at the top
  let finalContent = content;
  if (
    VALID_AUDIO_EXTENSIONS.includes(context.inboxFile?.extension) &&
    context.attachmentFile &&
    context.containerFile
  ) {
    const audioFileName = context.attachmentFile.name;
    const audioLink = `![[${context.attachmentFile.path}]]\n\n`;
    const transcriptHeader = `## Transcript for ${audioFileName}\n\n`;
    finalContent = audioLink + transcriptHeader + content;
  }

  context.content = finalContent;
  if (context.containerFile) {
    await context.plugin.app.vault.modify(context.containerFile, finalContent);
  }

  // Explicitly log the completion of content extraction
  // This will be used to track audio transcription and image processing
  context.recordManager.completeAction(context.hash, Action.EXTRACT_DONE);

  return context;
}

async function cleanupStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  try {
    // Early return if no content
    if (!context.content) {
      await handleBypass(context, "No content available");
    }

    if (!context.content) {
      throw new Error("Content is required for cleanup step");
    }

    // Use the sanitizeContent utility which properly preserves frontmatter
    const sanitizedContent = await sanitizeContent(context.content);

    // Bypass if content is too short (excluding frontmatter)
    const contentWithoutFrontmatter = sanitizedContent
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim();
    if (contentWithoutFrontmatter.length < 5) {
      await handleBypass(context, "Content too short (less than 5 characters)");
    }

    // Set the sanitized content back
    context.content = sanitizedContent;
    return context;
  } catch (error) {
    logger.error("Error in preprocessContentStep:", error);
    throw error;
  }
}

// New helper function to handle bypassing
async function handleBypass(
  context: ProcessingContext,
  reason: string
): Promise<void> {
  try {
    logger.info("Bypassing file", context.inboxFile);

    // Show user notification
    const fileName = context.inboxFile.basename;
    const bypassedFolderPath = context.plugin.settings.bypassedFilePath;

    if (context.plugin.settings.enableProcessingNotifications) {
      new Notice(
        `⚠️ Bypassed: ${fileName}\nReason: ${reason}\nLocation: ${bypassedFolderPath}`,
        5000
      );
    }

    // Then move the file
    await safeMove(context.plugin.app, context.inboxFile, bypassedFolderPath);

    context.queue.bypass(context.hash);
    context.recordManager.setStatus(context.hash, "bypassed");
    throw new Error("Bypassed due to " + reason);
  } catch (error) {
    logger.error("Error in handleBypass:", error);
    throw error;
  }
}

async function formatContentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (!context.classification) {
    logger.info("Skipping formatting: no classification available");
    return context;
  }

  // Early return if no classification
  if (!context.classification.documentType) {
    logger.info("Skipping formatting: no classification available");
    return context;
  }

  // Early return if classification confidence is too low
  if (context.classification.confidence < 80) {
    logger.info("Skipping formatting: classification confidence too low", {
      confidence: context.classification.confidence,
    });
    return context;
  }

  // Early return if no content
  if (!context.content) {
    logger.info("Skipping formatting: no content available");
    return context;
  }

  logger.info("Formatting content step", context.classification);

  // get token amount from token counter
  await initializeTokenCounter();
  const tokenAmount = getTokenCount(context.content);
  cleanup();
  if (tokenAmount > context.plugin.settings.maxFormattingTokens) {
    logger.info("Skipping formatting: content too large", {
      tokenAmount,
      maxFormattingTokens: context.plugin.settings.maxFormattingTokens,
    });
    return context;
  }

  try {
    const instructions = await context.plugin.getTemplateInstructions(
      context.classification.documentType
    );

    if (!instructions) {
      logger.info("Skipping formatting: no instructions available");
      return context;
    }

    // Use the Organizer's streamFormatInCurrentNote method for consistent behavior
    if (!context.containerFile || !context.content) {
      logger.info("Skipping formatting: missing container file or content");
      return context;
    }

    await context.plugin.streamFormatInCurrentNote({
      file: context.containerFile,
      content: context.content,
      formattingInstruction: instructions,
    });

    // Explicitly log the completion of formatting
    context.recordManager.completeAction(context.hash, Action.FORMATTING_DONE);
    context.recordManager.setFormatted(context.hash, true);

    return context;
  } catch (error) {
    logger.error("Error in formatContentStep:", error);
    throw error;
  }
}
async function findSimilarTagsFromEmbeddings(
  context: ProcessingContext
): Promise<string[]> {
  const client = context.plugin.vertexBrainClient;
  if (!client) return [];

  try {
    const similar = await client.vectorSearch(
      context.content?.slice(0, 2000) ?? "",
      15
    );
    const tagCounts = new Map<string, number>();
    for (const note of similar) {
      if (note.similarity > 0.6) {
        for (const tag of note.tags ?? []) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + note.similarity);
        }
      }
    }
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  } catch {
    return [];
  }
}

async function recommendTagsStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  const existingTags = await context.plugin.getAllVaultTags();
  if (!context.content || !context.containerFile) {
    logger.info(
      "Skipping tag recommendation: missing content or container file"
    );
    return context;
  }

  // Pre-populate from embeddings (existing tags from similar notes)
  const embeddingTags = await findSimilarTagsFromEmbeddings(context);
  if (embeddingTags.length) {
    context.tags = [...new Set([...(context.tags ?? []), ...embeddingTags])];
  }

  const tags = await context.plugin.recommendTags(
    context.content,
    context.containerFile.path,
    existingTags
  );
  const modelTags = tags?.map(t => t.tag) ?? [];
  context.tags = [...new Set([...(context.tags ?? []), ...modelTags])];
  // for each tag, append it to the file
  if (context.tags && context.containerFile) {
    await context.plugin.appendTags(context.containerFile, context.tags);
  }
  context.recordManager.setTags(context.hash, context.tags);
  return context;
}
async function appendAttachmentStep(
  context: ProcessingContext
): Promise<ProcessingContext> {
  if (context.attachmentFile && context.containerFile) {
    // Skip audio files - they're already added at the top in getContentStep
    if (VALID_AUDIO_EXTENSIONS.includes(context.attachmentFile.extension)) {
      return context;
    }

    // For other media types (images), append at the end as before
    // Use Obsidian's link generation for guaranteed recognition:
    const link = context.plugin.app.fileManager.generateMarkdownLink(
      context.attachmentFile,
      context.containerFile.parent?.path ?? ""
    );
    // Add '!' prefix to embed the audio file instead of just linking
    await context.plugin.app.vault.append(context.containerFile, `\n\n${link}`);
  }
  return context;
}

async function completeProcessing(
  context: ProcessingContext
): Promise<ProcessingContext> {
  context.recordManager.setStatus(context.hash, "completed");
  return context;
}

// Error handling

async function handleError(
  error: any,
  context: ProcessingContext
): Promise<void> {
  const lastError = context.recordManager.getLastError(context.hash);

  logger.error(`Error in step ${lastError?.action}:`, {
    error: error.message,
    step: lastError?.action,
    file: context.inboxFile.path,
  });

  context.recordManager.setStatus(context.hash, "error");

  const fileName = context.inboxFile.basename;
  const errorMessage = lastError?.error?.message || error.message || "Unknown error";
  const errorAction = lastError?.action;

  // Determine destination folder and error type
  let destinationFolder: string;
  let errorType: string;

  // Different handling based on error type
  switch (errorAction) {
    case Action.ERROR_MOVING_ATTACHMENT:
    case Action.ERROR_MOVING:
      destinationFolder = context.plugin.settings.errorFilePath;
      errorType = "File system error";
      await moveFileToErrorFolder(context);
      break;
    case Action.ERROR_CLASSIFY:
    case Action.ERROR_TAGGING:
      destinationFolder = context.plugin.settings.backupFolderPath;
      errorType = "AI processing error";
      await moveToBackupFolder(context);
      break;
    default:
      destinationFolder = context.plugin.settings.errorFilePath;
      errorType = "Processing error";
      await moveFileToErrorFolder(context);
  }

  // Show user notification
  if (context.plugin.settings.enableProcessingNotifications && errorAction) {
    const formattedMessage = formatErrorMessage(errorAction, errorMessage);
    new Notice(
      `❌ Error: ${fileName}\n${errorType}: ${formattedMessage}\nLocation: ${destinationFolder}`,
      6000
    );
  }
}

// moveToBackupFolder
async function moveToBackupFolder(context: ProcessingContext): Promise<void> {
  await safeMove(
    context.plugin.app,
    context.inboxFile,
    context.plugin.settings.backupFolderPath
  );
}

// Helper functions for file operations
async function moveFileToErrorFolder(
  context: ProcessingContext
): Promise<void> {
  await safeMove(
    context.plugin.app,
    context.inboxFile,
    context.plugin.settings.errorFilePath
  );
}

// Helper functions for initialization and usage
export function initializeInboxQueue(plugin: ZenithAI): void {
  Inbox.cleanup();
  Inbox.initialize(plugin);
}

export function enqueueFiles(files: TFile[]): void {
  Inbox.getInstance().enqueueFiles(files);
}

export function getInboxStatus(): QueueStatus {
  return Inbox.getInstance().getQueueStats();
}
// skip actions when settings below are false
function shouldSkipAction(context: ProcessingContext, action: Action): boolean {
  switch (action) {
    case Action.CLASSIFY:
      return !context.plugin.settings.enableDocumentClassification;
    case Action.FORMATTING:
      return !context.plugin.settings.enableDocumentClassification;
    case Action.RENAME:
      return !context.plugin.settings.enableFileRenaming;
    case Action.TAGGING:
      return !context.plugin.settings.useSimilarTags;
    default:
      return false;
  }
}

export function getActionDisplayName(action: Action): string {
  const actionMap: Record<string, string> = {
    [Action.EXTRACT]: "Extracting content",
    [Action.CLASSIFY]: "Classifying document",
    [Action.MOVING]: "Finding destination folder",
    [Action.RENAME]: "Generating title",
    [Action.TAGGING]: "Adding tags",
    [Action.FORMATTING]: "Formatting content",
  };
  return actionMap[action] || action.toString();
}

function formatErrorMessage(
  action: Action,
  errorMessage: string
): string {
  // Map technical error actions to user-friendly descriptions
  const actionMap: Record<string, string> = {
    [Action.ERROR_MOVING]: "Failed to move file",
    [Action.ERROR_MOVING_ATTACHMENT]: "Failed to move attachment",
    [Action.ERROR_CLASSIFY]: "Failed to classify document",
    [Action.ERROR_TAGGING]: "Failed to generate tags",
    [Action.ERROR_EXTRACT]: "Failed to extract content",
    [Action.ERROR_RENAME]: "Failed to rename file",
    [Action.ERROR_FORMATTING]: "Failed to format content",
    [Action.ERROR_CLEANUP]: "Failed to clean up file",
    [Action.ERROR_VALIDATE]: "Failed to validate file",
    [Action.ERROR_CONTAINER]: "Failed to create container",
    [Action.ERROR_APPEND]: "Failed to append attachment",
    [Action.ERROR_COMPLETE]: "Failed to complete processing",
  };

  const userFriendlyAction = actionMap[action] || action.toString();

  // Truncate long error messages
  const maxLength = 100;
  const truncatedMessage = errorMessage.length > maxLength
    ? errorMessage.substring(0, maxLength) + "..."
    : errorMessage;

  return `${userFriendlyAction}: ${truncatedMessage}`;
}

function calculateProgress(record: FileRecord): number {
  // Define total pipeline steps (excluding optional ones)
  const totalSteps = [
    Action.CLEANUP,
    Action.VALIDATE,
    Action.CONTAINER,
    Action.MOVING_ATTACHMENT,
    Action.EXTRACT,
    Action.CLASSIFY,
    Action.MOVING,
    Action.RENAME,
    Action.FORMATTING,
    Action.APPEND,
    Action.TAGGING,
    Action.COMPLETED,
  ].length;

  // Count completed steps (excluding skipped)
  const completedSteps = Object.values(record.logs).filter(
    (log) => log.completed && !log.skipped
  ).length;

  return Math.round((completedSteps / totalSteps) * 100);
}

async function executeStep(
  context: ProcessingContext,
  step: (context: ProcessingContext) => Promise<ProcessingContext>,
  action: Action,
  errorAction: Action
): Promise<ProcessingContext> {
  try {
    if (shouldSkipAction(context, action)) {
      context.recordManager.skipAction(context.hash, action);
      return context;
    }

    // Log the start of the action
    context.recordManager.addAction(context.hash, action);

    // Show toast notification for processing steps (only for key actions)
    const shouldNotify = context.plugin.settings.enableProcessingNotifications;
    if (
      shouldNotify &&
      [
        Action.EXTRACT,
        Action.CLASSIFY,
        Action.MOVING,
        Action.RENAME,
        Action.TAGGING,
        Action.FORMATTING,
      ].includes(action)
    ) {
      const fileName =
        context.containerFile?.basename || context.inboxFile.basename;
      const actionName = getActionDisplayName(action);

      // Calculate queue position and progress
      const allRecords = context.recordManager.getAllRecords();
      const processingFiles = allRecords.filter((r) => r.status === "processing");
      const queuedFiles = allRecords.filter((r) => r.status === "queued");

      // Calculate queue position for current file
      const currentFileIndex = processingFiles.findIndex(
        (r) => r.id === context.hash
      );
      const queuePosition =
        currentFileIndex >= 0
          ? queuedFiles.length + currentFileIndex + 1
          : queuedFiles.length + processingFiles.length + 1;
      const totalInQueue = queuedFiles.length + processingFiles.length;

      // Calculate progress percentage
      const record = context.recordManager.getRecord(context.hash);
      const progress = record ? calculateProgress(record) : 0;

      // Enhanced notification with queue position and progress
      const queueInfo =
        totalInQueue > 1 ? ` (${queuePosition}/${totalInQueue})` : "";
      const progressInfo = progress > 0 ? ` - ${progress}%` : "";
      new Notice(
        `📄 ${fileName}: ${actionName}${queueInfo}${progressInfo}`,
        3000
      );

      context.plugin.app.workspace.trigger("zenith-ai:processing-step", {
        fileName,
        action: actionName,
        hash: context.hash,
        queuePosition: totalInQueue > 1 ? queuePosition : undefined,
        totalInQueue: totalInQueue > 1 ? totalInQueue : undefined,
        progress,
      });
    }

    // Execute the step
    const result = await step(context);

    // Log the completion of the action
    // Check if this is a "DONE" action or needs the corresponding "DONE" action
    const isDoneAction = action.toString().includes("_DONE");
    if (!isDoneAction) {
      // Find the corresponding "DONE" action if it exists
      const doneActionKey = `${action.toString()}_DONE`;
      const doneAction = Object.values(Action).find(
        a => a.toString() === doneActionKey
      );

      if (doneAction) {
        // Log the completion with the corresponding "DONE" action
        context.recordManager.addAction(context.hash, doneAction, true);
      } else {
        // If no corresponding "DONE" action exists, mark the current action as completed
        context.recordManager.completeAction(context.hash, action);
      }
    } else {
      // If this is already a "DONE" action, mark it as completed
      context.recordManager.completeAction(context.hash, action);
    }

    return result;
  } catch (error) {
    context.recordManager.addAction(context.hash, errorAction);
    context.recordManager.addError(context.hash, {
      action: errorAction,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function safeExecuteStep(
  context: ProcessingContext,
  step: (context: ProcessingContext) => Promise<ProcessingContext>,
  action: Action,
  errorAction: Action
): Promise<ProcessingContext> {
  try {
    return await executeStep(context, step, action, errorAction);
  } catch (error) {
    logger.warn(`Optional step ${action} failed, continuing pipeline: ${error.message}`);
    return context;
  }
}


