/**
 * Grammar manifest for web-tree-sitter grammars used by the patch engine.
 *
 * Each entry pins a specific grammar source repository, git ref, license,
 * and the expected wasm asset filename resolved at runtime.
 */

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
 * Pinned grammar manifest.
 *
 * Every grammar listed here must have its `.wasm` asset placed in the
 * plugin's runtime directory before it can be loaded.
 */
export const GRAMMAR_MANIFEST: readonly GrammarManifestEntry[] = [
  {
    id: "markdown",
    wasmPath: "tree-sitter-markdown.wasm",
    sourceRepo: "tree-sitter-grammars/tree-sitter-markdown",
    sourceRef: "v0.4.1",
    license: "MIT",
  },
  {
    id: "typescript",
    wasmPath: "tree-sitter-typescript.wasm",
    sourceRepo: "tree-sitter/tree-sitter-typescript",
    sourceRef: "v0.23.2",
    license: "MIT",
  },
  {
    id: "tsx",
    wasmPath: "tree-sitter-tsx.wasm",
    sourceRepo: "tree-sitter/tree-sitter-typescript",
    sourceRef: "v0.23.2",
    license: "MIT",
  },
  {
    id: "javascript",
    wasmPath: "tree-sitter-javascript.wasm",
    sourceRepo: "tree-sitter/tree-sitter-javascript",
    sourceRef: "v0.23.1",
    license: "MIT",
  },
  {
    id: "python",
    wasmPath: "tree-sitter-python.wasm",
    sourceRepo: "tree-sitter/tree-sitter-python",
    sourceRef: "v0.23.6",
    license: "MIT",
  },
  {
    id: "json",
    wasmPath: "tree-sitter-json.wasm",
    sourceRepo: "tree-sitter/tree-sitter-json",
    sourceRef: "v0.24.8",
    license: "MIT",
  },
  {
    id: "yaml",
    wasmPath: "tree-sitter-yaml.wasm",
    sourceRepo: "tree-sitter-grammars/tree-sitter-yaml",
    sourceRef: "v0.7.0",
    license: "MIT",
  },
  {
    id: "bash",
    wasmPath: "tree-sitter-bash.wasm",
    sourceRepo: "tree-sitter/tree-sitter-bash",
    sourceRef: "v0.23.3",
    license: "MIT",
  },
  {
    id: "css",
    wasmPath: "tree-sitter-css.wasm",
    sourceRepo: "tree-sitter/tree-sitter-css",
    sourceRef: "v0.23.2",
    license: "MIT",
  },
  {
    id: "sql",
    wasmPath: "tree-sitter-sql.wasm",
    sourceRepo: "DerekStride/tree-sitter-sql",
    sourceRef: "v0.3.3",
    license: "MIT",
  },
] as const;
