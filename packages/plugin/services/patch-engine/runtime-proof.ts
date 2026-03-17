/**
 * Grammar Runtime Proof — Task 0.5
 *
 * Verifies the Rust tree-sitter bridge loads, bundles, and parses correctly
 * in the running environment (Obsidian/Electron or Node.js test harness).
 *
 * This module is the exit-criteria gate for Phase 0: it proves that every
 * grammar compiled into the bridge can parse representative input and
 * produce a structurally valid CST with UTF-8 byte offsets.
 *
 * @module
 */

import { type CstNode, parseCst, initTreeSitterOnce, isTreeSitterReady } from "./rust-tree-sitter-runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from probing a single grammar. */
export interface GrammarProbeResult {
  /** Grammar identifier. */
  grammar: string;
  /** Whether the grammar parsed successfully. */
  success: boolean;
  /** Root node type (should be the grammar's document root). */
  rootType: string | null;
  /** Total named node count in the CST. */
  namedNodeCount: number;
  /** Whether all byte offsets are non-negative and properly ordered. */
  byteOffsetsValid: boolean;
  /** Parse duration in milliseconds. */
  parseMs: number;
  /** Error message on failure. */
  error: string | null;
}

/** Aggregate result from the full runtime proof. */
export interface RuntimeProofResult {
  /** Whether the bridge initialised successfully. */
  bridgeInitialised: boolean;
  /** Bridge init duration in milliseconds. */
  initMs: number;
  /** Per-grammar probe results. */
  grammars: GrammarProbeResult[];
  /** Number of grammars that parsed successfully. */
  passCount: number;
  /** Number of grammars that failed. */
  failCount: number;
  /** Overall pass (all grammars succeeded). */
  pass: boolean;
  /** WASM binary size in bytes (recorded at build time, injected here). */
  wasmBinarySize: number | null;
  /** Runtime caveats observed during the proof. */
  caveats: string[];
}

// ---------------------------------------------------------------------------
// Representative inputs — one per grammar
// ---------------------------------------------------------------------------

const GRAMMAR_PROBES: ReadonlyArray<{ grammar: string; source: string; expectedRoot: string }> = [
  {
    grammar: "markdown",
    source: [
      "---",
      "title: Proof Note",
      "---",
      "",
      "# Heading 1",
      "",
      "Paragraph with **bold** and a [link](https://example.com).",
      "",
      "```ts",
      'const x: number = 42;',
      "```",
      "",
      "| Col A | Col B |",
      "|-------|-------|",
      "| 1     | 2     |",
    ].join("\n"),
    expectedRoot: "document",
  },
  {
    grammar: "json",
    source: '{"key": "value", "number": 42, "nested": {"a": [1, 2, 3]}}',
    expectedRoot: "document",
  },
  {
    grammar: "typescript",
    source: [
      'export interface Foo { bar: string; }',
      'export function greet(name: string): string { return `Hello, ${name}`; }',
    ].join("\n"),
    expectedRoot: "program",
  },
  {
    grammar: "tsx",
    source: [
      'import React from "react";',
      "export const App: React.FC = () => <div>Hello</div>;",
    ].join("\n"),
    expectedRoot: "program",
  },
  {
    grammar: "javascript",
    source: "function add(a, b) { return a + b; }\nconst result = add(1, 2);",
    expectedRoot: "program",
  },
  {
    grammar: "python",
    source: "def greet(name: str) -> str:\n    return f'Hello, {name}'\n\nclass Foo:\n    pass\n",
    expectedRoot: "module",
  },
  {
    grammar: "bash",
    source: '#!/bin/bash\necho "Hello World"\nfor i in 1 2 3; do\n  echo $i\ndone\n',
    expectedRoot: "program",
  },
  {
    grammar: "css",
    source: "body { margin: 0; }\n.container { display: flex; gap: 1rem; }",
    expectedRoot: "stylesheet",
  },
  {
    grammar: "yaml",
    source: "name: example\nversion: 1.0\ndependencies:\n  - foo\n  - bar\n",
    expectedRoot: "stream",
  },
  {
    grammar: "sql",
    source: "SELECT id, name FROM users WHERE active = true ORDER BY name;",
    expectedRoot: "program",
  },
  {
    grammar: "go",
    source: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello")\n}\n',
    expectedRoot: "source_file",
  },
];

// ---------------------------------------------------------------------------
// Byte offset validator
// ---------------------------------------------------------------------------

/** Recursively verify that all byte offsets are non-negative and startByte <= endByte. */
function validateByteOffsets(node: CstNode): boolean {
  if (node.startByte < 0 || node.endByte < 0 || node.startByte > node.endByte) {
    return false;
  }
  for (const child of node.children) {
    if (!validateByteOffsets(child)) {
      return false;
    }
  }
  return true;
}

/** Count all named nodes in a CST. */
function countNamedNodes(node: CstNode): number {
  let count = node.named ? 1 : 0;
  for (const child of node.children) {
    count += countNamedNodes(child);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Proof runner
// ---------------------------------------------------------------------------

/**
 * Run the full grammar runtime proof.
 *
 * Initialises the Rust tree-sitter bridge, then parses a representative
 * input for every compiled grammar. Returns a structured result suitable
 * for logging, assertion, or reporting.
 *
 * @param wasmBinarySize - Optional WASM binary size in bytes (pass from build metrics).
 */
export async function runRuntimeProof(
  wasmBinarySize: number | null = null,
): Promise<RuntimeProofResult> {
  const caveats: string[] = [];
  let initMs = 0;

  // --- Initialise bridge ---
  const initStart = performance.now();
  try {
    await initTreeSitterOnce();
    initMs = Math.round(performance.now() - initStart);
  } catch (err: unknown) {
    return {
      bridgeInitialised: false,
      initMs: Math.round(performance.now() - initStart),
      grammars: [],
      passCount: 0,
      failCount: GRAMMAR_PROBES.length,
      pass: false,
      wasmBinarySize,
      caveats: [`Bridge init failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!isTreeSitterReady()) {
    return {
      bridgeInitialised: false,
      initMs,
      grammars: [],
      passCount: 0,
      failCount: GRAMMAR_PROBES.length,
      pass: false,
      wasmBinarySize,
      caveats: ["isTreeSitterReady() returned false after init"],
    };
  }

  // --- Probe each grammar ---
  const results: GrammarProbeResult[] = [];

  for (const probe of GRAMMAR_PROBES) {
    const t0 = performance.now();
    try {
      const root = await parseCst(
        probe.grammar as Parameters<typeof parseCst>[0],
        probe.source,
      );
      const parseMs = Math.round(performance.now() - t0);
      const byteOffsetsValid = validateByteOffsets(root);
      const namedNodeCount = countNamedNodes(root);

      if (!byteOffsetsValid) {
        caveats.push(`${probe.grammar}: byte offsets invalid`);
      }

      results.push({
        grammar: probe.grammar,
        success: root.type === probe.expectedRoot && byteOffsetsValid,
        rootType: root.type,
        namedNodeCount,
        byteOffsetsValid,
        parseMs,
        error: root.type !== probe.expectedRoot
          ? `Expected root "${probe.expectedRoot}", got "${root.type}"`
          : null,
      });
    } catch (err: unknown) {
      results.push({
        grammar: probe.grammar,
        success: false,
        rootType: null,
        namedNodeCount: 0,
        byteOffsetsValid: false,
        parseMs: Math.round(performance.now() - t0),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passCount = results.filter((r) => r.success).length;
  const failCount = results.length - passCount;

  return {
    bridgeInitialised: true,
    initMs,
    grammars: results,
    passCount,
    failCount,
    pass: failCount === 0,
    wasmBinarySize,
    caveats,
  };
}

/**
 * Format a RuntimeProofResult as a human-readable string for logging.
 */
export function formatProofResult(result: RuntimeProofResult): string {
  const lines: string[] = [];
  lines.push("=== Zenith Patch Engine — Grammar Runtime Proof ===");
  lines.push("");
  lines.push(`Bridge initialised: ${result.bridgeInitialised ? "YES" : "NO"} (${result.initMs}ms)`);
  if (result.wasmBinarySize !== null) {
    lines.push(`WASM binary size: ${(result.wasmBinarySize / 1024 / 1024).toFixed(2)} MiB`);
  }
  lines.push("");
  lines.push("Grammar Results:");
  for (const g of result.grammars) {
    const status = g.success ? "✓" : "✗";
    const detail = g.error ?? `root=${g.rootType}, nodes=${g.namedNodeCount}, ${g.parseMs}ms`;
    lines.push(`  ${status} ${g.grammar}: ${detail}`);
  }
  lines.push("");
  lines.push(`Result: ${result.passCount}/${result.grammars.length} pass`);
  if (result.caveats.length > 0) {
    lines.push("");
    lines.push("Caveats:");
    for (const c of result.caveats) {
      lines.push(`  - ${c}`);
    }
  }
  lines.push(`\nOverall: ${result.pass ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}
