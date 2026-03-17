/**
 * Tests for SourceResolver — source resolution and EDITOR_DIRTY policy.
 *
 * Uses mock adapters to simulate vault/editor scenarios without Obsidian runtime.
 * Uses node:test (patch engine convention).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FileSystemAdapter, EditorBufferAdapter } from "../adapters";
import { SourceResolver } from "../source-resolver";

// ---------------------------------------------------------------------------
// Mock Adapters
// ---------------------------------------------------------------------------

function createMockFs(files: Record<string, string>): FileSystemAdapter {
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
      if (!(path in files)) return null;
      return { size: files[path].length, mtime: Date.now() };
    },
  };
}

function createMockEditor(
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SourceResolver", () => {
  describe("resolve", () => {
    it("returns vault content when file is not open in editor", async () => {
      const fs = createMockFs({ "test.md": "vault content" });
      const editor = createMockEditor({});
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");

      assert.equal(result.snapshot.content, "vault content");
      assert.equal(result.snapshot.origin, "vault");
      assert.equal(result.snapshot.writable, true);
      assert.equal(result.editorDirty, false);
    });

    it("returns vault origin when editor content matches vault", async () => {
      const content = "same content";
      const fs = createMockFs({ "test.md": content });
      const editor = createMockEditor({ "test.md": content });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");

      assert.equal(result.snapshot.content, content);
      assert.equal(result.snapshot.origin, "vault");
      assert.equal(result.snapshot.writable, true);
      assert.equal(result.editorDirty, false);
    });

    it("returns editor origin when editor content differs from vault", async () => {
      const fs = createMockFs({ "test.md": "vault version" });
      const editor = createMockEditor({ "test.md": "editor version (dirty)" });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");

      assert.equal(result.snapshot.content, "editor version (dirty)");
      assert.equal(result.snapshot.origin, "editor");
      assert.equal(result.snapshot.writable, false);
      assert.equal(result.editorDirty, true);
    });

    it("uses editor content for preview even when dirty", async () => {
      const fs = createMockFs({ "test.md": "old" });
      const editor = createMockEditor({ "test.md": "new unsaved changes" });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");

      // Preview uses editor content (what the user sees)
      assert.equal(result.snapshot.content, "new unsaved changes");
      assert.equal(result.snapshot.origin, "editor");
    });
  });

  describe("checkWriteSafety", () => {
    it("returns null when file is not open in editor", async () => {
      const fs = createMockFs({ "test.md": "content" });
      const editor = createMockEditor({});
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.checkWriteSafety("test.md");
      assert.equal(result, null);
    });

    it("returns null when editor matches vault", async () => {
      const content = "same content";
      const fs = createMockFs({ "test.md": content });
      const editor = createMockEditor({ "test.md": content });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.checkWriteSafety("test.md");
      assert.equal(result, null);
    });

    it("returns hash pair when editor is dirty", async () => {
      const fs = createMockFs({ "test.md": "vault content" });
      const editor = createMockEditor({ "test.md": "dirty editor content" });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.checkWriteSafety("test.md");

      assert.notEqual(result, null);
      assert.ok(result!.editorHash);
      assert.ok(result!.vaultHash);
      // Hashes should be 16 hex chars (first 16 of SHA-256)
      assert.match(result!.editorHash, /^[0-9a-f]{16}$/);
      assert.match(result!.vaultHash, /^[0-9a-f]{16}$/);
      // Different content should produce different hashes
      assert.notEqual(result!.editorHash, result!.vaultHash);
    });
  });

  describe("multi-pane scenarios", () => {
    it("handles file open in two split panes (same content)", async () => {
      // In Obsidian, split panes share the same editor state,
      // so getOpenContent returns the same content regardless
      const content = "shared content";
      const fs = createMockFs({ "test.md": content });
      const editor = createMockEditor({ "test.md": content });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");
      assert.equal(result.snapshot.origin, "vault");
      assert.equal(result.snapshot.writable, true);
    });

    it("handles file not open in any editor", async () => {
      const fs = createMockFs({ "test.md": "vault only" });
      const editor = createMockEditor({});
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");
      assert.equal(result.snapshot.origin, "vault");
      assert.equal(result.snapshot.writable, true);
      assert.equal(result.editorDirty, false);
    });

    it("handles file open but modified (dirty)", async () => {
      const fs = createMockFs({ "test.md": "original" });
      const editor = createMockEditor({ "test.md": "modified in editor" });
      const resolver = new SourceResolver(fs, editor);

      const result = await resolver.resolve("test.md");
      assert.equal(result.snapshot.origin, "editor");
      assert.equal(result.snapshot.writable, false);
      assert.equal(result.editorDirty, true);
    });
  });
});
