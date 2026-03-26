// ─── Generated Tool Interfaces ───────────────────────────────────────────────
// This file is generated to provide type-safe interfaces for AI tool calls.
// DO NOT edit manually — regenerate via `pnpm generate:tools` if needed.

// ─── Search Tool ─────────────────────────────────────────────────────────────
export interface GetSearchQueryInput {
  query: string;
}

export interface SearchResult {
  title: string;
  contentPreview: string;
  contentLength: number;
  wordCount: number;
  path: string;
}

export type GetSearchQueryOutput = SearchResult[];

// ─── Last Modified Files Tool ────────────────────────────────────────────────
export interface GetLastModifiedFilesInput {
  count?: number;
}

export interface LastModifiedFile {
  title: string;
  contentPreview: string;
  contentLength: number;
  wordCount: number;
  path: string;
  modified: number;
  modifiedDate: string;
  reference: string;
}

export interface GetLastModifiedFilesOutput {
  success: boolean;
  files: LastModifiedFile[];
  count: number;
}

// ─── Open File Tool ──────────────────────────────────────────────────────────
export interface OpenFileInput {
  filePath: string;
}

export interface OpenFileOutput {
  success: boolean;
  message: string;
}

// ─── Move Files Tool ─────────────────────────────────────────────────────────
export interface MoveFilesInput {
  filePaths: string[];
  destinationFolder: string;
}

export interface MoveFilesOutput {
  success: boolean;
  results: string[];
}

// ─── Rename Files Tool ───────────────────────────────────────────────────────
export interface RenameFilesInput {
  renames: Array<{
    oldPath: string;
    newName: string;
  }>;
}

export interface RenameFilesOutput {
  success: boolean;
  results: string[];
}

// ─── Tool Names ──────────────────────────────────────────────────────────────
export const ALL_TOOL_NAMES = [
  "getSearchQuery",
  "getLastModifiedFiles",
  "openFile",
  "moveFiles",
  "renameFiles",
] as const;

export type PluginToolName = (typeof ALL_TOOL_NAMES)[number];
