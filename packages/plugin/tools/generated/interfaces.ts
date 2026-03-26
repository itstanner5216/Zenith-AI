// ─── Generated tool interfaces (single source of truth) ──────────────────────
// These types are derived from the JSON schemas in ./schemas.ts.
// Do not edit by hand — regenerate with `pnpm generate:tools`.

// ─── Shared result shapes ──────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  contentPreview: string;
  contentLength: number;
  wordCount: number;
  path: string;
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

// ─── getSearchQuery ───────────────────────────────────────────────────────────

export interface GetSearchQueryInput {
  query: string;
}

export type GetSearchQueryOutput = SearchResult[];

// ─── getLastModifiedFiles ─────────────────────────────────────────────────────

export interface GetLastModifiedFilesInput {
  count: number;
}

export interface GetLastModifiedFilesOutput {
  success: boolean;
  files: LastModifiedFile[];
  count: number;
}

// ─── openFile ─────────────────────────────────────────────────────────────────

export interface OpenFileInput {
  filePath: string;
}

export interface OpenFileOutput {
  success: boolean;
  message: string;
}

// ─── moveFiles ────────────────────────────────────────────────────────────────

export interface MoveFilesInput {
  filePaths: string[];
  destinationFolder: string;
}

export interface MoveFilesOutput {
  success: boolean;
  results: string[];
}

// ─── renameFiles ──────────────────────────────────────────────────────────────

export interface RenameFilesInput {
  renames: Array<{ oldPath: string; newName: string }>;
}

export interface RenameFilesOutput {
  success: boolean;
  results: string[];
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ALL_TOOL_NAMES = [
  "getSearchQuery",
  "getLastModifiedFiles",
  "openFile",
  "moveFiles",
  "renameFiles",
] as const;

export type PluginToolName = (typeof ALL_TOOL_NAMES)[number];
