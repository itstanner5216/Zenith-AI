/**
 * Obsidian-specific implementations of the Patch Engine host adapters.
 *
 * These adapters bind the engine to the Obsidian runtime via the
 * Plugin API. They are the only module in the patch engine that
 * imports from "obsidian" directly.
 */

import type { App, TFile, MarkdownView } from "obsidian";
import type { FileSystemAdapter, EditorBufferAdapter } from "./adapters";

// ---------------------------------------------------------------------------
// Obsidian File System Adapter
// ---------------------------------------------------------------------------

/**
 * File system adapter backed by Obsidian's Vault API.
 *
 * All paths are vault-relative (e.g. `"notes/example.md"`).
 */
export class ObsidianFileSystemAdapter implements FileSystemAdapter {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** Read file content via `app.vault.read()`. */
  async read(path: string): Promise<string> {
    const file = this.resolveFile(path);
    return this.app.vault.read(file);
  }

  /** Write content via `app.vault.modify()`. */
  async write(path: string, content: string): Promise<void> {
    const file = this.resolveFile(path);
    await this.app.vault.modify(file, content);
  }

  /** Check file existence via `app.vault.getAbstractFileByPath()`. */
  exists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) !== null;
  }

  /**
   * Return file metadata via `app.vault.adapter.stat()`.
   *
   * Obsidian's adapter.stat is async, but the interface requires sync.
   * We use the cached file metadata from the vault's internal file map
   * via `getAbstractFileByPath` which provides `stat` synchronously.
   */
  stat(path: string): { size: number; mtime: number } | null {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    if (!abstractFile || !("stat" in abstractFile)) {
      return null;
    }
    const tfile = abstractFile as TFile;
    return { size: tfile.stat.size, mtime: tfile.stat.mtime };
  }

  /**
   * Resolve a vault-relative path to a TFile.
   * @throws Error if the file does not exist.
   */
  private resolveFile(path: string): TFile {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    if (!abstractFile || !("stat" in abstractFile)) {
      throw new Error(`File not found in vault: ${path}`);
    }
    return abstractFile as TFile;
  }
}

// ---------------------------------------------------------------------------
// Obsidian Editor Buffer Adapter
// ---------------------------------------------------------------------------

/**
 * Editor buffer adapter that scans all open markdown editors.
 *
 * Iterates `app.workspace.getLeavesOfType('markdown')` to find content
 * from any open pane, tab, or popout window — not just the active leaf.
 */
export class ObsidianEditorBufferAdapter implements EditorBufferAdapter {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get editor buffer content for a file path by scanning all open markdown leaves.
   *
   * If the file is open in multiple panes (split views, popout windows),
   * all panes share the same underlying editor state, so we return the
   * content from the first matching leaf.
   */
  getOpenContent(path: string): string | null {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      // MarkdownView.file is the TFile for the open document
      if (view.file && view.file.path === path) {
        // view.editor.getValue() returns the current in-memory editor content
        return view.editor.getValue();
      }
    }
    return null;
  }

  /** Check if a file is currently open in any markdown editor pane. */
  isOpen(path: string): boolean {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      if (view.file && view.file.path === path) {
        return true;
      }
    }
    return false;
  }
}
