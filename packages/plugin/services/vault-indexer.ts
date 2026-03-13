import { TFile } from "obsidian";
import type ZenithAI from "../index";
import type { VertexBrainClient } from "./vertex-brain-client";

const RATE_LIMIT_MS = 150;

export class VaultIndexer {
  private plugin: ZenithAI;
  private queue: TFile[] = [];
  private running = false;

  constructor(plugin: ZenithAI) {
    this.plugin = plugin;
  }

  enqueue(file: TFile): void {
    if (!this.plugin.settings.enableVectorAutoSort) return;
    if (!this.queue.find((f) => f.path === file.path)) {
      this.queue.push(file);
    }
    if (!this.running) this.processQueue();
  }

  async indexAll(): Promise<void> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    for (const file of files) this.enqueue(file);
  }

  private async processQueue(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const file = this.queue.shift()!;
      try {
        await this.indexFile(file);
      } catch (e) {
        // Non-fatal — log and continue
        console.debug(`[VaultIndexer] Failed to index ${file.path}:`, e);
      }
      await sleep(RATE_LIMIT_MS);
    }
    this.running = false;
  }

  private async indexFile(file: TFile): Promise<void> {
    const client: VertexBrainClient | null = this.plugin.vertexBrainClient;
    if (!client) return;

    const content = await this.plugin.app.vault.read(file);
    const metadata = this.plugin.app.metadataCache.getFileCache(file);

    const tags: string[] = metadata?.frontmatter?.tags ?? [];
    const folder_path = file.parent?.path ?? "";

    await client.vectorUpsert({
      id: file.path,
      content: content.slice(0, 6000),
      folder_path,
      tags,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
