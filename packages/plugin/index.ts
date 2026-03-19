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
  TFile,
  normalizePath,
  loadPdfJs,
} from "obsidian";
import { logMessage } from "./someUtils";
import { ZenithAISettingTab } from "./views/settings/view";
import {
  AssistantViewWrapper,
  ORGANIZER_VIEW_TYPE,
} from "./views/assistant/view";

import { ZenithAISettings, DEFAULT_SETTINGS } from "./settings";

import { registerEventHandlers } from "./handlers/eventHandlers";
import {
  initializeOrganizer,
  initializeFileOrganizationCommands,
} from "./handlers/commandHandlers";
import {
  ensureFolderExists,
} from "./fileUtils";

import { logger } from "./services/logger";
import { addTextSelectionContext } from "./views/assistant/ai-chat/use-context-items";
import { BackgroundScribe } from "./services/background-scribe";

export default class ZenithAI extends Plugin {
  settings: ZenithAISettings;
  backgroundScribe: BackgroundScribe | null = null;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  getServerUrl(): string {
    let serverUrl = this.settings.enableSelfHosting
      ? this.settings.selfHostingURL
      : "https://app.notecompanion.ai";

    serverUrl = serverUrl.replace(/\/$/, "");
    logMessage(`Using server URL: ${serverUrl}`);

    return serverUrl;
  }

  async extractTextFromPDF(file: TFile): Promise<string> {
    const pdfjsLib = await loadPdfJs();
    try {
      const arrayBuffer = await this.app.vault.readBinary(file);
      const bytes = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      let text = "";

      const pageLimit = doc.numPages;
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

  async ensureFolderExists(folderPath: string) {
    await ensureFolderExists(this.app, folderPath);
  }

  async ensureAssistantView(): Promise<AssistantViewWrapper | null> {
    let view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
      ?.view as AssistantViewWrapper;

    if (!view) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: ORGANIZER_VIEW_TYPE,
          active: true,
        });

        view = this.app.workspace.getLeavesOfType(ORGANIZER_VIEW_TYPE)[0]
          ?.view as AssistantViewWrapper;
      }
    }

    if (view) {
      this.app.workspace.revealLeaf(view.leaf);
    }

    return view;
  }

  async onload() {
    await this.initializePlugin();
    logger.configure(this.settings.debugMode);
    await this.saveSettings();

    initializeOrganizer(this);
    initializeFileOrganizationCommands(this);

    this.app.workspace.onLayoutReady(() => registerEventHandlers(this));

    this.addCommand({
      id: "open-chat-tab",
      name: "Open Chat Tab",
      callback: async () => {
        const view = await this.ensureAssistantView();
        view?.activateTab("chat");
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

          addTextSelectionContext({
            content: selection,
            sourceFile: activeFile?.path,
          });

          view?.activateTab("chat");
        } else {
          new Notice("No text selected");
        }
      },
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async initializePlugin() {
    await this.loadSettings();
    this.addSettingTab(new ZenithAISettingTab(this.app, this));
  }
}
