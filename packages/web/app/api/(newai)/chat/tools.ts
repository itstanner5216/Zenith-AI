import { z } from 'zod';

const settingsSchema = z.object({
  renameInstructions: z
    .string()
    .describe(
      'Instructions for how to rename files (leave empty for no renaming)'
    ),
  customFolderInstructions: z
    .string()
    .describe(
      'Instructions for custom folder organization (leave empty for defaults)'
    ),
});

export const chatTools = {
  getSearchQuery: {
    description:
      'Extract semantic search queries to find relevant notes based on content and meaning',
    parameters: z.object({
      query: z
        .string()
        .describe('The semantic search query to find relevant notes'),
    }),
  },
  searchByName: {
    description:
      'Search for files by name pattern or exact match, useful for finding specific notes or groups of notes',
    parameters: z.object({
      query: z
        .string()
        .describe(
          "The name pattern to search for (e.g., 'Untitled*', 'daily-*', or exact name)"
        ),
    }),
  },
  openFile: {
    description:
      'Open a specific file in Obsidian workspace. Use this when the user asks to open, view, or navigate to a file.',
    parameters: z.object({
      filePath: z
        .string()
        .describe("The full path of the file to open (e.g., 'folder/note.md')"),
    }),
  },
  getLastModifiedFiles: {
    description:
      'Retrieve recently modified files to track changes and activity in the vault',
    parameters: z.object({
      count: z
        .number()
        .describe('The number of last modified files to retrieve'),
    }),
  },
  addTextToDocument: {
    description:
      'Add new sections or content to notes with proper formatting and structure',
    parameters: z.object({
      content: z.string().describe('The formatted text content to add'),
      path: z
        .string()
        .describe(
          'Optional path to the document. If not provided, uses current document'
        ),
    }),
  },
  modifyDocumentText: {
    description:
      'Edit existing note content while maintaining consistency and structure. Can modify selected text or entire document.',
    parameters: z.object({
      content: z
        .string()
        .describe('The new formatted content to replace existing content'),
      path: z
        .string()
        .describe(
          'Optional path to the document. If not provided, uses current document'
        ),
      instructions: z
        .string()
        .describe(
          'Optional specific instructions for how to modify the content'
        ),
    }),
  },
  generateSettings: {
    description:
      'Create personalized vault organization settings based on user preferences and best practices',
    parameters: settingsSchema,
  },

  moveFiles: {
    description:
      'Organize files into appropriate folders based on content and structure',
    parameters: z.object({
      moves: z.array(
        z.object({
          sourcePath: z
            .string()
            .describe(
              "Source path (e.g., '/' for root, or specific folder path)"
            ),
          destinationPath: z.string().describe('Destination folder path'),
          pattern: z.object({
            namePattern: z
              .string()
              .describe(
                "File name pattern to match (e.g., 'untitled-*', 'daily-*', or empty for all files)"
              ),
            extension: z
              .string()
              .describe(
                'File extension to match (or empty for all extensions)'
              ),
          }),
        })
      ),
      message: z
        .string()
        .describe('Clear explanation of the proposed file organization'),
    }),
  },
  renameFiles: {
    description:
      'Rename files intelligently based on content and organizational patterns. Use this when the user asks to update, change, or rename a note title, filename, or file name. The note title in Obsidian is the filename (without .md extension). CRITICAL: When renaming the current file, infer the new name from context - if you just added an H1 heading (# Title) to the file, use that as the new filename. If the user says "rename the current note" without specifying a name, check the file content for the most prominent heading or title and use that. DO NOT ask the user for the new name - infer it from context and proceed automatically. CRITICAL FOR FILE PATH: When renaming the current/active file, you MUST extract the exact file path from the "Current File" section in the context. Look for "Path: <path>" in the Current File context and use that EXACT path. NEVER use placeholders like "current_note.md" - always use the actual path shown. IMPORTANT: The parameters structure is { files: [{ oldPath: string, newName: string }], message: string } - message is a top-level parameter, NOT inside the files array objects.',
    parameters: z.object({
      files: z
        .array(
          z.object({
            oldPath: z
              .string()
              .describe(
                'Current full path of the file (e.g., "folder/note.md"). CRITICAL: For the current/active file, you MUST extract the exact path from the "Current File" section in the context. Look for "Path: <path>" in the Current File context. NEVER use placeholders like "current_note.md" or "Untitled.md" - always use the actual path shown in the context. If the Current File context shows "Path: Untitled.md", use exactly "Untitled.md" (not "current_note.md").'
              ),
            newName: z
              .string()
              .describe(
                'New file name without .md extension (e.g., "My New Note Title"). Infer this from context: if you just added an H1 heading, use that text. If the file has a prominent heading, use that. Sanitize the name (remove special characters, keep it file-system safe). The .md extension will be added automatically. IMPORTANT: This object only contains oldPath and newName fields - do NOT include message here.'
              ),
          })
        )
        .describe(
          'Array of file objects to rename. Each object contains only oldPath and newName - no other fields.'
        ),
      message: z
        .string()
        .describe(
          'Clear explanation of the naming strategy and how the new name was inferred. This is a SEPARATE top-level parameter, NOT inside the files array objects.'
        ),
    }),
  },

  getFileMetadata: {
    description:
      'Extract comprehensive metadata from files including frontmatter, tags, links, headings, and creation/modification dates. Use with includeContent: true when merging notes intelligently or when full content is needed for content-aware operations.',
    parameters: z.object({
      filePaths: z
        .array(z.string())
        .describe('Paths of files to extract metadata from'),
      includeContent: z
        .boolean()
        .describe('Whether to include file content (default: false)'),
      includeFrontmatter: z
        .boolean()
        .describe('Include YAML frontmatter (default: true)'),
      includeTags: z.boolean().describe('Include all tags (default: true)'),
      includeLinks: z
        .boolean()
        .describe('Include internal links and embeds (default: true)'),
      includeBacklinks: z
        .boolean()
        .describe('Include backlinks from other notes (default: false)'),
    }),
  },


  addTags: {
    description:
      'Add tags to files either in frontmatter or inline in content. Useful for categorizing and organizing notes.',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Files to tag'),
      tags: z
        .array(z.string())
        .describe(
          "Tags to add (without # symbol, e.g., ['project', 'important'])"
        ),
      location: z
        .enum(['frontmatter', 'inline', 'both'])
        .describe(
          'Where to add tags: frontmatter (YAML tags array), inline (in content), or both'
        ),
      inlinePosition: z
        .enum(['top', 'bottom'])
        .describe("Position for inline tags (default: 'bottom')"),
      message: z.string().describe('Explanation of tagging strategy'),
    }),
  },


  getHeadings: {
    description:
      'Extract document heading structure (H1-H6). Useful for understanding note organization and navigation.',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Files to extract headings from'),
      minLevel: z
        .number()
        .min(1)
        .max(6)
        .describe('Minimum heading level (default: 1)'),
      maxLevel: z
        .number()
        .min(1)
        .max(6)
        .describe('Maximum heading level (default: 6)'),
    }),
  },

  getTaggedFiles: {
    description:
      'Find all files containing specific tags. Uses indexed metadata for fast, accurate tag-based search. Preferred over getSearchQuery for tag-based lookups.',
    parameters: z.object({
      tags: z
        .array(z.string())
        .describe('Tags to search for (without # symbol)'),
      matchAll: z
        .boolean()
        .describe(
          'If true, require ALL tags (AND). If false, match ANY tag (OR)'
        ),
      excludeTags: z
        .array(z.string())
        .describe('Tags to exclude from results (without # symbol). Use empty array [] if none'),
      folder: z
        .string()
        .describe('Folder path to limit search to. Use empty string "" for entire vault'),
    }),
  },



  createNewFiles: {
    description:
      'Create new notes/documents in the vault with content and optionally link them together. Use this to split content into multiple files, create referenced documents, or create a single merged note after combining content from multiple files.',
    parameters: z.object({
      files: z
        .array(
          z.object({
            fileName: z
              .string()
              .describe('Name for the new file (without .md extension)'),
            content: z.preprocess((val) => {
              // Preprocess: Unescape common escape sequences that may be double-escaped in JSON
              // This handles cases where the AI generates escaped sequences like \\n instead of \n
              if (typeof val !== 'string') return val;
              if (!val) return val;
              return val
                .replace(/\\n/g, '\n') // Unescape newlines
                .replace(/\\t/g, '\t') // Unescape tabs
                .replace(/\\r/g, '\r') // Unescape carriage returns
                .replace(/\\\\/g, '\\'); // Unescape double backslashes
            }, z.string().describe('The markdown content for the new file')),
            // REQUIRED (satisfies OpenAI strict tools)
            // Tell the model to pass "" for root
            folder: z
              .string()
              .describe(
                'Folder path relative to vault root. Use "" for root folder.'
              ),
          })
        )
        .describe('Array of files to create'),
      // REQUIRED (satisfies OpenAI strict tools)
      // Tell the model to pass true as default
      linkInCurrentFile: z
        .boolean()
        .describe(
          'Whether to add links to these new files in the current active file. Use true as default.'
        ),
      message: z
        .string()
        .describe('Clear explanation of what files are being created and why'),
    }),
  },

  deleteFiles: {
    description:
      'Delete files from the vault with user confirmation. Use when user explicitly asks to delete, remove, or trash files. Always confirm before deletion.',
    parameters: z.object({
      filePaths: z.array(z.string()).describe('Full paths of files to delete'),
      reason: z
        .string()
        .describe('Clear explanation of why these files should be deleted'),
      permanentDelete: z
        .boolean()
        .describe(
          'If true, permanently delete instead of moving to trash (default: false)'
        ),
    }),
  },

  mergeFiles: {
    description:
      'Combine multiple files into a single file by simple concatenation in order with a separator. Use for "put these in one file" or when the user does not ask for content-aware merging. For intelligent merge (dedupe, unified structure), use getFileMetadata with includeContent: true then createNewFiles as described in the system instructions.',
    parameters: z.object({
      sourceFiles: z
        .array(z.string())
        .describe('Paths of files to merge (in order)'),
      outputFileName: z
        .string()
        .describe('Name for the merged file (without .md extension)'),
      outputFolder: z
        .string()
        .describe('Folder for output file (default: root)'),
      separator: z
        .string()
        .describe(
          "Content separator between merged files (default: '\\n\\n---\\n\\n')"
        ),
      deleteSource: z
        .boolean()
        .describe('Delete source files after merge (default: false)'),
      message: z
        .string()
        .describe("Clear explanation of what's being merged and why"),
    }),
  },


  bulkFindReplace: {
    description:
      'Find and replace text across multiple files. Useful for renaming terms, fixing typos, updating links, or refactoring content.',
    parameters: z.object({
      filePaths: z
        .array(z.string())
        .describe('Files to perform find/replace on'),
      find: z
        .string()
        .describe('Text pattern to find (can be regex if useRegex is true)'),
      replace: z.string().describe('Replacement text'),
      useRegex: z
        .boolean()
        .describe('Treat find pattern as regex (default: false)'),
      caseSensitive: z
        .boolean()
        .describe('Case-sensitive search (default: true)'),
      message: z.string().describe('Clear explanation of what will be changed'),
    }),
  },

} as const;
