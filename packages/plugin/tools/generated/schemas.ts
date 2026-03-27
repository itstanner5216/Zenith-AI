// ─── Generated JSON schemas (single source of truth) ─────────────────────────
// Used with `jsonSchema()` from the AI SDK to define tool input shapes.
// Do not edit by hand — regenerate with `pnpm generate:tools`.

import type { JSONSchema7 } from "json-schema";

export const getSearchQuerySchema: JSONSchema7 = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Semantic search query to find relevant notes in the vault.",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

export const getLastModifiedFilesSchema: JSONSchema7 = {
  type: "object",
  properties: {
    count: {
      type: "number",
      description: "Number of recently modified files to retrieve (max 20).",
    },
  },
  required: ["count"],
  additionalProperties: false,
};

export const openFileSchema: JSONSchema7 = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "Vault-relative path of the file to open.",
    },
  },
  required: ["filePath"],
  additionalProperties: false,
};

export const moveFilesSchema: JSONSchema7 = {
  type: "object",
  properties: {
    filePaths: {
      type: "array",
      items: { type: "string" },
      description: "Vault-relative paths of the files to move.",
    },
    destinationFolder: {
      type: "string",
      description: "Vault-relative destination folder path.",
    },
  },
  required: ["filePaths", "destinationFolder"],
  additionalProperties: false,
};

export const renameFilesSchema: JSONSchema7 = {
  type: "object",
  properties: {
    renames: {
      type: "array",
      items: {
        type: "object",
        properties: {
          oldPath: { type: "string", description: "Current vault-relative path." },
          newName: { type: "string", description: "New filename (without directory)." },
        },
        required: ["oldPath", "newName"],
        additionalProperties: false,
      },
      description: "List of rename operations to perform.",
    },
  },
  required: ["renames"],
  additionalProperties: false,
};
