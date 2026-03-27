/**
 * CONTRACT TESTS — Task 2.3: Build DocumentParser
 *
 * PLAN1.md §Task 2.3 makes several hard behavioural guarantees about
 * DocumentParser. These tests prove the contract stated in the plan
 * by calling the public DocumentParser API against controlled inputs.
 * They will FAIL until the implementation fulfils every stated contract.
 *
 * Guarantees under test:
 *
 *   [G19] ParsedDocument must expose all six fields defined in the plan snippet:
 *         path, sourceFileHash16, bytes, root, outline, baselineErrorCount, origin.
 *         Plan snippet: ParsedDocument interface with exactly these fields.
 *
 *   [G20] An oversized code block (raw bytes > 32768, the maxCodeBlockBytes
 *         constant) must be retained as a code_block node (not promoted) and
 *         symbol extraction must be skipped. Plan quote: "Oversized threshold:
 *         maxCodeBlockBytes = 32768 (32 KB). Blocks exceeding this skip symbol
 *         extraction regardless of language."
 *
 *   [G21] When symbol extraction is skipped for any reason, the outline entry
 *         for that block must carry symbolsSkipped: true and a non-empty
 *         skipReason. Plan quote: "Outline entry includes symbolsSkipped: true
 *         and skipReason so the model knows not to attempt symbol-level edits."
 *
 *   [G22] A SYMBOL_TARGET_UNAVAILABLE diagnostic for an unsupported language
 *         block must include a non-empty blockHash, a non-empty blockExcerpt
 *         (first 160 bytes), and a retryHint that contains the blockHash.
 *         Plan quote: "Include blockHash so the model can immediately use it in
 *         the next request without re-reading the outline."
 *
 *   [G23] DocumentParser handles an empty file: must not throw, must produce a
 *         ParsedDocument with an empty outline array.
 *         Plan quote: "Handle: empty files."
 *
 * Runner: node:test
 * Imports: only DocumentParser (public module) and host adapter mocks.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

/* ------------------------------------------------------------------ */
/*  Public API imports only                                             */
/* ------------------------------------------------------------------ */

import { DocumentParser } from "../../parsers/document-parser";
import type { ParsedDocument } from "../../types";
import type { FileSystemAdapter } from "../../adapters";
import { MAX_CODE_BLOCK_BYTES } from "../../types";

/* ------------------------------------------------------------------ */
/*  Host adapter mocks (permitted — host boundary only)                */
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

/* ================================================================== */

describe("[TASK 2.3] — Build DocumentParser", () => {
  // ----------------------------------------------------------------
  // G19 — ParsedDocument exposes all plan-required fields
  // ----------------------------------------------------------------
  describe("success cases", () => {
    it("[TASK 2.3] ParsedDocument exposes path, sourceFileHash16, bytes, root, outline, baselineErrorCount, origin", async () => {
      const CONTENT = "# Hello\n\nA paragraph.\n";
      const fs = createMockFs({ "notes/simple.md": CONTENT });

      const parser = new DocumentParser();
      const doc: ParsedDocument = await parser.parse("notes/simple.md", CONTENT, "vault");

      // G19: path
      assert.ok(
        typeof doc.path === "string" && doc.path.length > 0,
        "ParsedDocument.path must be a non-empty string"
      );
      // G19: sourceFileHash16 — exactly 16 lowercase hex chars
      assert.match(
        doc.sourceFileHash16,
        /^[0-9a-f]{16}$/,
        "ParsedDocument.sourceFileHash16 must be 16 lowercase hex characters"
      );
      // G19: bytes — must be a ByteText-like object with toBytes/toString
      assert.ok(
        doc.bytes !== null && doc.bytes !== undefined,
        "ParsedDocument.bytes must not be null or undefined"
      );
      assert.ok(
        typeof doc.bytes.toBytes === "function",
        "ParsedDocument.bytes must expose toBytes()"
      );
      assert.ok(
        typeof doc.bytes.toString === "function",
        "ParsedDocument.bytes must expose toString()"
      );
      // G19: root node must be present
      assert.ok(
        doc.root !== null && doc.root !== undefined,
        "ParsedDocument.root must not be null or undefined"
      );
      assert.ok(
        typeof doc.root.type === "string",
        "ParsedDocument.root.type must be a string"
      );
      // G19: outline must be an array
      assert.ok(
        Array.isArray(doc.outline),
        "ParsedDocument.outline must be an array"
      );
      // G19: baselineErrorCount must be a number >= 0
      assert.ok(
        typeof doc.baselineErrorCount === "number" && doc.baselineErrorCount >= 0,
        "ParsedDocument.baselineErrorCount must be a non-negative number"
      );
      // G19: origin must be "vault" or "editor"
      assert.ok(
        doc.origin === "vault" || doc.origin === "editor",
        "ParsedDocument.origin must be 'vault' or 'editor'"
      );
    });

    // ----------------------------------------------------------------
    // G23 — empty file is handled gracefully
    // ----------------------------------------------------------------
    it("[TASK 2.3] empty file produces a ParsedDocument with an empty outline array", async () => {
      const parser = new DocumentParser();

      // Must not throw
      let doc: ParsedDocument;
      await assert.doesNotReject(async () => {
        doc = await parser.parse("empty.md", "", "vault");
      }, "DocumentParser must not throw on an empty file");

      // Outline must be an empty array
      assert.ok(
        Array.isArray(doc!.outline),
        "outline must be an array for an empty file"
      );
      assert.equal(
        doc!.outline.length,
        0,
        "outline must be empty for an empty file"
      );

      // sourceFileHash16 must still be valid
      assert.match(
        doc!.sourceFileHash16,
        /^[0-9a-f]{16}$/,
        "sourceFileHash16 must still be generated for an empty file"
      );
    });
  });

  // ----------------------------------------------------------------
  // G20 + G21 — oversized code block: stays code_block, symbolsSkipped + skipReason
  // ----------------------------------------------------------------
  describe("rejection cases", () => {
    it("[TASK 2.3] oversized code block (>32 KB) is retained as code_block with symbolsSkipped:true", async () => {
      /*
       * The plan says the threshold is MAX_CODE_BLOCK_BYTES = 32768.
       * We create a TypeScript code block that exceeds this threshold to
       * prove the parser skips symbol extraction and marks it correctly.
       */
      const BIG_CODE = "const x = " + '"' + "a".repeat(MAX_CODE_BLOCK_BYTES + 100) + '"' + ";";
      const markdown = [
        "# Document",
        "",
        "```typescript",
        BIG_CODE,
        "```",
        "",
      ].join("\n");

      const parser = new DocumentParser();
      const doc: ParsedDocument = await parser.parse("oversize.md", markdown, "vault");

      // G20: must not throw, must produce a document
      assert.ok(doc, "Parser must produce a document for an oversized code block");

      // Find the outline entry for the code block
      const codeEntry = doc.outline.find(
        (e) => e.type === "code_block"
      );
      assert.ok(
        codeEntry !== undefined,
        "An oversized code block must still appear as a code_block outline entry"
      );

      // G21: symbolsSkipped must be true
      assert.equal(
        codeEntry!.symbolsSkipped,
        true,
        "Oversized code block outline entry must have symbolsSkipped: true"
      );

      // G21: skipReason must be "block_oversized"
      assert.equal(
        codeEntry!.skipReason,
        "block_oversized",
        "Oversized code block outline entry must have skipReason: 'block_oversized'"
      );

      // G20: the structural node type must stay "code_block", not promoted
      const rootChildren = flattenNodes(doc.root);
      const codeNode = rootChildren.find((n) => n.type === "code_block");
      assert.ok(
        codeNode !== undefined,
        "Oversized block must be present as a code_block structural node"
      );
      // Must NOT have code_symbol children
      const hasSymbolChildren = codeNode!.children?.some(
        (c) => c.type === "code_symbol"
      ) ?? false;
      assert.equal(
        hasSymbolChildren,
        false,
        "An oversized code_block must NOT have code_symbol children"
      );
    });
  });

  // ----------------------------------------------------------------
  // G22 — SYMBOL_TARGET_UNAVAILABLE for unsupported language
  // ----------------------------------------------------------------
  describe("edge cases", () => {
    it("[TASK 2.3] SYMBOL_TARGET_UNAVAILABLE for unsupported-language block includes blockHash, blockExcerpt, retryHint", async () => {
      /*
       * "ruby" is not a supported grammar. The plan says symbol targeting
       * against this block must return SYMBOL_TARGET_UNAVAILABLE with
       * blockHash (so the model can immediately retry by hash), blockExcerpt
       * (first 160 bytes), and retryHint (complete instruction with the hash).
       */
      const rubyCode = [
        "def greet(name)",
        "  puts \"Hello, #{name}!\"",
        "end",
      ].join("\n");

      const markdown = [
        "# Code Section",
        "",
        "```ruby",
        rubyCode,
        "```",
        "",
      ].join("\n");

      const parser = new DocumentParser();
      const doc: ParsedDocument = await parser.parse("ruby-file.md", markdown, "vault");

      // The code block outline entry must have symbolsSkipped: true
      const codeEntry = doc.outline.find((e) => e.type === "code_block");
      assert.ok(codeEntry, "ruby code block must appear in outline");
      assert.equal(
        codeEntry!.symbolsSkipped,
        true,
        "Unsupported-language block must have symbolsSkipped: true"
      );
      assert.equal(
        codeEntry!.skipReason,
        "language_unsupported",
        "Unsupported-language block must have skipReason: 'language_unsupported'"
      );

      // Now assert the SYMBOL_TARGET_UNAVAILABLE diagnostic fields by requesting
      // symbol-level targeting via the parser's diagnostic API.
      const diagnostic = await parser.resolveSymbolTarget(
        doc,
        { symbol: "greet" }
      );

      assert.ok(
        diagnostic !== null && diagnostic !== undefined,
        "resolveSymbolTarget must return a diagnostic for unsupported-language block"
      );
      assert.equal(
        diagnostic.code,
        "SYMBOL_TARGET_UNAVAILABLE",
        "Diagnostic code must be SYMBOL_TARGET_UNAVAILABLE"
      );

      // G22: blockHash must be non-empty (so model can retry by hash)
      assert.ok(
        typeof diagnostic.blockHash === "string" && diagnostic.blockHash.length > 0,
        "SYMBOL_TARGET_UNAVAILABLE must include a non-empty blockHash"
      );

      // G22: retryHint must reference the blockHash
      assert.ok(
        typeof diagnostic.retryHint === "string" && diagnostic.retryHint.includes(diagnostic.blockHash),
        "retryHint must be a complete instruction that contains the blockHash"
      );

      // G22: blockExcerpt must be present and capped at 160 bytes
      assert.ok(
        typeof diagnostic.blockExcerpt === "string" && diagnostic.blockExcerpt.length > 0,
        "SYMBOL_TARGET_UNAVAILABLE must include a non-empty blockExcerpt"
      );
      const excerptBytes = new TextEncoder().encode(diagnostic.blockExcerpt).byteLength;
      assert.ok(
        excerptBytes <= 160,
        `blockExcerpt must not exceed 160 bytes (got ${excerptBytes})`
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Test helper — flatten StructuralNode tree                          */
/* ------------------------------------------------------------------ */

function flattenNodes(
  node: { type: string; children?: Array<{ type: string; children?: any[] }> }
): Array<{ type: string; children?: any[] }> {
  const result: Array<{ type: string; children?: any[] }> = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenNodes(child));
    }
  }
  return result;
}
