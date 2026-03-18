import { TFile, TFolder } from "obsidian";
import type ZenithAI from "../index";
import type { VertexBrainClient, VaultSearchResult } from "./vertex-brain-client";

export class BackgroundScribe {
  private plugin: ZenithAI;
  private client: VertexBrainClient;
  private buffer: Array<{ timestamp: number; content: string }> = [];
  private isActive = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 30000;

  constructor(plugin: ZenithAI, client: VertexBrainClient) {
    this.plugin = plugin;
    this.client = client;
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.plugin.app.workspace.on(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn
    );
    console.log("[BackgroundScribe] Activated - will buffer chat turns");
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.plugin.app.workspace.off(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn
    );
    this.buffer = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    console.log("[BackgroundScribe] Deactivated - buffer cleared");
  }

  private handleChatTurn = async (data: any) => {
    if (!this.isActive) return;

    this.buffer.push({
      timestamp: Date.now(),
      content: data.conversationSummary,
    });

    // Debounce synthesis
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(
      () => this.synthesizeTODO(),
      this.DEBOUNCE_MS
    );
  };

  private async synthesizeTODO(): Promise<void> {
    if (this.buffer.length === 0) return;

    const combinedContent = this.buffer.map((b) => b.content).join("\n\n");
    this.buffer = [];

    // Detect project context
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const project = activeFile ? this.detectProject(activeFile.path) : null;

    // Use embeddings to find project scope
    const similarNotes = await this.client.vectorSearch(combinedContent, 10);
    const projectFiles = similarNotes.filter((n) =>
      project ? n.folder_path.includes(project) : true
    );

    // Generate TODO content
    const todoContent = await this.generateTODO(
      combinedContent,
      projectFiles,
      project
    );

    // Write to configured output file
    const outputPath = this.plugin.settings.backgroundScribeOutputFile;
    await this.writeOrUpdateTODO(outputPath, todoContent);
  }

  private detectProject(filePath: string): string | null {
    const projectsPath = this.plugin.settings.projectsPath;
    if (!projectsPath) return null;
    const escapedPath = projectsPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = filePath.match(new RegExp(`${escapedPath}/([^/]+)`));
    return match ? match[1] : null;
  }

  private async generateTODO(
    conversation: string,
    contextFiles: VaultSearchResult[],
    project: string | null
  ): Promise<string> {
    const context = `Based on this conversation and related files, generate actionable TODO items:\n\n${conversation}`;
    const response = await this.client.answer(context);
    return response.answer;
  }

  private async writeOrUpdateTODO(
    path: string,
    content: string
  ): Promise<void> {
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    if (parentDir) {
      const existingFolder = this.plugin.app.vault.getAbstractFileByPath(parentDir);
      if (existingFolder && !(existingFolder instanceof TFolder)) {
        throw new Error(`Background Scribe output parent path is not a folder: ${parentDir}`);
      }
      if (!existingFolder) {
        await this.plugin.app.vault.createFolder(parentDir);
      }
    }
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.plugin.app.vault.modify(file, content);
    } else {
      await this.plugin.app.vault.create(path, content);
    }
  }

  get isActiveState(): boolean {
    return this.isActive;
  }
}
