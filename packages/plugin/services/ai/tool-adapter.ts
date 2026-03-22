import { tool, jsonSchema } from "ai";
import type { ToolSet } from "ai";
import {
  getSearchQuerySchema,
  getLastModifiedFilesSchema,
  openFileSchema,
  moveFilesSchema,
  renameFilesSchema,
} from "../../tools/generated/schemas";

/**
 * Creates AI SDK tool definitions for the plugin's vault operations.
 *
 * NOTE (intentional plan deviation): The phase plan specified Zod schemas via
 * `parameters: z.object(...)`. We use `inputSchema: jsonSchema(...)` instead to
 * avoid deep TypeScript instantiation that causes OOM crashes in ts-jest/tsc.
 * Functional behavior is identical; Zod runtime validation is the only loss.
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
      inputSchema: jsonSchema(getSearchQuerySchema),
    }),

    getLastModifiedFiles: tool({
      description: "Get recently modified files in the vault.",
      inputSchema: jsonSchema(getLastModifiedFilesSchema),
    }),

    openFile: tool({
      description: "Open a file in the vault.",
      inputSchema: jsonSchema(openFileSchema),
    }),

    moveFiles: tool({
      description: "Move files to a different folder in the vault.",
      inputSchema: jsonSchema(moveFilesSchema),
    }),

    renameFiles: tool({
      description: "Rename files in the vault.",
      inputSchema: jsonSchema(renameFilesSchema),
    }),
  };
}
