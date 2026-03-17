/**
 * Source resolution for the Zenith Patch Engine.
 *
 * Determines whether to read from the vault or an open editor buffer,
 * and enforces the EDITOR_DIRTY safety policy at both preview and apply time.
 *
 * Resolution rules (from Task 1.1 + 1.1a):
 *
 *   1. If the file is open in an editor, read from the editor buffer
 *      (this is what the user sees).
 *   2. If the file is not open, read from the vault.
 *   3. If editor content equals vault bytes, origin is "vault" and writable is true.
 *   4. If editor content differs from vault bytes, origin is "editor",
 *      the snapshot is usable for preview, but writable is false.
 *   5. At apply time, if editor bytes differ from vault bytes, reject
 *      with EDITOR_DIRTY and return both hashes.
 */

import type { FileSystemAdapter, EditorBufferAdapter } from "./adapters";
import type { SourceSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Lightweight content hash (SHA-256, first 16 hex chars)
// ---------------------------------------------------------------------------

/**
 * Compute the canonical content hash for EDITOR_DIRTY comparison.
 *
 * Uses the Web Crypto API (available in both Node.js ≥ 15 and Electron).
 * Returns the first 16 hex characters of the SHA-256 digest, matching
 * the `sourceFileHash16` convention used throughout the engine.
 */
async function computeContentHash16(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    hex += hashArray[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Resolve Result
// ---------------------------------------------------------------------------

/** Detailed result from source resolution, including dirty-editor metadata. */
export interface ResolveResult {
  /** The resolved source snapshot. */
  snapshot: SourceSnapshot;
  /** True if the editor has unsaved changes relative to the vault. */
  editorDirty: boolean;
}

// ---------------------------------------------------------------------------
// Source Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the content source for a file by consulting the editor buffer
 * first, then falling back to the vault.
 *
 * This is the single point of truth for "what content is the engine working with?"
 * Every parsed document and every apply-time check flows through here.
 */
export class SourceResolver {
  private readonly fs: FileSystemAdapter;
  private readonly editor: EditorBufferAdapter;

  constructor(fs: FileSystemAdapter, editor: EditorBufferAdapter) {
    this.fs = fs;
    this.editor = editor;
  }

  /**
   * Resolve the content source for a vault-relative path.
   *
   * Preview flow:
   *   - If the file is open in an editor, use editor content.
   *   - Mark as writable only if editor content matches vault content.
   *   - If editor differs from vault, return origin "editor" with `editorDirty: true`.
   *
   * @param path - Vault-relative file path.
   * @returns The resolved source snapshot and dirty-editor metadata.
   * @throws If the file does not exist in the vault and is not open in an editor.
   */
  async resolve(path: string): Promise<ResolveResult> {
    const editorContent = this.editor.getOpenContent(path);

    // Case 1: File is not open in any editor — read from vault
    if (editorContent === null) {
      const vaultContent = await this.fs.read(path);
      return {
        snapshot: {
          path,
          content: vaultContent,
          origin: "vault",
          writable: true,
        },
        editorDirty: false,
      };
    }

    // Case 2: File is open in an editor — compare with vault
    const vaultContent = await this.fs.read(path);

    if (editorContent === vaultContent) {
      // Editor matches vault — use vault origin, fully writable
      return {
        snapshot: {
          path,
          content: editorContent,
          origin: "vault",
          writable: true,
        },
        editorDirty: false,
      };
    }

    // Case 3: Editor differs from vault (dirty) — use editor content
    // for preview but mark as not writable
    return {
      snapshot: {
        path,
        content: editorContent,
        origin: "editor",
        writable: false,
      },
      editorDirty: true,
    };
  }

  /**
   * Check whether a file can be safely written at apply time.
   *
   * At apply time, if editor bytes differ from vault bytes, this returns
   * an EDITOR_DIRTY rejection with both hashes. The caller should produce
   * an EDITOR_DIRTY diagnostic from the returned hash pair.
   *
   * @param path - Vault-relative file path.
   * @returns `null` if writing is safe, or an object with both hashes if dirty.
   */
  async checkWriteSafety(
    path: string
  ): Promise<{ editorHash: string; vaultHash: string } | null> {
    const editorContent = this.editor.getOpenContent(path);

    // Not open in editor — vault is the source of truth, safe to write
    if (editorContent === null) {
      return null;
    }

    const vaultContent = await this.fs.read(path);

    // Editor matches vault — safe to write
    if (editorContent === vaultContent) {
      return null;
    }

    // Editor is dirty — compute hashes for the EDITOR_DIRTY diagnostic.
    // Uses the engine's canonical hash: first 16 hex chars of SHA-256.
    const editorHash = await computeContentHash16(editorContent);
    const vaultHash = await computeContentHash16(vaultContent);

    return { editorHash, vaultHash };
  }
}
