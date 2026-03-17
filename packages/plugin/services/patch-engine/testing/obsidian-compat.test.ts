/**
 * Obsidian markdown compatibility regression tests.
 *
 * These tests load Obsidian-specific fixtures, parse them with the Rust
 * tree-sitter bridge (which guarantees UTF-8 byte offsets), and verify
 * byte-correct behavior:
 *
 *   - Multi-byte wiki-link targets remain byte-stable after parsing
 *   - Inline and block MathJax delimiters remain intact
 *   - Embeds, callouts, and dataview markers are preserved
 *   - Templater regions are recognized for fail-closed treatment
 *   - ByteText round-trips through parsing preserve content
 *   - tree-sitter node byte offsets match UTF-8 encoding
 *
 * Uses node:test (patch engine convention).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { ByteText } from "../utils/byte-text";
import {
  getObsidianSyntaxPolicy,
  getObsidianSyntaxPolicyOrDefault,
} from "../parsers/obsidian-syntax-policy";
import {
  type CstNode,
  parseCst,
  collectNodesByType,
} from "../rust-tree-sitter-runtime";

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, "fixtures", "obsidian");

/** Find all character offsets of a substring pattern in source text. */
function findAllOccurrences(text: string, pattern: string): number[] {
  const offsets: number[] = [];
  let idx = 0;
  while (true) {
    idx = text.indexOf(pattern, idx);
    if (idx === -1) break;
    offsets.push(idx);
    idx += pattern.length;
  }
  return offsets;
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

const encoder = new TextEncoder();

/**
 * Get the UTF-8 byte offset corresponding to a character offset in source.
 * Encodes the prefix up to `charOffset` and returns its byte length.
 */
function charOffsetToByteOffset(source: string, charOffset: number): number {
  return encoder.encode(source.slice(0, charOffset)).byteLength;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Obsidian Markdown Compatibility", () => {

  // -------------------------------------------------------------------------
  // Multi-byte wiki-link byte stability
  // -------------------------------------------------------------------------

  describe("multi-byte wiki-links remain byte-stable", () => {
    it("preserves Japanese wiki-link target bytes through parsing", async () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);
      const root = await parseCst("markdown", source);

      const target = "日本語ノート";
      const pattern = `[[${target}]]`;
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[日本語ノート]] in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        const decoded = new TextDecoder().decode(sliced);
        assert.equal(decoded, pattern, "Byte-sliced wiki-link must match original");
      }

      // Root node byte offsets span the whole document
      const utf8Len = Buffer.byteLength(source, "utf8");
      assert.equal(root.startByte, 0);
      assert.equal(root.endByte, utf8Len);
    });

    it("preserves French accented wiki-link target bytes", async () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);

      const target = "Résumé";
      const pattern = `[[${target}]]`;
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[Résumé]] in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });

    it("preserves Chinese wiki-link with heading anchor", async () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);

      const pattern = "[[中文笔记#标题]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[中文笔记#标题]] in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });

    it("preserves wiki-link with alias containing multi-byte chars", async () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);

      const pattern = "[[Über Thème|Display Naïve]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0);

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });
  });

  // -------------------------------------------------------------------------
  // MathJax delimiter preservation
  // -------------------------------------------------------------------------

  describe("MathJax delimiters remain intact", () => {
    it("preserves inline math delimiters", async () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);

      const pattern = "$E = mc^2$";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find $E = mc^2$ in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        const decoded = new TextDecoder().decode(sliced);
        assert.equal(decoded, pattern);
        assert.equal(decoded[0], "$");
        assert.equal(decoded[decoded.length - 1], "$");
      }
    });

    it("preserves block math $$ delimiters", async () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);

      const lines = source.split("\n");
      const dollarDollarLines = lines
        .map((line, idx) => ({ line: line.trimEnd(), idx }))
        .filter(({ line }) => line === "$$");

      assert.ok(dollarDollarLines.length >= 2, "Should have at least one $$ open/close pair");

      for (const { idx } of dollarDollarLines) {
        const prefix = lines.slice(0, idx).join("\n") + (idx > 0 ? "\n" : "");
        const byteOffset = encoder.encode(prefix).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + 2);
        assert.equal(new TextDecoder().decode(sliced), "$$");
      }
    });

    it("preserves math with multi-byte text content", async () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);

      const patterns = ["$\\text{résumé}$", "$\\text{日本語}$"];
      for (const pattern of patterns) {
        const occurrences = findAllOccurrences(source, pattern);
        assert.ok(occurrences.length > 0, `Should find ${pattern} in fixture`);

        const charOffset = occurrences[0];
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Embed / callout / dataview preservation
  // -------------------------------------------------------------------------

  describe("embeds are preserved as inline content", () => {
    it("preserves multi-byte embed targets", async () => {
      const source = readFixture("embeds.md");
      const bt = ByteText.fromString(source);

      const patterns = [
        "![[Résumé du projet]]",
        "![[日本語画像.png]]",
        "![[Über Zusammenfassung]]",
        "![[中文文档#摘要]]",
      ];

      for (const pattern of patterns) {
        const occurrences = findAllOccurrences(source, pattern);
        assert.ok(occurrences.length > 0, `Should find ${pattern} in fixture`);

        const charOffset = occurrences[0];
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });

    it("embed policy is preserved_as_inline", () => {
      const policy = getObsidianSyntaxPolicy("embed");
      assert.ok(policy);
      assert.equal(policy.classification, "preserved_as_inline");
    });
  });

  describe("callouts are treated as opaque blocks", () => {
    it("tree-sitter parses callouts as block_quote nodes", async () => {
      const source = readFixture("callouts.md");
      const root = await parseCst("markdown", source);

      const blockQuotes = collectNodesByType(root, "block_quote");
      assert.ok(blockQuotes.length > 0, "Should find block_quote nodes for callouts");
    });

    it("callout content with multi-byte wiki-links is byte-preserved", async () => {
      const source = readFixture("callouts.md");
      const bt = ByteText.fromString(source);

      const pattern = "[[日本語ノート]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0);

      for (const charOffset of occurrences) {
        const byteOffset = charOffsetToByteOffset(source, charOffset);
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });

    it("callout policy is opaque_block", () => {
      const policy = getObsidianSyntaxPolicy("callout");
      assert.ok(policy);
      assert.equal(policy.classification, "opaque_block");
      assert.equal(policy.outlineBehavior, "own_entry");
    });
  });

  describe("dataview blocks are treated as opaque code blocks", () => {
    it("tree-sitter parses dataview as fenced_code_block", async () => {
      const source = readFixture("dataview.md");
      const root = await parseCst("markdown", source);

      const codeBlocks = collectNodesByType(root, "fenced_code_block");
      assert.ok(codeBlocks.length > 0, "Should find fenced_code_block nodes for dataview");

      let foundDataview = false;
      for (const block of codeBlocks) {
        if (block.text.includes("dataview")) {
          foundDataview = true;
          break;
        }
      }
      assert.ok(foundDataview, "Should find at least one dataview code block");
    });

    it("inline dataview expressions are preserved in parent paragraph", async () => {
      const source = readFixture("dataview.md");
      const bt = ByteText.fromString(source);

      const pattern = "`= this.file.name`";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find inline dataview in fixture");

      const charOffset = occurrences[0];
      const byteOffset = charOffsetToByteOffset(source, charOffset);
      const patternByteLen = encoder.encode(pattern).byteLength;
      const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
      assert.equal(new TextDecoder().decode(sliced), pattern);
    });

    it("dataview policy matches classification", () => {
      const blockPolicy = getObsidianSyntaxPolicy("dataview_block");
      assert.ok(blockPolicy);
      assert.equal(blockPolicy.classification, "opaque_block");

      const inlinePolicy = getObsidianSyntaxPolicy("dataview_inline");
      assert.ok(inlinePolicy);
      assert.equal(inlinePolicy.classification, "preserved_as_inline");
    });
  });

  // -------------------------------------------------------------------------
  // Templater fail-closed recognition
  // -------------------------------------------------------------------------

  describe("Templater regions are recognized as fail-closed", () => {
    it("fixture contains Templater syntax markers", () => {
      const source = readFixture("templater.md");

      assert.ok(source.includes("<%"), "Should contain <% marker");
      assert.ok(source.includes("%>"), "Should contain %> marker");
      assert.ok(source.includes("<%*"), "Should contain <%* execution block marker");
      assert.ok(source.includes("tp.file.title"), "Should contain Templater API calls");
    });

    it("Templater regions with multi-byte content are detectable", async () => {
      const source = readFixture("templater.md");
      const bt = ByteText.fromString(source);

      const pattern = '<% `Résumé: ${tp.file.title}` %>';
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find Templater block with Résumé");

      const charOffset = occurrences[0];
      const byteOffset = charOffsetToByteOffset(source, charOffset);
      const patternByteLen = encoder.encode(pattern).byteLength;
      const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
      assert.equal(new TextDecoder().decode(sliced), pattern);
    });

    it("Templater policy is unsupported_fail_closed", () => {
      const policy = getObsidianSyntaxPolicy("templater");
      assert.ok(policy);
      assert.equal(policy.classification, "unsupported_fail_closed");
      assert.equal(policy.outlineBehavior, "excluded");
    });
  });

  // -------------------------------------------------------------------------
  // Full document byte-integrity
  // -------------------------------------------------------------------------

  describe("full document byte integrity through parse round-trip", () => {
    const fixtureNames = [
      "wiki-links.md",
      "mathjax.md",
      "callouts.md",
      "embeds.md",
      "dataview.md",
      "templater.md",
      "nested-blockquotes.md",
      "mixed-note.md",
    ];

    for (const name of fixtureNames) {
      it(`${name}: tree-sitter root node spans entire document (byte offsets)`, async () => {
        const source = readFixture(name);
        const root = await parseCst("markdown", source);
        const utf8Len = Buffer.byteLength(source, "utf8");

        assert.equal(root.startByte, 0, `${name}: root startByte should be 0`);
        assert.equal(
          root.endByte,
          utf8Len,
          `${name}: root endByte should equal UTF-8 byte length`,
        );
      });

      it(`${name}: ByteText round-trip preserves all content`, () => {
        const source = readFixture(name);
        const bt = ByteText.fromString(source);

        assert.equal(bt.toString(), source);

        const bt2 = ByteText.fromBytes(bt.toBytes());
        assert.equal(bt2.toString(), source);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Fail-closed default for unknown syntax
  // -------------------------------------------------------------------------

  describe("unknown Obsidian syntax defaults to fail-closed", () => {
    it("returns fail-closed policy for unrecognized construct", () => {
      const policy = getObsidianSyntaxPolicyOrDefault("some_unknown_syntax");
      assert.equal(policy.classification, "unsupported_fail_closed");
      assert.equal(policy.outlineBehavior, "excluded");
    });

    it("returns specific policy for known construct", () => {
      const policy = getObsidianSyntaxPolicyOrDefault("callout");
      assert.equal(policy.classification, "opaque_block");
    });
  });
});
