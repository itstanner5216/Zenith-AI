/**
 * CST snapshot (golden-file) tests for the tree-sitter markdown grammar.
 *
 * Parses representative markdown fixtures, serialises each concrete syntax tree
 * to a deterministic snapshot string, and compares against golden files on disk.
 *
 * - Golden files live in `../snapshots/cst/{fixture-name}.snap`.
 * - Set `UPDATE_SNAPSHOTS=1` to regenerate every golden file.
 * - Without that env var the test fails when observed output differs from the
 *   stored snapshot, guarding against accidental CST regressions.
 *
 * Uses node:test (patch-engine convention).
 *
 * @module
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// web-tree-sitter CJS import (no ESM entry point)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS module
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

/** Minimal tree-sitter Parser interface for the subset we use. */
interface TreeSitterParser {
  setLanguage(lang: TreeSitterLanguage): void;
  parse(input: string): TreeSitterTree;
}

/** Minimal tree-sitter Language interface. */
interface TreeSitterLanguage {
  readonly nodeTypeCount: number;
}

/** Minimal tree-sitter Tree interface. */
interface TreeSitterTree {
  readonly rootNode: TreeSitterNode;
}

/** Minimal tree-sitter SyntaxNode interface. */
interface TreeSitterNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly isNamed: boolean;
  readonly childCount: number;
  readonly children: TreeSitterNode[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PLUGIN_DIR = path.resolve(__dirname, "..", "..", "..");
const GRAMMAR_WASM = path.join(PLUGIN_DIR, "grammars", "tree-sitter-markdown.wasm");
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
] as const;

/** Whether to overwrite golden files instead of comparing. */
const UPDATE_MODE = process.env["UPDATE_SNAPSHOTS"] === "1";

// ---------------------------------------------------------------------------
// tree-sitter bootstrap helpers
// ---------------------------------------------------------------------------

/**
 * Locate `tree-sitter.wasm` by walking up from PLUGIN_DIR into ancestor
 * `node_modules` directories (handles monorepo hoisting).
 */
function findTreeSitterWasm(): string {
  let dir = PLUGIN_DIR;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "web-tree-sitter", "tree-sitter.wasm");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("Could not find tree-sitter.wasm — is web-tree-sitter installed?");
}

// ---------------------------------------------------------------------------
// Snapshot serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise a tree-sitter node to a deterministic, human-readable snapshot
 * string.  Only named nodes are emitted (anonymous punctuation / keyword
 * nodes are skipped) to keep snapshots stable and concise.
 *
 * Format per line:
 * ```
 * <indent><type>  <startIndex>..<endIndex>
 * ```
 */
export function serialiseNode(node: TreeSitterNode, depth: number = 0): string {
  let result = "";

  if (node.isNamed) {
    const indent = "  ".repeat(depth);
    result += `${indent}${node.type}  ${node.startIndex}..${node.endIndex}\n`;

    for (let i = 0; i < node.childCount; i++) {
      const child = node.children[i];
      if (child !== undefined) {
        result += serialiseNode(child, depth + 1);
      }
    }
  } else {
    // Anonymous node — still recurse into children (they may be named).
    for (let i = 0; i < node.childCount; i++) {
      const child = node.children[i];
      if (child !== undefined) {
        result += serialiseNode(child, depth);
      }
    }
  }

  return result;
}

/**
 * Derive the `.snap` file path for a given fixture name.
 */
function snapshotPath(fixtureName: string): string {
  const base = fixtureName.replace(/\.md$/, "");
  return path.join(SNAPSHOTS_DIR, `${base}.snap`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CST snapshots", () => {
  let parser: TreeSitterParser;

  before(async () => {
    await treeSitterModule.Parser.init({
      locateFile: () => findTreeSitterWasm(),
    });
    parser = new treeSitterModule.Parser();
    const lang = await treeSitterModule.Language.load(GRAMMAR_WASM);
    parser.setLanguage(lang);

    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
  });

  for (const fixtureName of FIXTURE_NAMES) {
    it(`snapshot: ${fixtureName}`, () => {
      const fixturePath = path.join(FIXTURES_DIR, fixtureName);
      assert.ok(fs.existsSync(fixturePath), `Fixture not found: ${fixturePath}`);

      const source = fs.readFileSync(fixturePath, "utf-8");
      const tree = parser.parse(source);
      const observed = serialiseNode(tree.rootNode);

      const snapFile = snapshotPath(fixtureName);

      if (UPDATE_MODE) {
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
