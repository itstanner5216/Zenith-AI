// ─── Generated Tool Schemas ──────────────────────────────────────────────────
// This file provides JSON schemas for AI SDK tool validation.
// DO NOT edit manually — regenerate via `pnpm generate:tools` if needed.

// ─── Search Tool Schema ──────────────────────────────────────────────────────
export const getSearchQuerySchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query to find relevant notes in the vault",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

// ─── Last Modified Files Tool Schema ─────────────────────────────────────────
export const getLastModifiedFilesSchema = {
  type: "object",
  properties: {
    count: {
      type: "number",
      description: "Number of recent files to retrieve (max 20)",
      default: 10,
    },
  },
  required: [],
  additionalProperties: false,
} as const;

// ─── Open File Tool Schema ───────────────────────────────────────────────────
export const openFileSchema = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "The path to the file to open in the vault",
    },
  },
  required: ["filePath"],
  additionalProperties: false,
} as const;

// ─── Move Files Tool Schema ──────────────────────────────────────────────────
export const moveFilesSchema = {
  type: "object",
  properties: {
    filePaths: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Array of file paths to move",
    },
    destinationFolder: {
      type: "string",
      description: "The destination folder path",
    },
  },
  required: ["filePaths", "destinationFolder"],
  additionalProperties: false,
} as const;

// ─── Rename Files Tool Schema ────────────────────────────────────────────────
export const renameFilesSchema = {
  type: "object",
  properties: {
    renames: {
      type: "array",
      items: {
        type: "object",
        properties: {
          oldPath: {
            type: "string",
            description: "The current file path",
          },
          newName: {
            type: "string",
            description: "The new file name (without path)",
          },
        },
        required: ["oldPath", "newName"],
        additionalProperties: false,
      },
      description: "Array of rename operations",
    },
  },
  required: ["renames"],
  additionalProperties: false,
} as const;
