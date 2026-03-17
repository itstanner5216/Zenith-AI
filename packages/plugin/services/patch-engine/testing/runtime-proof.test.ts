/**
 * Runtime proof test — Task 0.5 verification in the Node.js test harness.
 *
 * Runs the full grammar runtime proof (all 11 grammars) and asserts
 * every grammar parses successfully with valid byte offsets.
 *
 * This test is the automated gate for the plan's Task 0.5 exit criteria:
 * "markdown grammar loads, parses, and produces expected CST."
 *
 * The live Obsidian proof is a manual step that uses the same
 * `runRuntimeProof()` function via a developer command registered
 * in the plugin.
 *
 * Uses node:test (patch-engine convention).
 *
 * @module
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { runRuntimeProof, formatProofResult } from "../runtime-proof";

// ---------------------------------------------------------------------------
// WASM binary size — read from disk for the proof report
// ---------------------------------------------------------------------------

const WASM_PATH = path.join(
  __dirname,
  "..",
  "runtime",
  "rust-tree-sitter-bridge",
  "pkg",
  "rust_tree_sitter_bridge_bg.wasm",
);

function getWasmSize(): number | null {
  try {
    return fs.statSync(WASM_PATH).size;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Task 0.5 — Grammar Runtime Proof", () => {
  it("bridge initialises successfully", async () => {
    const result = await runRuntimeProof(getWasmSize());
    assert.equal(result.bridgeInitialised, true, "Bridge must initialise");
  });

  it("all 11 grammars parse with valid CST", async () => {
    const result = await runRuntimeProof(getWasmSize());

    // Log the formatted report for CI visibility
    process.stdout.write("\n" + formatProofResult(result) + "\n\n");

    assert.equal(result.pass, true, `Runtime proof failed: ${result.failCount} grammar(s) failed`);
    assert.equal(result.grammars.length, 11, "Expected 11 grammar probes");
    assert.equal(result.passCount, 11, "All 11 grammars must pass");
  });

  it("byte offsets are valid for every grammar", async () => {
    const result = await runRuntimeProof(getWasmSize());
    for (const g of result.grammars) {
      assert.equal(
        g.byteOffsetsValid,
        true,
        `${g.grammar}: byte offsets invalid`,
      );
    }
  });

  it("WASM binary exists and is reasonable size", () => {
    const size = getWasmSize();
    assert.notEqual(size, null, "WASM binary must exist");
    // Bridge with 10 grammar crates should be at least 1 MiB
    assert.ok(size! > 1 * 1024 * 1024, `WASM too small: ${size} bytes`);
    // And under 20 MiB (sanity ceiling)
    assert.ok(size! < 20 * 1024 * 1024, `WASM too large: ${size} bytes`);
  });

  it("grammar crate versions match Cargo.toml expectations", async () => {
    // Verify the Cargo.toml exists and lists all expected grammars
    const cargoPath = path.join(
      __dirname,
      "..",
      "runtime",
      "rust-tree-sitter-bridge",
      "Cargo.toml",
    );
    assert.ok(fs.existsSync(cargoPath), "Cargo.toml must exist");

    const cargo = fs.readFileSync(cargoPath, "utf-8");
    const expectedCrates = [
      "tree-sitter-md",
      "tree-sitter-json",
      "tree-sitter-typescript",
      "tree-sitter-javascript",
      "tree-sitter-python",
      "tree-sitter-bash",
      "tree-sitter-css",
      "tree-sitter-yaml",
      "tree-sitter-go",
      "tree-sitter-sequel",
    ];

    for (const crate of expectedCrates) {
      assert.ok(
        cargo.includes(crate),
        `Cargo.toml missing expected grammar crate: ${crate}`,
      );
    }
  });

  it("markdown proof parses frontmatter, headings, and code blocks", async () => {
    // Specific exit criteria: "at least one with frontmatter, headings, and code blocks"
    const { parseCst } = await import("../rust-tree-sitter-runtime");
    const source = [
      "---",
      "title: Runtime Proof",
      "tags: [test]",
      "---",
      "",
      "# Main Heading",
      "",
      "## Subheading",
      "",
      "A paragraph with **bold** text.",
      "",
      "```typescript",
      "const x: number = 42;",
      "export function greet(): string { return 'hi'; }",
      "```",
      "",
      "Another paragraph.",
    ].join("\n");

    const root = await parseCst("markdown", source);
    assert.equal(root.type, "document");

    // Verify structural nodes exist
    const types = new Set<string>();
    function walk(node: import("../rust-tree-sitter-runtime").CstNode): void {
      if (node.named) types.add(node.type);
      for (const c of node.children) walk(c);
    }
    walk(root);

    assert.ok(types.has("minus_metadata"), "Must find frontmatter (minus_metadata)");
    assert.ok(types.has("atx_heading"), "Must find headings (atx_heading)");
    assert.ok(types.has("fenced_code_block"), "Must find code blocks (fenced_code_block)");
    assert.ok(types.has("paragraph"), "Must find paragraphs");
    assert.ok(types.has("section"), "Must find sections");
  });
});
