import { tool } from 'ai';
import { z } from 'zod';

/**
 * Moves one or more files to a new folder in the vault.
 * Stub — the Obsidian plugin executes the actual vault rename/move via fileManager.
 */
export const moveFiles = tool({
  description:
    'Move one or more files to a different folder in the Obsidian vault.',
  inputSchema: z.object({
    files: z
      .array(
        z.object({
          sourcePath: z
            .string()
            .describe('Current vault-relative path of the file'),
          destinationFolder: z
            .string()
            .describe(
              'Target folder path in the vault (e.g. "Archive/2024")'
            ),
        })
      )
      .min(1)
      .describe('List of files to move with their target folders'),
  }),
  execute: async ({ files }) => {
    return { success: true, movedCount: files.length, files, data: null };
  },
});
