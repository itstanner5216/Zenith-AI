import { tool } from 'ai';
import { z } from 'zod';

/**
 * Opens a file in the Obsidian editor.
 * Stub — the actual open-file event is dispatched by the Obsidian plugin
 * when it receives this tool call result.
 */
export const openFile = tool({
  description: 'Open a specific file in the Obsidian editor by its vault path.',
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        'The vault-relative path of the file to open (e.g. "Notes/MyNote.md")'
      ),
  }),
  execute: async ({ path }) => {
    return { success: true, path, data: null };
  },
});
