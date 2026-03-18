import "./styles.css";

// Add Node.js type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "production" | "development" | string;
  }
}
declare const process: { env: NodeJS.ProcessEnv };
declare class Buffer {
  constructor(arg: ArrayBuffer | string, encoding?: string);
  toString(encoding?: string): string;
  slice(start?: number, end?: number): Buffer;
  byteLength: number;
  static from(arrayBuffer: ArrayBuffer): Buffer;
}

import {
  Plugin,
  Notice,
  Modal,
  TFolder,
  TFile,
  normalizePath,
  loadPdfJs,
  CachedMetadata,
  LinkCache,
} from "obsidian";
import moment from "moment";
import { logMessage, sanitizeTag } from "./someUtils";
import { ZenithAISettingTab } from "./views/settings/view";
import {
  AssistantViewWrapper,
  ORGANIZER_VIEW_TYPE,
} from "./views/assistant/view";
import {
  DashboardView,
  DASHBOARD_VIEW_TYPE,
} from "./views/assistant/dashboard/view";

import { ZenithAISettings, DEFAULT_SETTINGS } from "./settings";

import { registerEventHandlers } from "./handlers/eventHandlers";
import {
  initializeOrganizer,
  initializeFileOrganizationCommands,
} from "./handlers/commandHandlers";
import {
  ensureFolderExists,
  checkAndCreateFolders,
  checkAndCreateTemplates,
  restoreDefaultTemplates,
  moveFile,
} from "./fileUtils";

import { initializeInboxQueue, Inbox } from "./inbox";
import { logger } from "./services/logger";
import { addTextSelectionContext } from "./views/assistant/ai-chat/use-context-items";
import { ProcessingStatusBar } from "./components/processing-status-bar";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

import { VertexBrainClient } from "./services/vertex-brain-client";
import { OrganizationPreferencesService } from "./services/organization-preferences";
import { VaultIndexer } from "./services/vault-indexer";
import { BackgroundScribe } from "./services/background-scribe";

type TagCounts = {
  [key: string]: number;
};

export interface FolderSuggestion {
  isNewFolder: boolean;
  score: number;
  folder: string;
  reason: string;
}

// determine sever url
interface ProcessingResult {
  text: string;
  classification?: string;
  formattedText: string;
}

export interface FileMetadata {
  instructions: {
    shouldClassify: boolean;
    shouldAppendAlias: boolean;
    shouldAppendSimilarTags: boolean;
  };
  classification?: string;
  originalText: string;
  originalPath: string | undefined;
  originalName: string;
  aiFormattedText: string;
  newName: string;
  newPath: string;
  markAsProcessed: boolean;
  shouldCreateMarkdownContainer: boolean;
  aliases: string[];
  similarTags: string[];
}
interface TitleSuggestion {
  score: number;
  title: string;
  reason: string;
}

export interface UsageData {
  tokenUsage: number;
  maxTokenUsage: number;
  isActive?: boolean;
}

export default class ZenithAI extends Plugin {
  public inbox: Inbox;
  settings: ZenithAISettings;
  private statusBarItem: HTMLElement | null = null;
  private statusBarRoot: Root | null = null;

  vertexBrainClient: VertexBrainClient | null = null;
  organizationPreferences: OrganizationPreferencesService | null = null;
  vaultIndexer: VaultIndexer | null = null;
  backgroundScribe: BackgroundScribe | null = null;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Migration: Fix old gpt-4.1-mini model name to gpt-4o-mini
    if (this.settings.selectedModel === ("gpt-4.1-mini" as any)) {
      this.settings.selectedModel = "gpt-4o-mini";
      await this.saveSettings();
    }
  }
  getServerUrl(): string {
    let serverUrl = this.settings.enableSelfHosting
      ? this.settings.selfHostingURL
      : "https://app.notecompanion.ai";

    // Remove trailing slash (/) at end of url if there is one; prevents errors for /api/chat requests
    serverUrl = serverUrl.replace(/\/$/, "");
    logMessage(`Using server URL: ${serverUrl}`);

    return serverUrl;
  }

  shouldCreateMarkdownContainer(file: TFile): boolean {
    return file.extension === "pdf";
  }

  async identifyConceptsAndFetchChunks(content: string) {
    try {
      const response = await fetch(
        `${this.getServerUrl()}/api/concepts-and-chunks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.settings.API_KEY}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        // Try to extract error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }
        throw new Error(errorMessage);
      }

      const { concepts } = await response.json();
      return concepts;
    } catch (error) {
      logger.error("Error in identifyConceptsAndFetchChunks:", error);
      new Notice("An error occurred while processing the document.", 6000);
      throw error;
    }
  }

  async formatContentV2(
    content: string,
    formattingInstruction: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.getServerUrl()}/api/format`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.API_KEY}`,
        },
        body: JSON.stringify({
          content,
          formattingInstruction,
        }),
      });

      if (!response.ok) {
        // Try to extract error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }
        throw new Error(errorMessage);
      }

      const { content: formattedContent } = await response.json();
      return formattedContent;
    } catch (error) {
      logger.error("Error formatting content:", error);
      new Notice("An error occurred while formatting the content.", 6000);
      return "";
    }
  }

  async appendBackupLinkToCurrentFile(currentFile: TFile, backupFile: TFile) {
    // Remove .md extension from path for Obsidian wikilink
    const backupPath = backupFile.path.replace(/\.md$/, "");
    const backupLink = `\n\n---\n[[${backupPath} | Link to original file]]`;

    await this.app.vault.append(currentFile, backupLink);
  }

  async appendFormattedLinkToBackupFile(
    backupFile: TFile,
    formattedFile: TFile
  ) {
    // Remove .md extension from path for Obsidian wikilink
    const formattedPath = formattedFile.path.replace(/\.md$/, "");
    const formattedLink = `\n\n---\n[[${formattedPath} | Link to formatted file]]`;

    await this.app.vault.append(backupFile, formattedLink);
  }

  async getFormatInstruction(classification: string): Promise<string> {
    // get the template file from the classification
    const templateFile = this.app.vault.getAbstractFileByPath(
      `${this.settings.templatePaths}/${classification}`
    );
    if (!templateFile || !(templateFile instanceof TFile)) {
      logger.error("Template file not found or is not a valid file.");
      return "";
    }
    return await this.app.vault.read(templateFile);
  }
  async streamFormatInSplitView({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<void> {
    try {
      new Notice("Formatting content in split view...", 3000);

      // Create a new file for the formatted content
      const newFileName = `${file.basename}-formatted-${Date.now()}.md`;
      const newFilePath = `${file.parent?.path}/${newFileName}`;
      const newFile = await this.app.vault.create(newFilePath, "");

      // Open the new file in a split view
      const leaf = this.app.workspace.splitActiveLeaf();
      await leaf.openFile(newFile);

      let formattedContent = "";
      const updateCallback = async (partialContent: string) => {
        formattedContent = partialContent;
        await this.app.vault.modify(newFile, formattedContent);
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );

      new Notice("Content formatted in split view successfully", 3000);
    } catch (error) {
      logger.error("Error formatting content in split view:", error);
      new Notice(
        "An error occurred while formatting the content in split view.",
        6000
      );
    }
  }

  /**
   * Cleans up tags in formatted content by removing extra # symbols
   * Fixes cases where AI generates tags with # that then appear as ## in Obsidian
   * Also removes # from tags in frontmatter (frontmatter tags should not have #)
   */
  private cleanupTagsInContent(content: string): string {
    // First, handle frontmatter tags
    const frontmatterRegex = /^---\n([\s\S]*?)\n---(\n|$)/;
    const frontmatterMatch = content.match(frontmatterRegex);

    if (frontmatterMatch) {
      let frontmatterContent = frontmatterMatch[1];
      const closingNewline = frontmatterMatch[2] || "\n";

      // Clean up tags in frontmatter YAML
      // Match tags: ["#tag1", "#tag2"] or tags: ["tag1", "#tag2"] patterns
      // Also handles multiline arrays
      frontmatterContent = frontmatterContent.replace(
        /tags:\s*\[([\s\S]*?)\]/g,
        (match, tagsContent) => {
          // Extract all tags (handles both single-line and multiline arrays)
          const tagMatches = tagsContent.match(/["']([^"']*)["']/g) || [];
          const cleanedTags = tagMatches.map((tagMatch: string) => {
            // Remove quotes and # symbols
            let cleaned = tagMatch
              .replace(/^["']|["']$/g, "")
              .replace(/^#+/, "");

            // Sanitize tag name: replace spaces with underscores (Obsidian requirement)
            // This handles tags like "social media" -> "social_media"
            cleaned = cleaned.replace(/\s+/g, "_");

            // Remove any leading or trailing underscores
            cleaned = cleaned.replace(/^_+|_+$/g, "");

            return `"${cleaned}"`;
          });

          // Preserve original formatting (single-line vs multiline)
          const isMultiline = tagsContent.includes("\n");
          if (isMultiline) {
            return `tags: [\n${cleanedTags
              .map((tag: string) => `  ${tag}`)
              .join(",\n")}\n]`;
          } else {
            return `tags: [${cleanedTags.join(", ")}]`;
          }
        }
      );

      // Replace the frontmatter section with cleaned version
      content = content.replace(
        frontmatterRegex,
        `---\n${frontmatterContent}\n---${closingNewline}`
      );
    }

    // Then, clean up inline tags in the content body
    const lines = content.split("\n");
    let inFrontmatter = false;
    const cleanedLines = lines.map(line => {
      // Track frontmatter boundaries
      if (line.trim() === "---") {
        inFrontmatter = !inFrontmatter;
        return line;
      }

      // Skip processing inside frontmatter (already handled above)
      if (inFrontmatter) {
        return line;
      }

      // Skip markdown headers (lines starting with #)
      if (/^#{1,6}\s/.test(line)) {
        return line;
      }

      // Skip code blocks
      if (line.trim().startsWith("```")) {
        return line;
      }

      // Replace ##tag with #tag (multiple # before a tag word)
      // This handles cases where AI adds # to tags that already get # from Obsidian
      return line.replace(/(\s|^)(#{2,})([a-zA-Z0-9_\-]+)/g, "$1#$3");
    });

    return cleanedLines.join("\n");
  }

  async streamFormatInCurrentNote({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<void> {
    try {
      new Notice("Formatting content...", 3000);

      // Backup the file before formatting and get the backup file
      const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
        file
      );

      let formattedContent = "";
      const updateCallback = async (partialContent: string) => {
        // Clean up tags before saving
        formattedContent = this.cleanupTagsInContent(partialContent);
        await this.app.vault.modify(file, formattedContent);
      };
      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );
      this.appendBackupLinkToCurrentFile(file, backupFile);
      await this.appendFormattedLinkToBackupFile(backupFile, file);

      new Notice("Content formatted successfully", 3000);
    } catch (error) {
      logger.error("Error formatting content:", error);
      new Notice("An error occurred while formatting the content.", 6000);
    }
  }

  async streamFormatAppendInCurrentNote({
    file,
    formattingInstruction,
    content,
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
  }): Promise<void> {
    try {
      new Notice("Appending formatted content...", 3000);

      let formattedContent = "";
      const updateCallback = async (partialContent: string) => {
        formattedContent = partialContent;
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.settings.API_KEY,
        updateCallback
      );

      await this.app.vault.append(file, "\n\n" + formattedContent);

      new Notice("Content appended successfully", 3000);
    } catch (error) {
      logger.error("Error appending content:", error);
      new Notice("An error occurred while appending content.", 6000);
    }
  }

  async streamFormatInCurrentNoteLineByLine({
    file,
    formattingInstruction,
    content,
    chunkMode = "line",
  }: {
    file: TFile;
    formattingInstruction: string;
    content: string;
    chunkMode?: "line" | "partial";
  }): Promise<void> {
    try {
      new Notice("Formatting content line by line...", 3000);

      // Backup the file before formatting
      const backupFile = await this.backupTheFileAndAddReferenceToCurrentFile(
        file
      );

      // Prepare streaming
      let formattedContent = "";
      let lastLineCount = 0;

      const updateCallback = async (chunk: string) => {
        if (chunkMode === "line") {
          // Split chunk into lines and only append new lines
          const lines = chunk.split("\n");
          const newLines = lines.slice(lastLineCount);
          if (newLines.length > 0) {
            formattedContent = lines.join("\n");
            lastLineCount = lines.length;
            await this.app.vault.modify(file, formattedContent);
          }
        } else {
          // For partial mode, just append the new chunk
          formattedContent = chunk;
          await this.app.vault.modify(file, formattedContent);
        }
      };

      await this.formatStream(
        content,
        formattingInstruction,
        this.getServerUrl(),
        this.getApiKey(),
        updateCallback
      );

      // Insert reference to backup
      await this.appendBackupLinkToCurrentFile(file, backupFile);
      await this.appendFormattedLinkToBackupFile(backupFile, file);
      new Notice("Line-by-line update done!", 3000);
    } catch (error) {
      logger.error("Error formatting content line by line:", error);
      new Notice("An error occurred while formatting the content.", 6000);
      throw error; // Re-throw to allow component to handle error state
    }
  }

  async createFileInInbox(title: string, content: string): Promise<void> {
    const fileName = `${title}.md`;
    const filePath = `${this.settings.pathToWatch}/${fileName}`;
    await this.app.vault.create(filePath, content);
  }

  async extractTextFromPDF(file: TFile): Promise<string> {
    const pdfjsLib = await loadPdfJs(); // Ensure PDF.js is loaded
    try {
      const arrayBuffer = await this.app.vault.readBinary(file);
      const bytes = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      let text = "";

      // Use pdfPageLimit to cap the maximum pages read.
      const pageLimit = Math.min(doc.numPages, this.settings.pdfPageLimit);
      for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        text += textContent.items.map(item => item.str).join(" ");
      }
      return text;
    } catch (error) {
      logger.error(`Error extracting text from PDF: ${error}`);
      return "";
    }
  }
  getApiKey(): string {
    return this.settings.API_KEY;
  }
  async getCurrentFileLinks(file: TFile): Promise<LinkCache[]> {
    // force metadata cache to be loaded
    await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.links || [];
  }

  async formatStream(
    content: string,
    formattingInstruction: string,
    serverUrl: string,
    apiKey: string,
    updateCallback: (partialContent: string) => void
  ): Promise<string> {
    const requestBody: any = {
      content,
      formattingInstruction,
    };

    const response = await fetch(`${serverUrl}/api/format-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `Formatting failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let formattedContent = "";

    while (true) {
      const { done, value } = (await reader?.read()) ?? {
        done: true,
        value: undefined,
      };
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      formattedContent += chunk;
      updateCallback(formattedContent);
    }

    return formattedContent;
  }

  async classifyContentV2(
    content: string,
    classifications: string[]
  ): Promise<string> {
    const trimmedContent = content.slice(0, this.settings.contentCutoffChars);

    // Use server-based approach (default or fallback)
    const serverUrl = this.getServerUrl();
    const response = await fetch(`${serverUrl}/api/classify1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        templateNames: classifications,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        let errorMessage =
          "Token limit exceeded for the current cycle. Please review your provider usage.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { documentType } = await response.json();
    return documentType;
  }

  async getTextFromFile(file: TFile): Promise<string> {
    switch (true) {
      case file.extension === "md":
        return await this.app.vault.read(file);
      case file.extension === "pdf": {
        const pdfContent = await this.extractTextFromPDF(file);
        return pdfContent;
      }
      default:
        throw new Error(`Unsupported file type: ${file.extension}`);
    }
  }

  // adds an attachment to a file using the ![[attachment]] syntax
  async appendAttachment(markdownFile: TFile, attachmentFile: TFile) {
    await this.app.vault.append(
      markdownFile,
      `\n\n![[${attachmentFile.path}]]`
    );
  }
  async appendToFrontMatter(file: TFile, key: string, value: string) {
    await this.app.fileManager.processFrontMatter(file, frontmatter => {
      if (!frontmatter.hasOwnProperty(key)) {
        frontmatter[key] = [value];
      } else if (!Array.isArray(frontmatter[key])) {
        frontmatter[key] = [frontmatter[key], value];
      } else {
        frontmatter[key].push(value);
      }
    });
  }

  async checkAndCreateFolders() {
    await checkAndCreateFolders(this.app, this.settings);
  }

  async checkAndCreateTemplates() {
    await checkAndCreateTemplates(this.app, this.settings);
  }

  async restoreTemplates() {
    try {
      await restoreDefaultTemplates(this.app, this.settings);
      new Notice("Default templates restored successfully", 3000);
      logger.info("Default templates restored");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to restore templates: ${errorMessage}`, 5000);
      logger.error("Failed to restore templates:", error);
      throw error;
    }
  }

  async ensureFolderExists(folderPath: string) {
    await ensureFolderExists(this.app, folderPath);
  }

  async moveFile(
    file: TFile,
    humanReadableFileName: string,
    destinationFolder = ""
  ) {
    return await moveFile(
      this.app,
      file,
      humanReadableFileName,
      destinationFolder
    );
  }
  // rn used to provide aichat contex
  getAllUserMarkdownFiles(): TFile[] {
    const settingsPaths = [
      this.settings.pathToWatch,
      this.settings.defaultDestinationPath,
      this.settings.attachmentsPath,
      this.settings.backupFolderPath,
    ];
    const allFiles = this.app.vault.getMarkdownFiles();
    // remove any file path that is part of the settingsPath
    const allFilesFiltered = allFiles.filter(
      file => !settingsPaths.some(path => file.path.includes(path))
    );

    return allFilesFiltered;
  }
  getAllIgnoredFolders(): string[] {
    const ignoredFolders = [
      ...this.settings.ignoreFolders,
      this.settings.defaultDestinationPath,
      this.settings.attachmentsPath,
      this.settings.backupFolderPath,
      this.settings.templatePaths,
      this.settings.pathToWatch,
      this.settings.errorFilePath,
      "_ZenithAI",
      "/",
    ];
    logMessage("ignoredFolders", ignoredFolders);
    // remove empty strings
    return ignoredFolders.filter(folder => folder !== "");
  }
  // this is a list of all the folders that file organizer to use for organization
  getAllUserFolders(): string[] {
    const allFolders = this.app.vault.getAllFolders();
    const allFoldersPaths = allFolders.map(folder => folder.path);
    const ignoredFolders = this.getAllIgnoredFolders();

    // If ignoreFolders includes "*", return empty array as all folders are ignored
    if (this.settings.ignoreFolders.includes("*")) {
      return [];
    }

    return allFoldersPaths.filter(folder => {
      // Check if the folder is not in the ignored folders list
      return (
        !ignoredFolders.includes(folder) &&
        !ignoredFolders.some(ignoredFolder =>
          folder.startsWith(ignoredFolder + "/")
        )
      );
    });
  }

  async getBacklog() {
    const pathToWatch = this.settings.pathToWatch;
    if (!pathToWatch) return [];
    const allFiles = this.app.vault.getFiles();
    const pendingFiles = allFiles.filter(
      (file) =>
        file.path === pathToWatch || file.path.startsWith(pathToWatch + "/")
    );
    return pendingFiles;
  }
  async processBacklog() {
    if (!this.settings.useInbox) return;
    const pendingFiles = await this.getBacklog();
    logMessage("Enqueuing files from backlog V3");
    Inbox.getInstance().enqueueFiles(pendingFiles);
    if (pendingFiles.length > 0) {
      new Notice(
        `Zenith-AI: Processing ${pendingFiles.length} file(s) from inbox`
      );
    }
    return;
  }

  async getAllVaultTags(): Promise<string[]> {
    // Fetch all tags from the vault
    // @ts-ignore
    const tags: TagCounts = this.app.metadataCache.getTags();

    // If no tags are found, return an empty array
    if (Object.keys(tags).length === 0) {
      logMessage("No tags found");
      return [];
    }

    // Sort tags by their occurrence count in descending order
    const sortedTags = Object.entries(tags).sort((a, b) => b[1] - a[1]);

    // Return the list of sorted tags
    return sortedTags.map(tag => tag[0]);
  }

  async recommendTags(
    content: string,
    filePath: string,
    existingTags: string[]
  ): Promise<
    Array<{ score: number; tag: string; reason: string; isNew: boolean }>
  > {
    const trimmedContent = content.slice(0, this.settings.contentCutoffChars);

    // Use server-based approach (default or fallback)
    const response = await fetch(`${this.getServerUrl()}/api/tags/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        fileName: filePath,
        existingTags,
        customInstructions: this.settings.customTagInstructions,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        let errorMessage =
          "Token limit exceeded for the current cycle. Please review your provider usage.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { tags: suggestedTags } = await response.json();
    return suggestedTags;
  }

  async getOrganizationRulesContext(): Promise<string> {
    if (!this.organizationPreferences) return "";
    const rules = await this.organizationPreferences.getRules();
    if (!rules.trim()) return "";
    return `\n\n## Cosmic Vault Structure\nThe user has defined this structure for how their vault is organized. Follow it strictly:\n\n${rules}`;
  }

  async recommendFolders(
    content: string,
    fileName: string
  ): Promise<FolderSuggestion[]> {
    const customInstructions = this.settings.customFolderInstructions;
    const trimmedContent = content.slice(0, this.settings.contentCutoffChars);

    const folders = this.getAllUserFolders();

    // Use server-based approach (default or fallback)
    const rulesContext = await this.getOrganizationRulesContext();
    const response = await fetch(`${this.getServerUrl()}/api/folders/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify({
        content: trimmedContent,
        fileName: fileName,
        folders,
        customInstructions: `${customInstructions}${rulesContext}`,
      }),
    });

    if (!response.ok) {
      // Special handling for 429 (token limit exceeded)
      if (response.status === 429) {
        let errorMessage =
          "Token limit exceeded for the current cycle. Please review your provider usage.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use default message
        }
        // Throw a specific error that can be caught by the UI
        const error = new Error(errorMessage) as any;
        error.status = 429;
        error.isTokenLimitError = true;
        throw error;
      }

      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const suggestedFolders = data.folders || [];

    // Safety check: ensure we return an array
    if (!Array.isArray(suggestedFolders)) {
      logger.error("API returned non-array folders:", suggestedFolders);
      return [];
    }

    return suggestedFolders;
  }

  async appendTag(file: TFile, tag: string) {
    // Ensure the tag starts with a hash symbol
    const formattedTag = sanitizeTag(tag);

    // Get the file content and metadata
    const fileContent = await this.app.vault.read(file);
    const metadata = this.app.metadataCache.getFileCache(file);

    // Check if tag exists in frontmatter
    const hasFrontmatterTag = metadata?.frontmatter?.tags?.includes(
      formattedTag.replace("#", "")
    );

    // Check if tag exists in content (for inline tags)
    const hasInlineTag = fileContent.includes(formattedTag);

    // If tag already exists, skip adding it
    if (hasFrontmatterTag || hasInlineTag) {
      return;
    }

    // Append similar tags
    if (this.settings.useSimilarTagsInFrontmatter) {
      await this.appendToFrontMatter(
        file,
        "tags",
        formattedTag.replace("#", "")
      );
      return;
    }

    // If we find no '#' symbol at all, add a blank line before appending the first tag
    if (!fileContent.includes("#")) {
      await this.app.vault.append(file, `\n\n${formattedTag}`);
    } else {
      await this.app.vault.append(file, `\n${formattedTag}`);
    }
  }

  async appendTags(file: TFile, tags: string[]) {
    if (!tags?.length) return;

    const fileContent = await this.app.vault.read(file);
    const metadata = this.app.metadataCache.getFileCache(file);

    const newTags = tags
      .map(sanitizeTag)
      .filter((tag) => {
        const bare = tag.replace("#", "");
        const hasFrontmatter = metadata?.frontmatter?.tags?.includes(bare);
        const hasInline = fileContent.includes(tag);
        return !hasFrontmatter && !hasInline;
      });

    if (!newTags.length) return;

    if (this.settings.useSimilarTagsInFrontmatter) {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm.tags = fm.tags || [];
        for (const tag of newTags) {
          fm.tags.push(tag.replace("#", ""));
        }
      });
    } else {
      const prefix = fileContent.includes("#") ? "\n" : "\n\n";
      await this.app.vault.append(file, prefix + newTags.join("\n"));
    }
  }

  async ensureAssistantView(): Promise<AssistantViewWrapper | null> {
    // Try to find existing view
    let view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
      ?.view as AssistantViewWrapper;

    // If view doesn't exist, create it
    if (!view) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: ORGANIZER_VIEW_TYPE,
          active: true,
        });

        // Get the newly created view
        view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
          ?.view as AssistantViewWrapper;
      }
    }

    // Reveal and focus the leaf
    if (view) {
      this.app.workspace.revealLeaf(view.leaf);
    }

    return view;
  }

  async onload() {
    this.inbox = Inbox.initialize(this);
    await this.initializePlugin();
    logger.configure(this.settings.useLogs || this.settings.debugMode);

    await this.saveSettings();
    await ensureFolderExists(this.app, this.settings.logFolderPath);

    initializeInboxQueue(this);

    // Initialize Vault Intelligence services
    this.organizationPreferences = new OrganizationPreferencesService(this);
    this.vaultIndexer = new VaultIndexer(this);

    if (this.settings.enableVectorAutoSort && this.settings.vertexBrainUrl) {
      this.vertexBrainClient = new VertexBrainClient(this.settings.vertexBrainUrl);
      const healthy = await this.vertexBrainClient.health();
      if (healthy) {
        await this.organizationPreferences.ensureExists();
        // Background index — non-blocking
        this.vaultIndexer.indexAll().catch((e) =>
          console.debug("[VaultIndexer] Initial index failed:", e)
        );
        // Initialize BackgroundScribe only when user has enabled it
        if (this.settings.backgroundScribeEnabled) {
          this.backgroundScribe = new BackgroundScribe(this, this.vertexBrainClient);
          this.backgroundScribe.activate();
        }
      } else {
        console.warn("[ZenithAI] Vertex Brain unavailable, vector auto-sort disabled");
        this.vertexBrainClient = null;
      }
    }

    // Initialize different features
    initializeOrganizer(this);
    initializeFileOrganizationCommands(this);

    this.app.workspace.onLayoutReady(() => registerEventHandlers(this));

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.vaultIndexer?.enqueue(file);
        }
      })
    );

    this.processBacklog();

    this.addCommand({
      id: "open-organizer-tab",
      name: "Open Organizer Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("organizer");
      },
    });

    this.addCommand({
      id: "open-inbox-tab",
      name: "Open Inbox Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("inbox");
      },
    });

    this.addCommand({
      id: "process-inbox-now",
      name: "Process inbox now",
      callback: async () => {
        await this.processBacklog();
      },
    });

    this.addCommand({
      id: "open-chat-tab",
      name: "Open Chat Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("chat");
      },
    });
    this.addCommand({
      id: "restore-default-templates",
      name: "Restore default templates",
      callback: async () => {
        const confirmed = await new Promise<boolean>(resolve => {
          class RestoreTemplatesModal extends Modal {
            onOpen() {
              const { contentEl } = this;
              contentEl.empty();
              contentEl.createEl("h2", { text: "Restore Default Templates" });
              contentEl.createEl("p", {
                text: "This will restore the following templates to their original plugin versions:",
              });
              const list = contentEl.createEl("ul");
              list.createEl("li", { text: "meeting_note.md" });
              list.createEl("li", { text: "enhance.md" });
              list.createEl("li", { text: "research_paper.md" });
              list.createEl("li", { text: "flash_cards.md" });
              contentEl.createEl("p", {
                text: "Your custom templates will not be affected.",
                attr: { style: "margin-top: 1em; font-weight: bold;" },
              });
              const buttonContainer = contentEl.createDiv({
                attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
              });
              buttonContainer
                .createEl("button", { text: "Cancel" })
                .addEventListener("click", () => {
                  resolve(false);
                  this.close();
                });
              buttonContainer
                .createEl("button", {
                  text: "Restore",
                  attr: { style: "background: var(--interactive-accent);" },
                })
                .addEventListener("click", () => {
                  resolve(true);
                  this.close();
                });
            }
          }
          const modal = new RestoreTemplatesModal(this.app);
          modal.open();
        });

        if (confirmed) {
          await this.restoreTemplates();
        }
      },
    });

    this.addCommand({
      id: "add-selection-to-chat",
      name: "Add Selection to Chat",
      editorCallback: async editor => {
        const selection = editor.getSelection();
        if (selection) {
          const activeFile = this.app.workspace.getActiveFile();
          const view = await this.ensureAssistantView();

          // Add the selection to context
          addTextSelectionContext({
            content: selection,
            sourceFile: activeFile?.path,
          });

          // Open chat tab
          view?.activateTab("chat");
        } else {
          new Notice("No text selected");
        }
      },
    });

    // Dashboard infrastructure is preserved for a future planning workspace,
    // but it is intentionally not exposed in the current product surface.

    // Add processing status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarRoot = createRoot(this.statusBarItem);
    this.statusBarRoot.render(
      React.createElement(ProcessingStatusBar, { plugin: this })
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }

  toggleBackgroundScribe(enabled: boolean): boolean {
    if (enabled) {
      if (!this.vertexBrainClient) {
        console.warn("[ZenithAI] Background Scribe requires Vertex Brain — enable Vertex Brain first");
        return false;
      }
      if (!this.backgroundScribe) {
        this.backgroundScribe = new BackgroundScribe(this, this.vertexBrainClient);
        this.backgroundScribe.activate();
      }
      this.app.workspace.trigger("zenith-ai:background-scribe-changed" as any);
      return true;
    } else {
      this.backgroundScribe?.deactivate();
      this.backgroundScribe = null;
      this.app.workspace.trigger("zenith-ai:background-scribe-changed" as any);
      return true;
    }
  }

  async initializePlugin() {
    await this.loadSettings();
    await this.checkAndCreateFolders();
    await this.checkAndCreateTemplates();
    this.addSettingTab(new ZenithAISettingTab(this.app, this));
  }

  async generateUniqueBackupFileName(originalFile: TFile): Promise<string> {
    const baseFileName = `${originalFile.basename}_backup_${moment().format(
      "YYYYMMDD_HHmmss"
    )}`;
    let fileName = `${baseFileName}.${originalFile.extension}`;
    let counter = 1;

    while (
      await this.app.vault.adapter.exists(
        normalizePath(`${this.settings.backupFolderPath}/${fileName}`)
      )
    ) {
      fileName = `${baseFileName}_${counter}.${originalFile.extension}`;
      counter++;
    }

    return fileName;
  }

  async backupTheFileAndAddReferenceToCurrentFile(file: TFile): Promise<TFile> {
    const backupFileName = await this.generateUniqueBackupFileName(file);
    const backupFilePath = normalizePath(
      `${this.settings.backupFolderPath}/${backupFileName}`
    );

    // Create a backup of the file
    const backupFile = await this.app.vault.copy(file, backupFilePath);

    return backupFile;
  }

  async getTemplateInstructions(templateName: string): Promise<string> {
    // Ensure template folder exists before accessing it
    const normalizedPath = normalizePath(this.settings.templatePaths);
    await ensureFolderExists(this.app, normalizedPath);

    // Ensure templates are created
    await this.checkAndCreateTemplates();

    // Small delay to ensure folder is fully created
    await new Promise(resolve => setTimeout(resolve, 100));

    const templateFolder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      logger.error(
        `Template folder not found or is not a valid folder. Path: ${normalizedPath}`
      );
      return "";
    }
    // only look at files first
    const templateFile = templateFolder.children.find(
      file => file instanceof TFile && file.basename === templateName
    );
    if (!templateFile || !(templateFile instanceof TFile)) {
      logger.error("Template file not found or is not a valid file.");
      return "";
    }
    return await this.app.vault.read(templateFile);
  }
  // create a getTemplatesV2 that returns a list of template names only
  // and doesn't reuse getTemplates()
  async getTemplateNames(): Promise<string[]> {
    // Ensure template folder exists before accessing it
    const normalizedPath = normalizePath(this.settings.templatePaths);
    await ensureFolderExists(this.app, normalizedPath);

    // Ensure templates are created
    await this.checkAndCreateTemplates();

    // Small delay to ensure folder is fully created
    await new Promise(resolve => setTimeout(resolve, 100));

    // get all file names in the template folder
    const templateFolder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!templateFolder || !(templateFolder instanceof TFolder)) {
      logger.error(
        `Template folder not found or is not a valid folder. Path: ${normalizedPath}`
      );
      return [];
    }
    const templateFiles = templateFolder.children.filter(
      file => file instanceof TFile
    ) as TFile[];
    return templateFiles.map(file => file.basename);
  }

  async recommendName(
    content: string,
    fileName: string
  ): Promise<TitleSuggestion[]> {
    const trimmedContent = content.slice(0, this.settings.contentCutoffChars);

    const customInstructions = this.settings.renameInstructions;

    const requestBody: Record<string, unknown> = {
      content: trimmedContent,
      fileName: fileName,
      customInstructions,
    };

    if (this.settings.useVaultTitles) {
      const MAX_VAULT_TITLE_SAMPLES = 20;
      const allFiles = this.app.vault.getMarkdownFiles();
      const sampleTitles = allFiles
        .slice(0, MAX_VAULT_TITLE_SAMPLES)
        .map(f => f.basename);
      if (sampleTitles.length > 0) {
        requestBody.vaultTitles = sampleTitles;
      }
    }

    const response = await fetch(`${this.getServerUrl()}/api/title/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    const { titles } = await response.json();
    return titles;
  }

  async activateDashboard(): Promise<DashboardView | null> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: DASHBOARD_VIEW_TYPE,
          active: true,
        });
      } else {
        return null;
      }
    }

    workspace.revealLeaf(leaf);
    return leaf.view as DashboardView;
  }

  // Create all necessary folders for the plugin to function properly
  public async checkAndCreateRequiredFolders(): Promise<void> {
    try {
      // Ensure all required folders exist - using app instead of app.vault
      const folderPaths = [
        this.settings.pathToWatch,
        this.settings.defaultDestinationPath,
        this.settings.referencePath,
        this.settings.attachmentsPath,
        this.settings.logFolderPath,
        this.settings.backupFolderPath,
        this.settings.templatePaths,
        this.settings.bypassedFilePath,
        this.settings.errorFilePath,
        this.settings.syncFolderPath,
      ];

      // Create each folder individually using ensureFolderExists
      for (const folderPath of folderPaths) {
        await ensureFolderExists(this.app, folderPath);
      }

      // Show success message
      new Notice("All required folders have been created successfully!", 3000);
    } catch (error) {
      console.error("Failed to create required folders:", error);
      new Notice(
        "There was an error creating the required folders. Please check console for details.",
        5000
      );
    }
  }

  async fetchUsageStats(): Promise<UsageData | null> {
    try {
      if (!this.settings.API_KEY) {
        return null;
      }

      // Try the public-usage endpoint first (works even with token limits)
      try {
        const publicResponse = await fetch(
          `${this.getServerUrl()}/api/public-usage`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.API_KEY}`,
            },
          }
        );

        if (publicResponse.ok) {
          const data = await publicResponse.json();
          return data;
        }

        logger.debug("Public usage endpoint failed, trying regular endpoint");
      } catch (error) {
        logger.debug(
          "Error fetching from public usage endpoint, trying regular endpoint"
        );
      }

      // Fall back to the regular endpoint
      const response = await fetch(`${this.getServerUrl()}/api/usage`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.API_KEY}`,
        },
      });

      if (!response.ok) {
        // Try to extract error message from response body
        let errorMessage = `Failed to fetch usage stats: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If parsing fails, use the default error message
        }

        // Special handling for token limit errors (429)
        if (response.status === 429) {
          // If we got a token limit error, create a synthetic response
          // with maxed out usage data
          if (errorMessage.includes("Token limit exceeded")) {
            // Try to get basic info from public API
            try {
              const publicResponse = await fetch(
                `${this.getServerUrl()}/api/public-usage`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.settings.API_KEY}`,
                  },
                }
              );

              if (publicResponse.ok) {
                return await publicResponse.json();
              }
            } catch (e) {
              logger.debug(
                "Failed to get public usage after token limit error",
                e
              );
            }

            // Fallback if public API also fails
            return {
              tokenUsage: 100000, // Some large number
              maxTokenUsage: 100000,
              isActive: true,
            };
          }
        }

        // For subscription inactive (403) or other errors, throw with specific message
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error("Failed to fetch usage statistics", error);
      return null;
    }
  }

  openAccountPortal() {
    // Get the server domain from settings
    const serverUrl = this.getServerUrl();

    // Extract the domain from the full server URL
    // This pattern transforms "https://app.notecompanion.ai/api" into "https://app.notecompanion.ai"
    const serverDomain = serverUrl.replace(/\/api\/?$/, "");

    // Use the server domain for the account portal URL
    const accountUrl = `${serverDomain}/sign-in`;

    // Log the URL being opened (helpful for debugging)
    logger.debug(`Opening account portal URL: ${accountUrl}`);

    // Open the URL in a browser
    window.open(accountUrl, "_blank");
  }
}
