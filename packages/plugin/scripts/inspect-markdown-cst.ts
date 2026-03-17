#!/usr/bin/env node
/**
 * CST inspection script for tree-sitter markdown grammar discovery.
 *
 * Parses markdown fixtures with the tree-sitter-markdown grammar and prints
 * the full concrete syntax tree for each file, showing node types, byte
 * offsets, row/column positions, and (truncated) node text.
 *
 * Usage:
 *   npx tsx packages/plugin/scripts/inspect-markdown-cst.ts [fixture-path]
 *
 * If no fixture path is given, inspects all fixtures in
 * packages/plugin/services/patch-engine/testing/fixtures/cst/.
 *
 * @module
 */

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
  readonly startPosition: { row: number; column: number };
  readonly endPosition: { row: number; column: number };
  readonly isNamed: boolean;
  readonly childCount: number;
  readonly children: TreeSitterNode[];
  readonly text: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUGIN_DIR = path.resolve(__dirname, "..");
const GRAMMAR_WASM = path.join(PLUGIN_DIR, "grammars", "tree-sitter-markdown.wasm");
const DEFAULT_FIXTURES_DIR = path.join(
  PLUGIN_DIR,
  "services",
  "patch-engine",
  "testing",
  "fixtures",
  "cst",
);

/** Maximum characters of node text to display inline. */
const MAX_TEXT_DISPLAY = 60;

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/** Write a string to stdout (no console.log). */
function write(s: string): void {
  process.stdout.write(s);
}

/** Truncate text for display, collapsing whitespace. */
function truncateText(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) {
    return collapsed;
  }
  return collapsed.slice(0, max - 1) + "…";
}

/** Render a position as "row:col". */
function pos(p: { row: number; column: number }): string {
  return `${p.row}:${p.column}`;
}

// ---------------------------------------------------------------------------
// Tree walking
// ---------------------------------------------------------------------------

/**
 * Recursively walk a tree-sitter node and print its structure.
 *
 * Output format per line:
 *   <indent> <type> [<named|anon>]  bytes=<start>..<end>  pos=<r:c>..<r:c>  "<text>"
 */
function printNode(node: TreeSitterNode, depth: number): void {
  const indent = "  ".repeat(depth);
  const named = node.isNamed ? "named" : "anon";
  const byteRange = `${node.startIndex}..${node.endIndex}`;
  const posRange = `${pos(node.startPosition)}..${pos(node.endPosition)}`;
  const textPreview = truncateText(node.text, MAX_TEXT_DISPLAY);

  write(
    `${indent}${node.type} [${named}]  bytes=${byteRange}  pos=${posRange}  "${textPreview}"\n`,
  );

  for (let i = 0; i < node.childCount; i++) {
    const child = node.children[i];
    if (child !== undefined) {
      printNode(child, depth + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture discovery
// ---------------------------------------------------------------------------

/** Collect .md files to inspect. */
function resolveFixtures(argPath: string | undefined): string[] {
  if (argPath !== undefined) {
    const resolved = path.resolve(argPath);
    if (!fs.existsSync(resolved)) {
      write(`Error: path does not exist: ${resolved}\n`);
      process.exit(1);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return listMarkdownFiles(resolved);
    }
    return [resolved];
  }

  if (!fs.existsSync(DEFAULT_FIXTURES_DIR)) {
    write(`Error: default fixtures directory not found: ${DEFAULT_FIXTURES_DIR}\n`);
    process.exit(1);
  }
  return listMarkdownFiles(DEFAULT_FIXTURES_DIR);
}

/** List .md files in a directory, sorted alphabetically. */
function listMarkdownFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(dir, f));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Resolve tree-sitter.wasm from node_modules
  const treeSitterWasmDir = resolveTreeSitterWasmDir();

  // 2. Initialise web-tree-sitter
  await treeSitterModule.Parser.init({
    locateFile(scriptName: string): string {
      return path.join(treeSitterWasmDir, scriptName);
    },
  });

  // 3. Create parser and load markdown grammar
  const parser: TreeSitterParser = new treeSitterModule.Parser();

  if (!fs.existsSync(GRAMMAR_WASM)) {
    write(`Error: grammar WASM not found: ${GRAMMAR_WASM}\n`);
    process.exit(1);
  }
  const markdownLang = await treeSitterModule.Language.load(GRAMMAR_WASM);
  parser.setLanguage(markdownLang);

  write(`Grammar loaded: tree-sitter-markdown (${markdownLang.nodeTypeCount} node types)\n`);
  write(`${"─".repeat(72)}\n`);

  // 4. Resolve fixture files
  const fixtures = resolveFixtures(process.argv[2]);
  if (fixtures.length === 0) {
    write("No .md fixtures found.\n");
    process.exit(0);
  }
  write(`Found ${fixtures.length} fixture(s):\n`);
  for (const f of fixtures) {
    write(`  • ${path.relative(process.cwd(), f)}\n`);
  }
  write(`${"─".repeat(72)}\n\n`);

  // 5. Parse and inspect each fixture
  for (const fixture of fixtures) {
    const source = fs.readFileSync(fixture, "utf-8");
    const relPath = path.relative(process.cwd(), fixture);

    write(`${"═".repeat(72)}\n`);
    write(`File: ${relPath}\n`);
    write(`Size: ${Buffer.byteLength(source, "utf-8")} bytes, ${source.length} chars\n`);
    write(`${"═".repeat(72)}\n\n`);

    const tree = parser.parse(source);
    printNode(tree.rootNode, 0);

    write("\n");
  }

  write("Inspection complete.\n");
}

/**
 * Resolve the directory containing `tree-sitter.wasm` from node_modules.
 *
 * Walks upward from the plugin directory looking for
 * `node_modules/web-tree-sitter/tree-sitter.wasm` to handle both hoisted
 * (monorepo root) and local installs.
 */
function resolveTreeSitterWasmDir(): string {
  let dir = PLUGIN_DIR;
  while (true) {
    const candidate = path.join(dir, "node_modules", "web-tree-sitter");
    if (fs.existsSync(path.join(candidate, "tree-sitter.wasm"))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // Fallback: try require.resolve
  try {
    const modPath = require.resolve("web-tree-sitter");
    return path.dirname(modPath);
  } catch {
    write("Error: could not locate web-tree-sitter/tree-sitter.wasm\n");
    write("Ensure web-tree-sitter is installed (npm install web-tree-sitter).\n");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  write(`Fatal: ${msg}\n`);
  process.exit(1);
});
