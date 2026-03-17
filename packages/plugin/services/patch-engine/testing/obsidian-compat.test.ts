/**
 * Obsidian markdown compatibility regression tests.
 *
 * These tests load Obsidian-specific fixtures, parse them with the
 * tree-sitter markdown grammar, and verify byte-correct behavior:
 *
 *   - Multi-byte wiki-link targets remain byte-stable after parsing
 *   - Inline and block MathJax delimiters remain intact
 *   - Embeds, callouts, and dataview markers are preserved
 *   - Templater regions are recognized for fail-closed treatment
 *   - ByteText round-trips through parsing preserve content
 *
 * Uses node:test (patch engine convention).
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { ByteText } from "../utils/byte-text";
import {
  getObsidianSyntaxPolicy,
  getObsidianSyntaxPolicyOrDefault,
} from "../parsers/obsidian-syntax-policy";

// ---------------------------------------------------------------------------
// web-tree-sitter CJS import
// ---------------------------------------------------------------------------

const treeSitterModule = require("web-tree-sitter") as {
  Parser: {
    new (): TreeSitterParser;
    init(moduleOptions?: {
      locateFile: (scriptName: string) => string;
    }): Promise<void>;
  };
  Language: {
    load(input: string | Uint8Array): Promise<TreeSitterLanguage>;
  };
};

interface TreeSitterParser {
  setLanguage(lang: TreeSitterLanguage): void;
  parse(input: string): TreeSitterTree;
}
interface TreeSitterLanguage {
  readonly nodeTypeCount: number;
}
interface TreeSitterTree {
  readonly rootNode: TreeSitterNode;
}
interface TreeSitterNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly isNamed: boolean;
  readonly childCount: number;
  readonly children: TreeSitterNode[];
  readonly text: string;
}

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const PLUGIN_DIR = path.resolve(__dirname, "../../..");
const GRAMMAR_WASM = path.join(PLUGIN_DIR, "grammars", "tree-sitter-markdown.wasm");
const FIXTURES_DIR = path.join(__dirname, "fixtures", "obsidian");

/** Walk up the directory tree to find the hoisted tree-sitter.wasm. */
function findTreeSitterWasm(): string {
  let dir = PLUGIN_DIR;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "web-tree-sitter", "tree-sitter.wasm");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("Could not find tree-sitter.wasm in any ancestor node_modules");
}

/** Collect all named nodes of a given type from the tree. */
function collectNodes(root: TreeSitterNode, nodeType: string): TreeSitterNode[] {
  const results: TreeSitterNode[] = [];
  function walk(node: TreeSitterNode): void {
    if (node.isNamed && node.type === nodeType) {
      results.push(node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return results;
}

/** Find all byte offsets of a substring pattern in raw bytes. */
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

// ---------------------------------------------------------------------------
// Parser state (initialized once)
// ---------------------------------------------------------------------------

let parser: TreeSitterParser;

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Obsidian Markdown Compatibility", () => {
  before(async () => {
    const Parser = treeSitterModule.Parser;
    const Language = treeSitterModule.Language;
    await Parser.init({ locateFile: () => findTreeSitterWasm() });
    parser = new Parser();
    const lang = await Language.load(GRAMMAR_WASM);
    parser.setLanguage(lang);
  });

  // -------------------------------------------------------------------------
  // Multi-byte wiki-link byte stability
  // -------------------------------------------------------------------------

  describe("multi-byte wiki-links remain byte-stable", () => {
    it("preserves Japanese wiki-link target bytes through parsing", () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);
      const tree = parser.parse(source);

      // "[[日本語ノート]]" — each char is 3 bytes, total target is 15 bytes
      const target = "日本語ノート";
      const encoder = new TextEncoder();
      const targetBytes = encoder.encode(target);

      // Find the pattern in source text
      const pattern = `[[${target}]]`;
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[日本語ノート]] in fixture");

      // Verify byte-level round-trip: encoding the target and decoding
      // the same byte range from ByteText produces identical content
      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
        const patternByteLen = encoder.encode(pattern).byteLength;
        // Slice the exact bytes of the wiki-link and verify content
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        const decoded = new TextDecoder().decode(sliced);
        assert.equal(decoded, pattern, "Byte-sliced wiki-link must match original");
      }

      // Verify the tree parsed without losing content
      // Note: web-tree-sitter startIndex/endIndex are character indices (UTF-16),
      // NOT byte indices. The engine will convert to byte offsets in ParserManager (Task 2.1).
      assert.equal(tree.rootNode.startIndex, 0);
      assert.equal(tree.rootNode.endIndex, source.length);
    });

    it("preserves French accented wiki-link target bytes", () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      const target = "Résumé";
      const pattern = `[[${target}]]`;
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[Résumé]] in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        const decoded = new TextDecoder().decode(sliced);
        assert.equal(decoded, pattern);
      }
    });

    it("preserves Chinese wiki-link with heading anchor", () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      const pattern = "[[中文笔记#标题]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find [[中文笔记#标题]] in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        assert.equal(new TextDecoder().decode(sliced), pattern);
      }
    });

    it("preserves wiki-link with alias containing multi-byte chars", () => {
      const source = readFixture("wiki-links.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      const pattern = "[[Über Thème|Display Naïve]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0);

      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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
    it("preserves inline math delimiters", () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // Find $E = mc^2$ and verify delimiters survive byte round-trip
      const pattern = "$E = mc^2$";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find $E = mc^2$ in fixture");

      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
        const patternByteLen = encoder.encode(pattern).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + patternByteLen);
        const decoded = new TextDecoder().decode(sliced);
        assert.equal(decoded, pattern);
        // Verify $ delimiters are at exact positions
        assert.equal(decoded[0], "$");
        assert.equal(decoded[decoded.length - 1], "$");
      }
    });

    it("preserves block math $$ delimiters", () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // Find standalone $$ lines
      const lines = source.split("\n");
      const dollarDollarLines = lines
        .map((line, idx) => ({ line: line.trimEnd(), idx }))
        .filter(({ line }) => line === "$$");

      assert.ok(dollarDollarLines.length >= 2, "Should have at least one $$ open/close pair");

      // Verify each $$ line byte offset maps correctly
      for (const { idx } of dollarDollarLines) {
        const prefix = lines.slice(0, idx).join("\n") + (idx > 0 ? "\n" : "");
        const byteOffset = encoder.encode(prefix).byteLength;
        const sliced = bt.sliceBytes(byteOffset, byteOffset + 2);
        assert.equal(new TextDecoder().decode(sliced), "$$");
      }
    });

    it("preserves math with multi-byte text content", () => {
      const source = readFixture("mathjax.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // The fixture has $\text{résumé}$ and $\text{日本語}$
      const patterns = ["$\\text{résumé}$", "$\\text{日本語}$"];
      for (const pattern of patterns) {
        const occurrences = findAllOccurrences(source, pattern);
        assert.ok(occurrences.length > 0, `Should find ${pattern} in fixture`);

        const charOffset = occurrences[0];
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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
    it("preserves multi-byte embed targets", () => {
      const source = readFixture("embeds.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

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
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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
    it("tree-sitter parses callouts as block_quote nodes", () => {
      const source = readFixture("callouts.md");
      const tree = parser.parse(source);

      // Callouts in tree-sitter appear as block_quote nodes
      const blockQuotes = collectNodes(tree.rootNode, "block_quote");
      assert.ok(blockQuotes.length > 0, "Should find block_quote nodes for callouts");
    });

    it("callout content with multi-byte wiki-links is byte-preserved", () => {
      const source = readFixture("callouts.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // The callout fixture has wiki-links like [[日本語ノート]] inside callouts
      const pattern = "[[日本語ノート]]";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0);

      for (const charOffset of occurrences) {
        const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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
    it("tree-sitter parses dataview as fenced_code_block", () => {
      const source = readFixture("dataview.md");
      const tree = parser.parse(source);

      const codeBlocks = collectNodes(tree.rootNode, "fenced_code_block");
      assert.ok(codeBlocks.length > 0, "Should find fenced_code_block nodes for dataview");

      // At least some should have 'dataview' or 'dataviewjs' in their info string
      const bt = ByteText.fromString(source);
      let foundDataview = false;
      for (const block of codeBlocks) {
        const text = new TextDecoder().decode(
          bt.sliceBytes(block.startIndex, Math.min(block.startIndex + 30, block.endIndex))
        );
        if (text.includes("dataview")) {
          foundDataview = true;
          break;
        }
      }
      assert.ok(foundDataview, "Should find at least one dataview code block");
    });

    it("inline dataview expressions are preserved in parent paragraph", () => {
      const source = readFixture("dataview.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // Inline dataview: `= this.file.name`
      const pattern = "`= this.file.name`";
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find inline dataview in fixture");

      const charOffset = occurrences[0];
      const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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

      // Verify the fixture has the expected Templater markers
      assert.ok(source.includes("<%"), "Should contain <% marker");
      assert.ok(source.includes("%>"), "Should contain %> marker");
      assert.ok(source.includes("<%*"), "Should contain <%* execution block marker");
      assert.ok(source.includes("tp.file.title"), "Should contain Templater API calls");
    });

    it("Templater regions with multi-byte content are detectable", () => {
      const source = readFixture("templater.md");
      const bt = ByteText.fromString(source);
      const encoder = new TextEncoder();

      // Find a Templater block with multi-byte content
      const pattern = '<% `Résumé: ${tp.file.title}` %>';
      const occurrences = findAllOccurrences(source, pattern);
      assert.ok(occurrences.length > 0, "Should find Templater block with Résumé");

      const charOffset = occurrences[0];
      const byteOffset = encoder.encode(source.slice(0, charOffset)).byteLength;
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
      it(`${name}: tree-sitter root node spans entire document`, () => {
        const source = readFixture(name);
        const tree = parser.parse(source);

        // web-tree-sitter uses character indices (UTF-16), not byte offsets.
        // The engine converts to byte offsets in ParserManager (Task 2.1).
        assert.equal(tree.rootNode.startIndex, 0, `${name}: root startIndex should be 0`);
        assert.equal(
          tree.rootNode.endIndex,
          source.length,
          `${name}: root endIndex should equal character length`
        );
      });

      it(`${name}: ByteText round-trip preserves all content`, () => {
        const source = readFixture(name);
        const bt = ByteText.fromString(source);

        // Full round-trip: string → bytes → string
        assert.equal(bt.toString(), source);

        // Byte-level round-trip
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
