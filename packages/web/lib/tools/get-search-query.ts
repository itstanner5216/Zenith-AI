import { tool } from 'ai';
import { z } from 'zod';

/**
 * Generates a semantic search query from the user's question/context.
 * The derived query is returned so the client (Obsidian plugin) can
 * search the vault index with it.
 */
export const getSearchQuery = tool({
  description:
    'Generate a concise semantic search query from the conversation context to find relevant notes in the Obsidian vault.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('The semantic search query derived from the conversation'),
    reasoning: z
      .string()
      .optional()
      .describe('Brief explanation of why this query was chosen'),
  }),
  execute: async ({ query }) => {
    return { success: true, query, data: null };
  },
});
