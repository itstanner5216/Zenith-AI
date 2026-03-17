#!/usr/bin/env node
/**
 * Post-build smoke test: verifies every grammar WASM listed in the manifest
 * exists in the plugin output directory.
 *
 * Usage:
 *   node scripts/verify-grammar-assets.mjs [outdir]
 *
 * Defaults to checking `../../` (local dev output) or `dist/` (CI).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dir, "..");
const MANIFEST_PATH = join(
  PLUGIN_DIR,
  "services/patch-engine/runtime/grammar-manifest.json",
);

const isCI = process.env.GITHUB_ACTIONS === "true";
const outdir = process.argv[2] || (isCI ? "dist" : join(PLUGIN_DIR, "../.."));
const absOut = resolve(outdir);

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));

let failed = 0;

// 1. Check tree-sitter runtime WASM
const runtimePath = join(absOut, "tree-sitter.wasm");
if (existsSync(runtimePath)) {
  console.log(`✅ tree-sitter.wasm (runtime)`);
} else {
  console.error(`❌ tree-sitter.wasm (runtime) — missing at ${runtimePath}`);
  failed++;
}

// 2. Check each grammar WASM
for (const entry of manifest) {
  const grammarPath = join(absOut, "grammars", entry.wasmPath);
  if (existsSync(grammarPath)) {
    console.log(`✅ ${entry.id} — ${entry.wasmPath}`);
  } else {
    console.error(`❌ ${entry.id} — missing at ${grammarPath}`);
    failed++;
  }
}

console.log();
if (failed > 0) {
  console.error(
    `${failed} WASM asset(s) missing from output. ` +
    `Run \`pnpm run grammars:download\` then rebuild.`
  );
  process.exit(1);
} else {
  console.log(`All ${manifest.length + 1} WASM assets verified in ${absOut}`);
}
