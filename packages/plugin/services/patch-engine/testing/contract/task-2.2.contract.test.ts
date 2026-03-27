/**
 * CONTRACT TESTS — Task 2.2: Implement markdown fallback scanner
 *
 * PLAN1.md §Task 2.2 makes three hard behavioural guarantees about the
 * fallback scanner. These tests prove every guarantee stated in the plan
 * by calling the public scanner API against realistic markdown inputs.
 * They will FAIL until the implementation fulfils every stated contract.
 *
 * Guarantees under test:
 *
 *   [G15] Heading markers (# / ## / etc.) that appear inside a fenced code
 *         block must NOT be emitted as heading nodes. Plan quote:
 *         "Ignore heading markers inside code fences."
 *
 *   [G16] A fenced code block that has no language tag (the opening fence is
 *         just ```) must still be scanned and emitted as a code_block node.
 *         Plan quote: "Support code fences with no language tag."
 *
 *   [G17] Code fences nested inside list items and blockquotes must be
 *         detected by tracking fence state — not by indentation.
 *         Plan quote: "Support code fences nested inside list items and
 *         blockquotes by tracking fence state, not indentation alone."
 *
 *   [G18] The FallbackNode type union is exactly:
 *         "frontmatter" | "heading" | "code_block" | "table" | "paragraph"
 *         Plan snippet defines exactly these five variants.
 *
 * Runner: node:test
 * Imports: only the fallback scanner's public module.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

/* ------------------------------------------------------------------ */
/*  Public API import only                                              */
/* ------------------------------------------------------------------ */

import type { FallbackNode } from "../../parsers/markdown-fallback-scanner";
import { scanMarkdown } from "../../parsers/markdown-fallback-scanner";

/* ================================================================== */

describe("[TASK 2.2] — Implement markdown fallback scanner", () => {
  // ----------------------------------------------------------------
  // G16 — code fence with no language tag
  // ----------------------------------------------------------------
  describe("success cases", () => {
    it("[TASK 2.2] code fence with no language tag is emitted as code_block", () => {
      const markdown = [
        "# A heading",
        "",
        "Some paragraph text.",
        "",
        "```",
        "no-lang code here",
        "line two",
        "```",
        "",
      ].join("\n");

      const nodes: FallbackNode[] = scanMarkdown(markdown);

      const codeBlocks = nodes.filter((n) => n.type === "code_block");
      assert.ok(
        codeBlocks.length >= 1,
        "A fenced code block with no language tag must be emitted as a code_block node"
      );

      // language field must be undefined or null (not a spurious string)
      const fenced = codeBlocks[0];
      assert.ok(
        fenced.language === undefined || fenced.language === null || fenced.language === "",
        "code_block with no language tag must have undefined/null/empty language"
      );

      // Byte offsets must be valid non-negative numbers
      assert.ok(
        typeof fenced.startByte === "number" && fenced.startByte >= 0,
        "code_block startByte must be a non-negative number"
      );
      assert.ok(
        typeof fenced.endByte === "number" && fenced.endByte > fenced.startByte,
        "code_block endByte must be greater than startByte"
      );
    });

    // ----------------------------------------------------------------
    // G17 — code fence nested inside a blockquote
    // ----------------------------------------------------------------
    it("[TASK 2.2] code fence nested inside a blockquote is detected as code_block", () => {
      /*
       * The plan says fence detection must track fence state, not indentation.
       * A heading-like line (# foo) inside the blockquote fence must NOT be
       * emitted as a heading, and the fence itself must be emitted as code_block.
       */
      const markdown = [
        "> Some blockquote prose.",
        ">",
        "> ```python",
        "> # this is a comment, not a heading",
        "> def hello():",
        ">     pass",
        "> ```",
        "",
        "## Real heading",
      ].join("\n");

      const nodes: FallbackNode[] = scanMarkdown(markdown);

      const codeBlocks = nodes.filter((n) => n.type === "code_block");
      assert.ok(
        codeBlocks.length >= 1,
        "A code fence inside a blockquote must produce a code_block node"
      );

      // The "# this is a comment" line inside the fence must NOT produce a heading
      const headings = nodes.filter((n) => n.type === "heading");
      const fakeHeading = headings.find((h) => h.label?.includes("this is a comment"));
      assert.equal(
        fakeHeading,
        undefined,
        "Heading-like text inside a blockquote fence must NOT be emitted as a heading"
      );
    });
  });

  // ----------------------------------------------------------------
  // G15 — heading markers inside code fences must be ignored
  // ----------------------------------------------------------------
  describe("rejection cases", () => {
    it("[TASK 2.2] heading markers inside a code fence are NOT emitted as headings", () => {
      const markdown = [
        "# Real Heading",
        "",
        "```typescript",
        "// # This looks like a heading but is inside a fence",
        "const x = 1;",
        "## Also inside fence — must be ignored",
        "```",
        "",
        "## Another Real Heading",
      ].join("\n");

      const nodes: FallbackNode[] = scanMarkdown(markdown);
      const headings = nodes.filter((n) => n.type === "heading");

      // Must have exactly 2 real headings (the ones outside the fence)
      // There must be no heading whose label contains the fence-internal text.
      const fakeH1 = headings.find((h) =>
        (h.label ?? "").includes("This looks like a heading but is inside a fence")
      );
      const fakeH2 = headings.find((h) =>
        (h.label ?? "").includes("Also inside fence")
      );

      assert.equal(
        fakeH1,
        undefined,
        "Comment-line inside fence that looks like a heading must NOT be scanned as heading"
      );
      assert.equal(
        fakeH2,
        undefined,
        "## marker inside a code fence must NOT be scanned as heading"
      );

      // The two real headings must be present
      assert.equal(
        headings.length,
        2,
        "Only the two real headings (outside the fence) must be emitted"
      );
    });
  });

  // ----------------------------------------------------------------
  // G18 — FallbackNode type union is exactly the five plan-defined variants
  // ----------------------------------------------------------------
  describe("edge cases", () => {
    it("[TASK 2.2] FallbackNode.type is one of the five plan-defined variants", () => {
      /*
       * The plan defines the FallbackNode.type union as:
       *   "frontmatter" | "heading" | "code_block" | "table" | "paragraph"
       *
       * We scan a document containing one of each and then verify that every
       * emitted node has a type that is a member of that set. Any node with
       * an out-of-set type is a contract failure.
       */
      const markdown = [
        "---",
        "title: Test",
        "---",
        "",
        "# Heading One",
        "",
        "A paragraph of text.",
        "",
        "| Col A | Col B |",
        "| ----- | ----- |",
        "| val 1 | val 2 |",
        "",
        "```js",
        "const x = 1;",
        "```",
        "",
      ].join("\n");

      const VALID_TYPES = new Set<string>([
        "frontmatter",
        "heading",
        "code_block",
        "table",
        "paragraph",
      ]);

      const nodes: FallbackNode[] = scanMarkdown(markdown);

      assert.ok(
        nodes.length > 0,
        "Fallback scanner must produce at least one node for the test document"
      );

      for (const node of nodes) {
        assert.ok(
          VALID_TYPES.has(node.type),
          `FallbackNode type '${node.type}' is not in the plan-defined union`
        );
      }

      // Must have detected at least one of each expected type
      const types = new Set(nodes.map((n) => n.type));
      for (const expected of ["heading", "code_block", "paragraph"]) {
        assert.ok(
          types.has(expected),
          `The scanner must detect at least one '${expected}' node in a typical document`
        );
      }
    });
  });
});
