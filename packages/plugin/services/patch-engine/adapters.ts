/**
 * Host abstraction interfaces for the Zenith Patch Engine.
 *
 * These interfaces decouple the engine from the Obsidian runtime,
 * making it testable with mock adapters and portable to other hosts.
 */

// Re-export SourceSnapshot from types for consumer convenience
export type { SourceSnapshot } from "./types";

// ---------------------------------------------------------------------------
// File System Adapter
// ---------------------------------------------------------------------------

/**
 * Platform-independent file system adapter.
 *
 * Implementations must resolve vault-relative paths to actual file
 * system locations and handle encoding as UTF-8.
 */
export interface FileSystemAdapter {
  /** Read file content as a UTF-8 string. */
  read(path: string): Promise<string>;
  /** Write a UTF-8 string to a file, creating or overwriting. */
  write(path: string, content: string): Promise<void>;
  /** Check whether a file exists at the given path (synchronous). */
  exists(path: string): boolean;
  /** Retrieve file metadata, or null if the file does not exist. */
  stat(path: string): { size: number; mtime: number } | null;
}

// ---------------------------------------------------------------------------
// Editor Buffer Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter for reading content from an open editor buffer.
 *
 * Implementations should iterate all open panes, tabs, and popout
 * windows — not just the active leaf — to find open content.
 */
export interface EditorBufferAdapter {
  /**
   * Get the current content of a file if it is open in any editor.
   *
   * Must iterate all open markdown editors (split panes, tabs, popout windows),
   * not just `app.workspace.activeLeaf`.
   *
   * @returns The editor buffer content as a string, or null if the file is not open.
   */
  getOpenContent(path: string): string | null;

  /** Check whether a file is currently open in any editor pane. */
  isOpen(path: string): boolean;
}
