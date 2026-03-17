#!/usr/bin/env node
/**
 * CST inspection script for tree-sitter markdown grammar discovery.
 *
 * Parses markdown fixtures with the Rust tree-sitter bridge and prints
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
import { type CstNode, parseCst } from "../services/patch-engine/rust-tree-sitter-runtime";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUGIN_DIR = path.resolve(__dirname, "..");
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
function pos(row: number, col: number): string {
  return `${row}:${col}`;
}

// ---------------------------------------------------------------------------
// Tree walking
// ---------------------------------------------------------------------------

/**
 * Recursively walk a CstNode and print its structure.
 *
 * Output format per line:
 *   <indent> <type> [<named|anon>]  bytes=<start>..<end>  pos=<r:c>..<r:c>  "<text>"
 */
function printNode(node: CstNode, depth: number): void {
  const indent = "  ".repeat(depth);
  const named = node.named ? "named" : "anon";
  const byteRange = `${node.startByte}..${node.endByte}`;
  const posRange = `${pos(node.startRow, node.startCol)}..${pos(node.endRow, node.endCol)}`;
  const textPreview = truncateText(node.text, MAX_TEXT_DISPLAY);

  write(
    `${indent}${node.type} [${named}]  bytes=${byteRange}  pos=${posRange}  "${textPreview}"\n`,
  );

  for (const child of node.children) {
    printNode(child, depth + 1);
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
  // 1. Resolve fixture files
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

  // 2. Parse and inspect each fixture
  for (const fixture of fixtures) {
    const source = fs.readFileSync(fixture, "utf-8");
    const relPath = path.relative(process.cwd(), fixture);

    write(`${"═".repeat(72)}\n`);
    write(`File: ${relPath}\n`);
    write(`Size: ${Buffer.byteLength(source, "utf-8")} bytes, ${source.length} chars\n`);
    write(`${"═".repeat(72)}\n\n`);

    const root = await parseCst("markdown", source);
    printNode(root, 0);

    write("\n");
  }

  write("Inspection complete.\n");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  write(`Fatal: ${msg}\n`);
  process.exit(1);
});
