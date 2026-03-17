/**
 * Grammar manifest for web-tree-sitter grammars used by the patch engine.
 *
 * The single source of truth is `grammar-manifest.json` in this directory.
 * This module re-exports it with TypeScript types. Both the esbuild build
 * pipeline and runtime code consume the same JSON, eliminating manifest/build
 * drift.
 *
 * @see ./grammar-manifest.json
 */

import manifestData from "./grammar-manifest.json";

/** Describes a single tree-sitter grammar and its provenance. */
export interface GrammarManifestEntry {
  /** Language identifier (e.g. "typescript"). */
  id: string;
  /** Filename of the compiled .wasm grammar asset. */
  wasmPath: string;
  /** GitHub repository that hosts the grammar source. */
  sourceRepo: string;
  /** Pinned git ref (tag or commit) for reproducibility. */
  sourceRef: string;
  /** SPDX license identifier of the grammar. */
  license: string;
}

/**
 * Pinned grammar manifest derived from `grammar-manifest.json`.
 *
 * Every grammar listed here must have its `.wasm` asset in the plugin's
 * `grammars/` source directory before building. The build will fail if
 * any asset is missing.
 */
export const GRAMMAR_MANIFEST: readonly GrammarManifestEntry[] = manifestData;
