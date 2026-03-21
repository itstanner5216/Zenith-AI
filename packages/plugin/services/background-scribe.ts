import { TFile, TFolder } from "obsidian";
import type ZenithAI from "../index";
import type {
  VertexBrainClient,
  VaultSearchResult,
} from "./vertex-brain-client";

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

  activate(): boolean {
    if (this.isActive) return true;
    this.isActive = true;
    this.plugin.app.workspace.on(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn,
    );
    this.plugin.app.workspace.on(
      "zenith-ai:conversation-ended" as any,
      this.handleConversationEnded,
    );
    console.log("[BackgroundScribe] Activated - will buffer chat turns");
    this.plugin.app.workspace.trigger(
      "zenith-ai:background-scribe-changed" as any,
    );
    return true;
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.plugin.app.workspace.off(
      "vault-intelligence:chat-turn" as any,
      this.handleChatTurn,
    );
    this.plugin.app.workspace.off(
      "zenith-ai:conversation-ended" as any,
      this.handleConversationEnded,
    );
    this.buffer = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    console.log("[BackgroundScribe] Deactivated - buffer cleared");
    this.plugin.app.workspace.trigger(
      "zenith-ai:background-scribe-changed" as any,
    );
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
      this.DEBOUNCE_MS,
    );
  };

  async synthesizeTODO(): Promise<void> {
    if (this.buffer.length === 0) return;

    const combinedContent = this.buffer.map(b => b.content).join("\n\n");
    // Backup buffer before clearing in case write fails
    const backupBuffer = [...this.buffer];

    // Detect project context
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const project = activeFile ? this.detectProject(activeFile.path) : null;

    // Use embeddings to find project scope
    const similarNotes = await this.client.vectorSearch(combinedContent, 10);
    const projectFiles = similarNotes.filter(n =>
      project ? n.folder_path.includes(project) : true,
    );

    // Generate TODO content
    const todoContent = await this.generateTODO(
      combinedContent,
      projectFiles,
      project,
    );

    // Write to configured output file
    try {
      const outputPath = "TODO.md";
      await this.writeOutputFile(outputPath, todoContent);
      // Only clear buffer after successful write
      this.buffer = [];
    } catch (error) {
      // Restore buffer if write fails
      this.buffer = backupBuffer;
      console.error("[BackgroundScribe] Failed to write output file:", error);
      throw error;
    }
  }

  private detectProject(filePath: string): string | null {
    const projectsPath = "Projects";
    if (!projectsPath) return null;
    const escapedPath = projectsPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = filePath.match(new RegExp(`(?:^|/)${escapedPath}/([^/]+)`));
    return match ? match[1] : null;
  }

  private async generateTODO(
    conversation: string,
    contextFiles: VaultSearchResult[],
    project: string | null,
  ): Promise<string> {
    const context = `Based on this conversation and related files, generate actionable TODO items:\n\n${conversation}`;
    const response = await this.client.answer(context);
    return response.answer;
  }

  private async writeOutputFile(path: string, content: string): Promise<void> {
    let normalizedPath = path.trim();
    if (!normalizedPath) {
      normalizedPath = "TODO.md";
    }

    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    const parentDir =
      lastSlashIndex > 0 ? normalizedPath.substring(0, lastSlashIndex) : "";

    if (parentDir) {
      const existingFolder =
        this.plugin.app.vault.getAbstractFileByPath(parentDir);
      if (existingFolder && !(existingFolder instanceof TFolder)) {
        throw new Error(
          `Background Scribe output parent path is not a folder: ${parentDir}`,
        );
      }
      if (!existingFolder) {
        const parts = parentDir
          .split("/")
          .map(segment => segment.trim())
          .filter(segment => segment.length > 0);
        let currentPath = "";
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const existing =
            this.plugin.app.vault.getAbstractFileByPath(currentPath);
          if (existing && !(existing instanceof TFolder)) {
            throw new Error(
              `Background Scribe output parent path is not a folder: ${currentPath}`,
            );
          }
          if (!existing) {
            await this.plugin.app.vault.createFolder(currentPath);
          }
        }
      }
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      await this.plugin.app.vault.modify(file, content);
    } else {
      await this.plugin.app.vault.create(normalizedPath, content);
    }
  }

  get isActiveState(): boolean {
    return this.isActive;
  }

  get bufferCount(): number {
    return this.buffer.length;
  }

  private handleConversationEnded = async () => {
    if (!this.isActive || this.buffer.length === 0) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.synthesizeTODO();
  };
}
