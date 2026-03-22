// ─── Generated interfaces (single source of truth) ───────────────────────────

export {
  type GetSearchQueryInput, type GetSearchQueryOutput,
  type GetLastModifiedFilesInput, type GetLastModifiedFilesOutput,
  type OpenFileInput, type OpenFileOutput,
  type MoveFilesInput, type MoveFilesOutput,
  type RenameFilesInput, type RenameFilesOutput,
  type SearchResult, type LastModifiedFile,
  type PluginToolName, ALL_TOOL_NAMES,
} from "../../../../tools/generated/interfaces";

import type {
  GetSearchQueryInput, GetSearchQueryOutput,
  GetLastModifiedFilesInput, GetLastModifiedFilesOutput,
  OpenFileInput, OpenFileOutput,
  MoveFilesInput, MoveFilesOutput,
  RenameFilesInput, RenameFilesOutput,
} from "../../../../tools/generated/interfaces";

import { ALL_TOOL_NAMES } from "../../../../tools/generated/interfaces";

// ─── Discriminated tool-part union ───────────────────────────────────────────

type ToolPart<NAME extends string, INPUT, OUTPUT> =
  | { type: `tool-${NAME}`; toolCallId: string; input: INPUT; state: "input-available" }
  | { type: `tool-${NAME}`; toolCallId: string; input: INPUT; state: "output-available"; output: OUTPUT };

export type PluginToolPart =
  | ToolPart<"getSearchQuery",      GetSearchQueryInput,      GetSearchQueryOutput>
  | ToolPart<"getLastModifiedFiles", GetLastModifiedFilesInput, GetLastModifiedFilesOutput>
  | ToolPart<"openFile",            OpenFileInput,            OpenFileOutput>
  | ToolPart<"moveFiles",           MoveFilesInput,           MoveFilesOutput>
  | ToolPart<"renameFiles",         RenameFilesInput,         RenameFilesOutput>;

// Convenience extract aliases used by each handler's prop type
export type GetSearchQueryPart      = Extract<PluginToolPart, { type: "tool-getSearchQuery" }>;
export type GetLastModifiedFilesPart = Extract<PluginToolPart, { type: "tool-getLastModifiedFiles" }>;
export type OpenFilePart            = Extract<PluginToolPart, { type: "tool-openFile" }>;
export type MoveFilesPart           = Extract<PluginToolPart, { type: "tool-moveFiles" }>;
export type RenameFilesPart         = Extract<PluginToolPart, { type: "tool-renameFiles" }>;

const PLUGIN_TOOL_NAMES = new Set<string>(ALL_TOOL_NAMES);

/** Narrows any UIMessage part to a typed PluginToolPart. */
export function isPluginToolPart(part: { type: string }): part is PluginToolPart {
  return part.type.startsWith("tool-") && PLUGIN_TOOL_NAMES.has(part.type.slice(5));
}

/**
 * Constructs a typed PluginToolPart from a raw fullStream tool-call event.
 *
 * This is the ONLY place where `input: unknown` is cast to a concrete input type.
 * The JSON schemas in tool-adapter.ts validate these shapes at the LLM boundary.
 */
export function buildPluginToolPart(
  toolName: string,
  toolCallId: string,
  input: unknown,
): PluginToolPart | null {
  switch (toolName) {
    case "getSearchQuery":
      return { type: "tool-getSearchQuery",      toolCallId, input: input as GetSearchQueryInput,      state: "input-available" };
    case "getLastModifiedFiles":
      return { type: "tool-getLastModifiedFiles", toolCallId, input: input as GetLastModifiedFilesInput, state: "input-available" };
    case "openFile":
      return { type: "tool-openFile",            toolCallId, input: input as OpenFileInput,            state: "input-available" };
    case "moveFiles":
      return { type: "tool-moveFiles",           toolCallId, input: input as MoveFilesInput,           state: "input-available" };
    case "renameFiles":
      return { type: "tool-renameFiles",         toolCallId, input: input as RenameFilesInput,         state: "input-available" };
    default:
      return null;
  }
}

/**
 * Transitions a PluginToolPart to its output-available variant.
 *
 * The per-tool output cast is the ONLY cast at this boundary — the caller
 * (each handler's onResult) guarantees the output matches the tool's type.
 */
export function withOutput(part: PluginToolPart, output: unknown): PluginToolPart {
  switch (part.type) {
    case "tool-getSearchQuery":
      return { ...part, state: "output-available", output: output as GetSearchQueryOutput };
    case "tool-getLastModifiedFiles":
      return { ...part, state: "output-available", output: output as GetLastModifiedFilesOutput };
    case "tool-openFile":
      return { ...part, state: "output-available", output: output as OpenFileOutput };
    case "tool-moveFiles":
      return { ...part, state: "output-available", output: output as MoveFilesOutput };
    case "tool-renameFiles":
      return { ...part, state: "output-available", output: output as RenameFilesOutput };
  }
}