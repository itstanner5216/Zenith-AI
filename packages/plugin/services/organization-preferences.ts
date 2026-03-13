import { TFile } from "obsidian";
import type ZenithAI from "../index";

export class OrganizationPreferencesService {
  private plugin: ZenithAI;
  private cache: string | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(plugin: ZenithAI) {
    this.plugin = plugin;
  }

  get rulesPath(): string {
    return this.plugin.settings.organizationRulesPath;
  }

  invalidate(): void {
    this.cache = null;
  }

  async getRules(): Promise<string> {
    if (
      this.cache !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS
    ) {
      return this.cache;
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(this.rulesPath);
    if (!file || !(file instanceof TFile)) {
      this.cache = "";
      this.cacheTimestamp = Date.now();
      return "";
    }

    this.cache = await this.plugin.app.vault.read(file as TFile);
    this.cacheTimestamp = Date.now();
    return this.cache;
  }

  async updateRules(newContent: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(this.rulesPath);
    if (file instanceof TFile) {
      await this.plugin.app.vault.modify(file, newContent);
    } else {
      // Create parent directories if needed
      const parts = this.rulesPath.split("/");
      if (parts.length > 1) {
        const dir = parts.slice(0, -1).join("/");
        if (!this.plugin.app.vault.getAbstractFileByPath(dir)) {
          await this.plugin.app.vault.createFolder(dir);
        }
      }
      await this.plugin.app.vault.create(this.rulesPath, newContent);
    }
    this.cache = newContent;
    this.cacheTimestamp = Date.now();
  }

  async ensureExists(): Promise<void> {
    const existing = await this.getRules();
    if (existing) return;

    const template = `# Cosmic Vault Structure

## Active Rules
- Group notes by project rather than by type
- Files tagged with #${this.plugin.settings.pinnedTag} will not be auto-sorted

## Project Registry
<!-- Add your projects here as: ProjectName → /FolderPath/ -->

---
This document is live-updated by the AI assistant when you request organizational changes.
`;

    await this.updateRules(template);
  }
}
