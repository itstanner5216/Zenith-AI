import { tool } from 'ai';
import { z } from 'zod';

/**
 * Renames one or more files in the vault (in place, same folder).
 * Stub — the Obsidian plugin executes the actual rename via fileManager.
 */
export const renameFiles = tool({
  description:
    'Rename one or more files in the Obsidian vault without changing their location.',
  inputSchema: z.object({
    files: z
      .array(
        z.object({
          sourcePath: z
            .string()
            .describe('Current vault-relative path of the file'),
          newName: z
            .string()
            .describe(
              'New filename without extension (e.g. "Meeting Notes 2024-06-01")'
            ),
        })
      )
      .min(1)
      .describe('List of files to rename'),
  }),
  execute: async ({ files }) => {
    return { success: true, renamedCount: files.length, files, data: null };
  },
});
