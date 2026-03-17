/**
 * Comprehensive tests for the EDITOR_DIRTY policy in SourceResolver.
 *
 * Covers all four multi-pane scenarios required by Task 1.1a:
 *   1. File open in two split panes (same content)
 *   2. File open in editor but modified (dirty)
 *   3. File not open in any editor
 *   4. File open in a popout window
 *
 * Also validates the preview/apply contract, hash consistency, and edge cases.
 *
 * Uses node:test (patch engine convention).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FileSystemAdapter, EditorBufferAdapter } from "../adapters";
import { SourceResolver } from "../source-resolver";

// ---------------------------------------------------------------------------
// Mock Adapters
// ---------------------------------------------------------------------------

/** Create a mock FileSystemAdapter backed by a simple record. */
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

/**
 * Create a mock EditorBufferAdapter.
 *
 * `openFiles` maps vault-relative paths to their editor buffer content.
 * Passing `null` for a path is NOT the same as omitting it — `null` means
 * the file isn't open.  An entry with a string value means the file is open
 * in at least one editor pane (split, tab, or popout).
 */
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
// Multi-Pane Scenarios (Task 1.1a requirement)
// ---------------------------------------------------------------------------

describe("EDITOR_DIRTY policy — multi-pane scenarios", () => {
  it("1. file open in two split panes (same content)", async () => {
    // Obsidian shares editor state across split panes.  Both panes
    // reference the same underlying CodeMirror editor, so
    // `getOpenContent()` returns identical content regardless of
    // how many leaves display the file.
    const shared = "# Split pane content\nSame in both panes.";
    const fs = createMockFs({ "notes/split.md": shared });
    // Mock adapter returns the shared content — simulating two leaves
    // pointing at the same editor state.
    const editor = createMockEditor({ "notes/split.md": shared });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("notes/split.md");

    assert.equal(result.snapshot.origin, "vault");
    assert.equal(result.snapshot.writable, true);
    assert.equal(result.snapshot.content, shared);
    assert.equal(result.editorDirty, false);
  });

  it("2. file open in editor but modified (dirty)", async () => {
    const vaultContent = "# Original\nSaved version.";
    const editorContent = "# Original\nUnsaved edits here.";
    const fs = createMockFs({ "notes/dirty.md": vaultContent });
    const editor = createMockEditor({ "notes/dirty.md": editorContent });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("notes/dirty.md");

    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.snapshot.writable, false);
    assert.equal(result.snapshot.content, editorContent);
    assert.equal(result.editorDirty, true);

    // Apply-time: checkWriteSafety must reject with hash pair
    const safety = await resolver.checkWriteSafety("notes/dirty.md");
    assert.notEqual(safety, null);
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
  });

  it("3. file not open in any editor", async () => {
    const vaultContent = "# Untouched\nNot open anywhere.";
    const fs = createMockFs({ "notes/closed.md": vaultContent });
    const editor = createMockEditor({});
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("notes/closed.md");

    assert.equal(result.snapshot.origin, "vault");
    assert.equal(result.snapshot.writable, true);
    assert.equal(result.snapshot.content, vaultContent);
    assert.equal(result.editorDirty, false);
  });

  it("4. file open in a popout window", async () => {
    // Obsidian popout windows create additional WorkspaceWindow instances.
    // `getLeavesOfType('markdown')` traverses all windows (main + popouts),
    // so the EditorBufferAdapter finds popout editors the same way it finds
    // split-pane editors.  The mock adapter simply returns the content
    // for the path — the adapter implementation is responsible for
    // scanning all leaves, including popout windows.
    const popoutContent = "# Popout\nEdited in a popout window.";
    const vaultContent = "# Popout\nEdited in a popout window.";
    const fs = createMockFs({ "notes/popout.md": vaultContent });
    const editor = createMockEditor({ "notes/popout.md": popoutContent });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("notes/popout.md");

    // Popout content matches vault — should be vault origin, writable
    assert.equal(result.snapshot.origin, "vault");
    assert.equal(result.snapshot.writable, true);
    assert.equal(result.snapshot.content, popoutContent);
    assert.equal(result.editorDirty, false);
  });

  it("4b. file open in popout window with dirty edits", async () => {
    // Popout window where user has unsaved changes
    const vaultContent = "# Popout\nOriginal saved content.";
    const popoutContent = "# Popout\nModified in the popout window!";
    const fs = createMockFs({ "notes/popout-dirty.md": vaultContent });
    const editor = createMockEditor({
      "notes/popout-dirty.md": popoutContent,
    });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("notes/popout-dirty.md");

    // Dirty popout behaves identically to a dirty main-window editor
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.snapshot.writable, false);
    assert.equal(result.snapshot.content, popoutContent);
    assert.equal(result.editorDirty, true);
  });
});

// ---------------------------------------------------------------------------
// Preview / Apply Contract
// ---------------------------------------------------------------------------

describe("EDITOR_DIRTY policy — preview/apply contract", () => {
  it("preview-time dirty: uses editor bytes, origin 'editor', editorDirty true", async () => {
    const fs = createMockFs({ "doc.md": "vault bytes" });
    const editor = createMockEditor({ "doc.md": "editor bytes (unsaved)" });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("doc.md");

    assert.equal(result.snapshot.content, "editor bytes (unsaved)");
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.writable, false);
  });

  it("apply-time dirty: checkWriteSafety rejects with both hashes (16 hex chars each)", async () => {
    const fs = createMockFs({ "doc.md": "vault bytes" });
    const editor = createMockEditor({ "doc.md": "editor bytes (unsaved)" });
    const resolver = new SourceResolver(fs, editor);

    const safety = await resolver.checkWriteSafety("doc.md");

    assert.notEqual(safety, null);
    // Both hashes must be exactly 16 lowercase hex characters
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
    // Hashes must differ (content differs)
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("apply-time clean: checkWriteSafety returns null", async () => {
    const content = "identical content";
    const fs = createMockFs({ "doc.md": content });
    const editor = createMockEditor({ "doc.md": content });
    const resolver = new SourceResolver(fs, editor);

    const safety = await resolver.checkWriteSafety("doc.md");
    assert.equal(safety, null);
  });

  it("editor matches vault at preview AND apply: fully writable", async () => {
    const content = "# Synced\nEditor and vault are identical.";
    const fs = createMockFs({ "doc.md": content });
    const editor = createMockEditor({ "doc.md": content });
    const resolver = new SourceResolver(fs, editor);

    // Preview
    const result = await resolver.resolve("doc.md");
    assert.equal(result.snapshot.origin, "vault");
    assert.equal(result.snapshot.writable, true);
    assert.equal(result.editorDirty, false);

    // Apply
    const safety = await resolver.checkWriteSafety("doc.md");
    assert.equal(safety, null);
  });

  it("file not open: checkWriteSafety returns null (vault is source of truth)", async () => {
    const fs = createMockFs({ "doc.md": "vault only" });
    const editor = createMockEditor({});
    const resolver = new SourceResolver(fs, editor);

    const safety = await resolver.checkWriteSafety("doc.md");
    assert.equal(safety, null);
  });
});

// ---------------------------------------------------------------------------
// Hash Consistency
// ---------------------------------------------------------------------------

describe("EDITOR_DIRTY policy — hash consistency", () => {
  it("same content always produces the same hash", async () => {
    const content = "deterministic hash input";

    // Create two independent resolvers with the same content divergence
    const fs1 = createMockFs({ "a.md": "vault" });
    const ed1 = createMockEditor({ "a.md": content });
    const r1 = new SourceResolver(fs1, ed1);

    const fs2 = createMockFs({ "a.md": "vault" });
    const ed2 = createMockEditor({ "a.md": content });
    const r2 = new SourceResolver(fs2, ed2);

    const s1 = await r1.checkWriteSafety("a.md");
    const s2 = await r2.checkWriteSafety("a.md");

    assert.notEqual(s1, null);
    assert.notEqual(s2, null);
    // Editor hashes must be identical (same editor content)
    assert.equal(s1!.editorHash, s2!.editorHash);
    // Vault hashes must be identical (same vault content)
    assert.equal(s1!.vaultHash, s2!.vaultHash);
  });

  it("different content produces different hashes", async () => {
    const fs = createMockFs({ "a.md": "content A" });
    const editor = createMockEditor({ "a.md": "content B" });
    const resolver = new SourceResolver(fs, editor);

    const safety = await resolver.checkWriteSafety("a.md");

    assert.notEqual(safety, null);
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("hashes are exactly 16 hex chars", async () => {
    const fs = createMockFs({ "a.md": "x" });
    const editor = createMockEditor({ "a.md": "y" });
    const resolver = new SourceResolver(fs, editor);

    const safety = await resolver.checkWriteSafety("a.md");

    assert.notEqual(safety, null);
    assert.equal(safety!.editorHash.length, 16);
    assert.equal(safety!.vaultHash.length, 16);
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe("EDITOR_DIRTY policy — edge cases", () => {
  it("empty file in vault, non-empty in editor (dirty)", async () => {
    const fs = createMockFs({ "empty.md": "" });
    const editor = createMockEditor({ "empty.md": "user typed something" });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("empty.md");
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.snapshot.writable, false);
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.content, "user typed something");

    const safety = await resolver.checkWriteSafety("empty.md");
    assert.notEqual(safety, null);
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("non-empty file in vault, empty in editor (dirty)", async () => {
    const fs = createMockFs({ "cleared.md": "had content before" });
    const editor = createMockEditor({ "cleared.md": "" });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("cleared.md");
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.snapshot.writable, false);
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.content, "");

    const safety = await resolver.checkWriteSafety("cleared.md");
    assert.notEqual(safety, null);
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("multi-byte UTF-8 content — hash works correctly", async () => {
    const vaultContent = "日本語テスト — emoji: 🎉🚀 — accents: café résumé";
    const editorContent = "日本語テスト — emoji: 🎉🚀 — accents: café résumé (edited)";
    const fs = createMockFs({ "utf8.md": vaultContent });
    const editor = createMockEditor({ "utf8.md": editorContent });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("utf8.md");
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.content, editorContent);

    const safety = await resolver.checkWriteSafety("utf8.md");
    assert.notEqual(safety, null);
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("multi-byte UTF-8 content — identical content produces same hash", async () => {
    const content = "Ünïcödé: 漢字 кириллица العربية 🌍";
    const fs = createMockFs({ "utf8-same.md": content });
    const editor = createMockEditor({ "utf8-same.md": content });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("utf8-same.md");
    assert.equal(result.snapshot.origin, "vault");
    assert.equal(result.snapshot.writable, true);
    assert.equal(result.editorDirty, false);

    const safety = await resolver.checkWriteSafety("utf8-same.md");
    assert.equal(safety, null);
  });

  it("very large content diff — still produces valid hashes", async () => {
    // ~100KB of content to stress the hashing path
    const vaultContent = "A".repeat(100_000);
    const editorContent = "B".repeat(100_000);
    const fs = createMockFs({ "large.md": vaultContent });
    const editor = createMockEditor({ "large.md": editorContent });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("large.md");
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.writable, false);

    const safety = await resolver.checkWriteSafety("large.md");
    assert.notEqual(safety, null);
    assert.match(safety!.editorHash, /^[0-9a-f]{16}$/);
    assert.match(safety!.vaultHash, /^[0-9a-f]{16}$/);
    assert.notEqual(safety!.editorHash, safety!.vaultHash);
  });

  it("whitespace-only difference is detected as dirty", async () => {
    const vaultContent = "line one\nline two";
    const editorContent = "line one\nline two\n"; // trailing newline added
    const fs = createMockFs({ "ws.md": vaultContent });
    const editor = createMockEditor({ "ws.md": editorContent });
    const resolver = new SourceResolver(fs, editor);

    const result = await resolver.resolve("ws.md");
    assert.equal(result.editorDirty, true);
    assert.equal(result.snapshot.origin, "editor");
    assert.equal(result.snapshot.writable, false);
  });
});
