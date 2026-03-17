/**
 * CST snapshot (golden-file) tests for the tree-sitter markdown grammar.
 *
 * Parses representative markdown fixtures via the Rust tree-sitter bridge,
 * serialises each concrete syntax tree to a deterministic snapshot string,
 * and compares against golden files on disk.
 *
 * - Golden files live in `../snapshots/cst/{fixture-name}.snap`.
 * - Set `UPDATE_SNAPSHOTS=1` to regenerate every golden file.
 * - Without that env var the test fails when observed output differs from
 *   the stored snapshot, guarding against accidental CST regressions.
 *
 * Uses node:test (patch-engine convention).
 *
 * @module
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { type CstNode, parseCst } from "../rust-tree-sitter-runtime";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, "fixtures", "cst");
const SNAPSHOTS_DIR = path.join(__dirname, "snapshots", "cst");

/** Representative fixture subset (covers major markdown constructs). */
const FIXTURE_NAMES: readonly string[] = [
  "headings.md",
  "frontmatter.md",
  "code-blocks.md",
  "lists.md",
  "tables.md",
  "blockquotes.md",
  "mixed-document.md",
  "code-blocks-in-lists.md",
  "malformed.md",
  "code-blocks-in-blockquotes.md",
  "obsidian-specific.md",
  "paragraphs.md",
] as const;

/** Whether to overwrite golden files instead of comparing. */
const UPDATE_MODE = process.env["UPDATE_SNAPSHOTS"] === "1";

// ---------------------------------------------------------------------------
// Snapshot serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise a CstNode to a deterministic, human-readable snapshot string.
 * Only named nodes are emitted (anonymous punctuation/keyword nodes are
 * skipped) to keep snapshots stable and concise.
 *
 * Format per line:
 * ```
 * <indent><type>  <startByte>..<endByte>
 * ```
 */
export function serialiseNode(node: CstNode, depth: number = 0): string {
  let result = "";

  if (node.named) {
    const indent = "  ".repeat(depth);
    result += `${indent}${node.type}  ${node.startByte}..${node.endByte}\n`;

    for (const child of node.children) {
      result += serialiseNode(child, depth + 1);
    }
  } else {
    // Anonymous node — still recurse into children (they may be named).
    for (const child of node.children) {
      result += serialiseNode(child, depth);
    }
  }

  return result;
}

/** Derive the `.snap` file path for a given fixture name. */
function snapshotPath(fixtureName: string): string {
  const base = fixtureName.replace(/\.md$/, "");
  return path.join(SNAPSHOTS_DIR, `${base}.snap`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CST snapshots", () => {
  for (const fixtureName of FIXTURE_NAMES) {
    it(`snapshot: ${fixtureName}`, async () => {
      const fixturePath = path.join(FIXTURES_DIR, fixtureName);
      assert.ok(fs.existsSync(fixturePath), `Fixture not found: ${fixturePath}`);

      const source = fs.readFileSync(fixturePath, "utf-8");
      const root = await parseCst("markdown", source);
      const observed = serialiseNode(root);

      const snapFile = snapshotPath(fixtureName);

      if (UPDATE_MODE) {
        if (!fs.existsSync(SNAPSHOTS_DIR)) {
          fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
        }
        fs.writeFileSync(snapFile, observed, "utf-8");
        process.stdout.write(`  updated ${path.relative(process.cwd(), snapFile)}\n`);
        return;
      }

      assert.ok(
        fs.existsSync(snapFile),
        `Golden snapshot missing: ${snapFile}\nRun with UPDATE_SNAPSHOTS=1 to create it.`,
      );
      const expected = fs.readFileSync(snapFile, "utf-8");
      assert.equal(
        observed,
        expected,
        `CST snapshot mismatch for ${fixtureName}.\nRun with UPDATE_SNAPSHOTS=1 to update.`,
      );
    });
  }
});
