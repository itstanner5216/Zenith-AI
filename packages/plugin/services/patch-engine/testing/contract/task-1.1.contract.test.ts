/**
 * CONTRACT TESTS — Task 1.1: Define host adapters and source resolution
 *
 * These tests prove the guarantees stated in PLAN1.md §Task 1.1 & §Task 1.1a.
 * They test the PUBLIC behaviour of SourceResolver against mock host adapters.
 * They will FAIL until the implementation honours every guarantee listed below.
 *
 * Guarantees under test:
 *
 *   [G1] If no open editor exists, read vault content and return origin "vault",
 *        writable true.
 *
 *   [G2] If editor content exists and equals vault bytes, return origin "vault"
 *        (not "editor") — the plan says the file is treated as if it came from
 *        the vault when the two sources are identical.
 *
 *   [G3] If editor content exists and DIFFERS from vault bytes, return
 *        origin "editor", writable false.  editorDirty must be true.
 *
 *   [G4] At apply time (checkWriteSafety), if editor bytes differ from vault
 *        bytes, reject by returning a non-null object with exactly 16-char
 *        lowercase-hex editorHash and vaultHash.  The two hashes must differ.
 *
 *   [G5] SourceSnapshot must expose exactly the four fields the plan defines:
 *        path, content, origin ("vault" | "editor"), and writable (boolean).
 *        No field may be absent on any resolution path.
 *
 * Runner: node:test
 * Imports: only the engine's public adapters + SourceResolver (public module).
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

/* ------------------------------------------------------------------ */
/*  Public interface imports — ONLY these are allowed in contract tests */
/* ------------------------------------------------------------------ */

import type { FileSystemAdapter, EditorBufferAdapter } from "../../adapters";
import { SourceResolver } from "../../source-resolver";

/* ------------------------------------------------------------------ */
/*  Host adapter mocks (permitted — these represent the host boundary) */
/* ------------------------------------------------------------------ */

function createMockFs(files: Record<string, string>): FileSystemAdapter {
  return {
    async read(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`File not found: ${path}`);
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
      return path in openFiles ? openFiles[path] : null;
    },
    isOpen(path: string): boolean {
      return path in openFiles;
    },
  };
}

/* ================================================================== */

describe("[TASK 1.1] — Define host adapters and source resolution", () => {
  // ----------------------------------------------------------------
  // G1 — no open editor → vault origin, writable true
  // ----------------------------------------------------------------
  describe("success cases", () => {
    it("[TASK 1.1] no open editor: origin is vault and snapshot is writable", async () => {
      const VAULT_CONTENT = "# Heading\n\nSome paragraph content.\n";
      const fs = createMockFs({ "notes/readme.md": VAULT_CONTENT });
      const editor = createMockEditor({}); // nothing open

      const resolver = new SourceResolver(fs, editor);
      const { snapshot, editorDirty } = await resolver.resolve("notes/readme.md");

      // G1: vault read path → origin must be "vault"
      assert.equal(
        snapshot.origin,
        "vault",
        "When no editor is open, origin must be 'vault'"
      );
      // G1: writable must be true when reading from vault with no editor open
      assert.equal(
        snapshot.writable,
        true,
        "Snapshot must be writable when no editor is open"
      );
      // G1: content must match vault
      assert.equal(
        snapshot.content,
        VAULT_CONTENT,
        "Snapshot content must equal vault content"
      );
      // G1: no dirty state
      assert.equal(
        editorDirty,
        false,
        "editorDirty must be false when no editor is open"
      );
    });

    // ----------------------------------------------------------------
    // G2 — editor open but matches vault → origin "vault", writable true
    // ----------------------------------------------------------------
    it("[TASK 1.1] editor content equals vault bytes: origin is vault (not editor)", async () => {
      const CONTENT = "# Synced\n\nEditor and vault are identical.\n";
      const fs = createMockFs({ "notes/synced.md": CONTENT });
      const editor = createMockEditor({ "notes/synced.md": CONTENT });

      const resolver = new SourceResolver(fs, editor);
      const { snapshot, editorDirty } = await resolver.resolve("notes/synced.md");

      // G2: matching editor + vault → report as "vault" origin per plan rule
      assert.equal(
        snapshot.origin,
        "vault",
        "When editor bytes equal vault bytes, origin must be 'vault'"
      );
      assert.equal(
        snapshot.writable,
        true,
        "Snapshot must be writable when editor matches vault"
      );
      assert.equal(
        editorDirty,
        false,
        "editorDirty must be false when editor matches vault"
      );
    });
  });

  // ----------------------------------------------------------------
  // G3 — editor differs from vault → origin "editor", writable false, editorDirty true
  // ----------------------------------------------------------------
  describe("rejection cases", () => {
    it("[TASK 1.1] editor differs from vault: origin is editor, writable false, editorDirty true", async () => {
      const VAULT = "# Original\n\nSaved to disk.";
      const EDITOR = "# Original\n\nUnsaved edits in the buffer.";

      const fs = createMockFs({ "notes/dirty.md": VAULT });
      const editor = createMockEditor({ "notes/dirty.md": EDITOR });

      const resolver = new SourceResolver(fs, editor);
      const { snapshot, editorDirty } = await resolver.resolve("notes/dirty.md");

      // G3: dirty editor → origin must be "editor"
      assert.equal(
        snapshot.origin,
        "editor",
        "When editor differs from vault, origin must be 'editor'"
      );
      // G3: snapshot must not be directly writable
      assert.equal(
        snapshot.writable,
        false,
        "Snapshot must not be writable when editor is dirty"
      );
      // G3: editorDirty flag must be set
      assert.equal(
        editorDirty,
        true,
        "editorDirty must be true when editor differs from vault"
      );
      // G3: content must be the editor buffer, not the vault
      assert.equal(
        snapshot.content,
        EDITOR,
        "Snapshot content must reflect the editor buffer, not vault"
      );
    });

    // ----------------------------------------------------------------
    // G4 — apply-time dirty: checkWriteSafety returns non-null with valid hashes
    // ----------------------------------------------------------------
    it("[TASK 1.1] apply-time: checkWriteSafety returns editorHash and vaultHash when dirty", async () => {
      const VAULT = "vault content for hashing";
      const EDITOR = "editor content — different from vault";

      const fs = createMockFs({ "notes/apply.md": VAULT });
      const editor = createMockEditor({ "notes/apply.md": EDITOR });

      const resolver = new SourceResolver(fs, editor);
      const result = await resolver.checkWriteSafety("notes/apply.md");

      // G4: must reject (return non-null) when dirty
      assert.notEqual(
        result,
        null,
        "checkWriteSafety must return non-null when editor differs from vault"
      );

      // G4: each hash must be exactly 16 lowercase hex characters
      assert.match(
        result!.editorHash,
        /^[0-9a-f]{16}$/,
        "editorHash must be 16 lowercase hex characters"
      );
      assert.match(
        result!.vaultHash,
        /^[0-9a-f]{16}$/,
        "vaultHash must be 16 lowercase hex characters"
      );

      // G4: the two hashes must differ (different content → different hash)
      assert.notEqual(
        result!.editorHash,
        result!.vaultHash,
        "editorHash and vaultHash must differ when content differs"
      );
    });
  });

  // ----------------------------------------------------------------
  // G5 — SourceSnapshot always contains all four plan-defined fields
  // ----------------------------------------------------------------
  describe("edge cases", () => {
    it("[TASK 1.1] SourceSnapshot always exposes path, content, origin, and writable", async () => {
      // Test all three resolution paths to confirm every field is present.

      const paths = [
        // Path 1: no editor open (vault path)
        {
          label: "vault-only",
          fs: createMockFs({ "a.md": "vault" }),
          editor: createMockEditor({}),
          path: "a.md",
        },
        // Path 2: editor matches vault
        {
          label: "editor-matches",
          fs: createMockFs({ "b.md": "same" }),
          editor: createMockEditor({ "b.md": "same" }),
          path: "b.md",
        },
        // Path 3: editor differs from vault
        {
          label: "editor-dirty",
          fs: createMockFs({ "c.md": "vault" }),
          editor: createMockEditor({ "c.md": "editor" }),
          path: "c.md",
        },
      ];

      for (const scenario of paths) {
        const resolver = new SourceResolver(scenario.fs, scenario.editor);
        const { snapshot } = await resolver.resolve(scenario.path);

        // G5: every field must be present (not undefined / null)
        assert.ok(
          typeof snapshot.path === "string",
          `[${scenario.label}] snapshot.path must be a string`
        );
        assert.ok(
          typeof snapshot.content === "string",
          `[${scenario.label}] snapshot.content must be a string`
        );
        assert.ok(
          snapshot.origin === "vault" || snapshot.origin === "editor",
          `[${scenario.label}] snapshot.origin must be 'vault' or 'editor'`
        );
        assert.ok(
          typeof snapshot.writable === "boolean",
          `[${scenario.label}] snapshot.writable must be a boolean`
        );

        // G5: path must round-trip correctly
        assert.equal(
          snapshot.path,
          scenario.path,
          `[${scenario.label}] snapshot.path must match the requested path`
        );
      }
    });
  });
});
