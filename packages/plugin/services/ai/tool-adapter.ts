import { tool, jsonSchema } from "ai";
import type { ToolSet } from "ai";

/**
 * Creates AI SDK tool definitions for the plugin's vault operations.
 *
 * Tools are defined WITHOUT execute functions — execution happens client-side
 * via ToolCallHandler React components. The AI SDK will emit tool calls,
 * and the chat hook collects results from the UI before re-sending.
 *
 * Uses jsonSchema() directly to avoid deep type instantiation and OOM issues
 * that zodSchema() causes with the TypeScript compiler.
 */
export function createPluginTools(): ToolSet {
  return {
    getSearchQuery: tool({
      description: "Generate a semantic search query to find relevant notes in the vault.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          reasoning: { type: "string", description: "Why this query was chosen" },
        },
        required: ["query"],
      }),
    }),

    getLastModifiedFiles: tool({
      description: "Get recently modified files in the vault.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          count: { type: "number", description: "Number of files to return" },
        },
      }),
    }),

    openFile: tool({
      description: "Open a file in the vault.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file to open" },
        },
        required: ["filePath"],
      }),
    }),

    moveFiles: tool({
      description: "Move files to a different folder in the vault.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          filePaths: {
            type: "array",
            items: { type: "string" },
            description: "Paths of files to move",
          },
          destinationFolder: { type: "string", description: "Target folder path" },
        },
        required: ["filePaths", "destinationFolder"],
      }),
    }),

    renameFiles: tool({
      description: "Rename files in the vault.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          renames: {
            type: "array",
            items: {
              type: "object",
              properties: {
                oldPath: { type: "string", description: "Current file path" },
                newName: { type: "string", description: "New file name" },
              },
              required: ["oldPath", "newName"],
            },
            description: "List of files to rename",
          },
        },
        required: ["renames"],
      }),
    }),
  };
}
