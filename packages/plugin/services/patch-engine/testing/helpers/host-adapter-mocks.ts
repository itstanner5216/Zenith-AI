import type { EditorBufferAdapter, FileSystemAdapter } from "../../adapters";

export function createMockFileSystemAdapter(
  files: Record<string, string>
): FileSystemAdapter {
  return {
    async read(path: string): Promise<string> {
      if (!(path in files)) {
        throw new Error(`File not found: ${path}`);
      }
      return files[path];
    },
    async write(path: string, content: string): Promise<void> {
      files[path] = content;
    },
    exists(path: string): boolean {
      return path in files;
    },
    stat(path: string): { size: number; mtime: number } | null {
      const content = files[path];
      if (content === undefined) {
        return null;
      }
      return { size: Buffer.byteLength(content, "utf8"), mtime: Date.now() };
    },
  };
}

export function createMockEditorBufferAdapter(
  openFiles: Record<string, string>
): EditorBufferAdapter {
  return {
    getOpenContent(path: string): string | null {
      return openFiles[path] ?? null;
    },
    isOpen(path: string): boolean {
      return path in openFiles;
    },
  };
}
