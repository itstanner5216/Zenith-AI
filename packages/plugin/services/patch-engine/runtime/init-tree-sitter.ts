/**
 * Tree-sitter runtime initialisation for the Obsidian plugin.
 *
 * Initialises web-tree-sitter exactly once, resolving the parser wasm binary
 * from the plugin's own directory (Electron / Obsidian environment).
 * The markdown grammar is loaded eagerly during init so that the rest of the
 * patch-engine pipeline can assume it is available.
 *
 * @module
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS bundle, untyped external
const TreeSitterModule = require("web-tree-sitter") as typeof import("web-tree-sitter");

import type { default as ParserType } from "web-tree-sitter";
import { GRAMMAR_MANIFEST } from "./grammar-manifest";

// ---------------------------------------------------------------------------
// Diagnostics (no console.log)
// ---------------------------------------------------------------------------

/** Structured diagnostic produced during initialisation. */
export interface InitDiagnostic {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
}

const diagnostics: InitDiagnostic[] = [];

function emitDiagnostic(level: InitDiagnostic["level"], message: string): void {
  diagnostics.push({ level, message, timestamp: Date.now() });
}

/** Returns a snapshot of all diagnostics emitted during initialisation. */
export function getInitDiagnostics(): readonly InitDiagnostic[] {
  return [...diagnostics];
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;
let initSucceeded = false;

/** The shared parser instance, available after successful init. */
let parserInstance: ParserType | null = null;

/** The eagerly-loaded markdown language, available after successful init. */
let markdownLanguage: ParserType.Language | null = null;

// ---------------------------------------------------------------------------
// Wasm resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute filesystem path for a `.wasm` grammar asset.
 *
 * In Obsidian's Electron environment the plugin directory is available via
 * `app.vault.adapter.basePath` + `.obsidian/plugins/<id>/`.  We fall back to
 * `__dirname` (the esbuild CJS output directory) which works for both
 * development and production builds.
 */
function resolveWasmPath(wasmFilename: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- Node path module
  const path = require("path") as typeof import("path");
  return path.join(__dirname, wasmFilename);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise web-tree-sitter and eagerly load the markdown grammar.
 *
 * This function is idempotent — the first call performs the actual work and
 * subsequent calls return the same settled promise.  If initialisation fails
 * the error is propagated and {@link isTreeSitterReady} remains `false`.
 *
 * @throws If the tree-sitter wasm binary or the markdown grammar cannot be loaded.
 */
export async function initTreeSitterOnce(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }

  initPromise = doInit();
  return initPromise;
}

/**
 * Returns `true` after {@link initTreeSitterOnce} has completed successfully.
 */
export function isTreeSitterReady(): boolean {
  return initSucceeded;
}

/**
 * Returns the shared parser instance.
 *
 * @throws If called before successful initialisation.
 */
export function getParser(): ParserType {
  if (parserInstance === null) {
    throw new Error("tree-sitter has not been initialised — call initTreeSitterOnce() first");
  }
  return parserInstance;
}

/**
 * Returns the eagerly-loaded markdown language.
 *
 * @throws If called before successful initialisation.
 */
export function getMarkdownLanguage(): ParserType.Language {
  if (markdownLanguage === null) {
    throw new Error("markdown language not available — call initTreeSitterOnce() first");
  }
  return markdownLanguage;
}

// ---------------------------------------------------------------------------
// Internal init sequence
// ---------------------------------------------------------------------------

async function doInit(): Promise<void> {
  emitDiagnostic("info", "tree-sitter init starting");

  // 1. Initialise the wasm runtime ------------------------------------------
  try {
    await TreeSitterModule.init();
    emitDiagnostic("info", "tree-sitter wasm runtime initialised");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    emitDiagnostic("error", `tree-sitter wasm init failed: ${msg}`);
    throw err;
  }

  // 2. Create the parser instance -------------------------------------------
  parserInstance = new TreeSitterModule();

  // 3. Eagerly load the markdown grammar ------------------------------------
  const mdEntry = GRAMMAR_MANIFEST.find((g) => g.id === "markdown");
  if (mdEntry === undefined) {
    const msg = "markdown grammar not found in manifest";
    emitDiagnostic("error", msg);
    throw new Error(msg);
  }

  try {
    const wasmPath = resolveWasmPath(mdEntry.wasmPath);
    emitDiagnostic("info", `loading markdown grammar from ${wasmPath}`);
    markdownLanguage = await TreeSitterModule.Language.load(wasmPath);
    parserInstance.setLanguage(markdownLanguage);
    emitDiagnostic("info", "markdown grammar loaded and set on parser");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    emitDiagnostic("error", `failed to load markdown grammar: ${msg}`);
    throw err;
  }

  initSucceeded = true;
  emitDiagnostic("info", "tree-sitter init complete");
}
