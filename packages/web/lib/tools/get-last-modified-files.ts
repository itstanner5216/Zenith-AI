import { tool } from 'ai';
import { z } from 'zod';

/**
 * Returns recently modified vault files.
 * Stub — actual vault access happens in the Obsidian plugin via tool result handling.
 */
export const getLastModifiedFiles = tool({
  description:
    'Retrieve the most recently modified files from the Obsidian vault, useful for understanding recent activity.',
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .describe('Maximum number of files to return (1-50, default: 10)'),
  }),
  execute: async ({ limit }) => {
    return { success: true, limit, files: [], data: null };
  },
});
