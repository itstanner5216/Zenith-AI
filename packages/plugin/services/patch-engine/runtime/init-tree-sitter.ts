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

import type { Parser, Language } from "web-tree-sitter";
import { GRAMMAR_MANIFEST } from "./grammar-manifest";

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS bundle; web-tree-sitter has no ESM entry
const TreeSitter = require("web-tree-sitter") as {
  Parser: {
    new (): Parser;
    init(moduleOptions?: { locateFile: (scriptName: string) => string }): Promise<void>;
  };
  Language: {
    load(input: string | Uint8Array): Promise<Language>;
  };
};

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
let parserInstance: Parser | null = null;

/** The eagerly-loaded markdown language, available after successful init. */
let markdownLanguage: Language | null = null;

// ---------------------------------------------------------------------------
// Wasm resolution
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires -- Node path module
const nodePath = require("path") as typeof import("path");

/** Subdirectory under the plugin bundle where grammar wasm files are placed. */
const GRAMMARS_SUBDIR = "grammars";

/**
 * Resolve the absolute filesystem path for the tree-sitter runtime WASM.
 *
 * The runtime WASM (`tree-sitter.wasm`) is copied to the same directory as
 * `main.js` by the esbuild copy plugin. `__dirname` points to the esbuild
 * CJS output directory, which in Obsidian is the plugin's install folder
 * (e.g., `.obsidian/plugins/zenith-ai/`).
 */
function resolveRuntimeWasmDir(): string {
  return __dirname;
}

/**
 * Resolve the absolute filesystem path for a grammar `.wasm` asset.
 *
 * Grammar WASMs are placed in a `grammars/` subdirectory next to `main.js`
 * by the esbuild copy plugin.
 */
function resolveGrammarWasmPath(wasmFilename: string): string {
  return nodePath.join(__dirname, GRAMMARS_SUBDIR, wasmFilename);
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
export function getParser(): Parser {
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
export function getMarkdownLanguage(): Language {
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

  // 1. Initialise the wasm runtime with explicit path -------------------------
  //    Pass locateFile so Parser.init() loads tree-sitter.wasm from the plugin
  //    directory rather than relying on Emscripten's default resolution, which
  //    would fail in Obsidian's Electron sandbox.
  const runtimeDir = resolveRuntimeWasmDir();
  try {
    await TreeSitter.Parser.init({
      locateFile(scriptName: string): string {
        return nodePath.join(runtimeDir, scriptName);
      },
    });
    emitDiagnostic("info", `tree-sitter wasm runtime initialised from ${runtimeDir}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    emitDiagnostic("error", `tree-sitter wasm init failed: ${msg}`);
    throw err;
  }

  // 2. Create the parser instance -------------------------------------------
  parserInstance = new TreeSitter.Parser();

  // 3. Eagerly load the markdown grammar ------------------------------------
  const mdEntry = GRAMMAR_MANIFEST.find((g) => g.id === "markdown");
  if (mdEntry === undefined) {
    const msg = "markdown grammar not found in manifest";
    emitDiagnostic("error", msg);
    throw new Error(msg);
  }

  try {
    const wasmPath = resolveGrammarWasmPath(mdEntry.wasmPath);
    emitDiagnostic("info", `loading markdown grammar from ${wasmPath}`);
    markdownLanguage = await TreeSitter.Language.load(wasmPath);
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
