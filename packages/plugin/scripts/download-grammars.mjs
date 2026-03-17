#!/usr/bin/env node
/**
 * Download pre-built tree-sitter grammar WASM files for every entry in
 * grammar-manifest.json.
 *
 * Usage:
 *   node scripts/download-grammars.mjs
 *   pnpm run grammars:download
 *
 * For each manifest entry the script attempts, in order:
 *   1. Fetch a pre-built .wasm from the grammar repo's GitHub releases
 *      matching the pinned sourceRef tag.
 *   2. If no pre-built release exists, log a clear error with instructions
 *      for building from source using the tree-sitter CLI.
 *
 * The downloaded files are placed in packages/plugin/grammars/ and should
 * be committed to the repo (bundled grammars only — no runtime downloads).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dir, "..");
const GRAMMARS_DIR = join(PLUGIN_DIR, "grammars");
const MANIFEST_PATH = join(
  PLUGIN_DIR,
  "services/patch-engine/runtime/grammar-manifest.json",
);

mkdirSync(GRAMMARS_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));

/**
 * Attempt to download a pre-built grammar WASM from GitHub releases.
 *
 * Convention: many tree-sitter grammar repos publish release assets named
 * `<grammar-id>.wasm` or `tree-sitter-<id>.wasm` on their GitHub release
 * matching the pinned tag.
 */
async function downloadGrammar(entry) {
  const { id, wasmPath, sourceRepo, sourceRef } = entry;
  const dest = join(GRAMMARS_DIR, wasmPath);

  if (existsSync(dest)) {
    console.log(`  ✓ ${id} — already present (${wasmPath})`);
    return true;
  }

  // Try common GitHub release asset URL patterns
  const urls = [
    `https://github.com/${sourceRepo}/releases/download/${sourceRef}/${wasmPath}`,
    `https://github.com/${sourceRepo}/releases/download/${sourceRef}/${id}.wasm`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(dest, buf);
        console.log(`  ✓ ${id} — downloaded from ${url}`);
        return true;
      }
    } catch {
      // Try next URL pattern
    }
  }

  console.error(
    `  ✗ ${id} — no pre-built WASM found for ${sourceRepo}@${sourceRef}\n` +
    `    Build from source:\n` +
    `      git clone https://github.com/${sourceRepo} /tmp/${id}\n` +
    `      cd /tmp/${id} && git checkout ${sourceRef}\n` +
    `      tree-sitter build --wasm . && cp ${wasmPath} ${dest}\n`,
  );
  return false;
}

console.log(`Downloading grammar WASMs from manifest (${manifest.length} entries)...\n`);

let failed = 0;
for (const entry of manifest) {
  const ok = await downloadGrammar(entry);
  if (!ok) failed++;
}

console.log();
if (failed > 0) {
  console.error(`${failed} grammar(s) could not be downloaded. See above for manual build instructions.`);
  process.exit(1);
} else {
  console.log("All grammar WASMs are present.");
}
