// ---------------------------------------------------------------------------
// CstNode — mirrors the Rust CstNode struct from lib.rs
// ---------------------------------------------------------------------------

/** A concrete syntax tree node serialized from the Rust tree-sitter bridge. */
export interface CstNode {
  /** tree-sitter node type (e.g. "document", "heading", "paragraph"). */
  readonly type: string;
  /** Whether this is a named node (vs anonymous punctuation). */
  readonly named: boolean;
  /** UTF-8 byte offset of the node start. */
  readonly startByte: number;
  /** UTF-8 byte offset of the node end. */
  readonly endByte: number;
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
  /** Source text covered by this node. */
  readonly text: string;
  readonly children: readonly CstNode[];
}

// ---------------------------------------------------------------------------
// Bridge interface & loading
// ---------------------------------------------------------------------------

export interface RustTreeSitterBridge {
  parse_markdown(source: string): string;
  parse_json(source: string): string;
  parse_typescript(source: string): string;
  parse_tsx(source: string): string;
  parse_javascript(source: string): string;
  parse_python(source: string): string;
  parse_bash(source: string): string;
  parse_css(source: string): string;
  parse_yaml(source: string): string;
  parse_sql(source: string): string;
  parse_go(source: string): string;
}

let bridgePromise: Promise<RustTreeSitterBridge> | null = null;
let bridgeReady = false;

async function loadBridge(): Promise<RustTreeSitterBridge> {
  const env = require("./runtime/rust-tree-sitter-host-env.cjs");
  const mod = await import("./runtime/rust-tree-sitter-bridge/pkg/rust_tree_sitter_bridge.js");
  if (typeof env.__bindWasmExports === "function") {
    env.__bindWasmExports((mod as { __wasm?: unknown }).__wasm ?? mod);
  }
  if (typeof mod.default === "function") {
    await (mod.default as unknown as () => Promise<void>)();
  }
  return mod as unknown as RustTreeSitterBridge;
}

export async function initTreeSitterOnce(): Promise<void> {
  if (bridgePromise !== null) {
    await bridgePromise;
    return;
  }

  bridgePromise = loadBridge();
  await bridgePromise;
  bridgeReady = true;
}

export function isTreeSitterReady(): boolean {
  return bridgeReady;
}

export async function getRustTreeSitterBridge(): Promise<RustTreeSitterBridge> {
  await initTreeSitterOnce();
  if (bridgePromise === null) {
    throw new Error("rust tree-sitter bridge failed to initialise");
  }
  return bridgePromise;
}

// ---------------------------------------------------------------------------
// Convenience: parse → CstNode
// ---------------------------------------------------------------------------

export type Grammar = "json" | "markdown" | "typescript" | "tsx" | "javascript" | "python" | "bash" | "css" | "yaml" | "sql" | "go";

/** Raw JSON shape returned by the Rust bridge (snake_case). */
interface RawCstNode {
  type: string;
  named: boolean;
  start_byte: number;
  end_byte: number;
  start_row: number;
  start_col: number;
  end_row: number;
  end_col: number;
  text: string;
  children: RawCstNode[];
}

function convertNode(raw: RawCstNode): CstNode {
  return {
    type: raw.type,
    named: raw.named,
    startByte: raw.start_byte,
    endByte: raw.end_byte,
    startRow: raw.start_row,
    startCol: raw.start_col,
    endRow: raw.end_row,
    endCol: raw.end_col,
    text: raw.text,
    children: raw.children.map(convertNode),
  };
}

/**
 * Parse source text and return the full CST with UTF-8 byte offsets.
 *
 * This is the primary parse API for the patch engine. All node byte
 * offsets are guaranteed to be UTF-8 byte positions (from Rust
 * tree-sitter, not JavaScript string indices).
 */
export async function parseCst(
  grammar: Grammar,
  source: string,
): Promise<CstNode> {
  const bridge = await getRustTreeSitterBridge();
  const parseFn = bridge[`parse_${grammar}`] as ((source: string) => string) | undefined;
  if (parseFn === undefined) {
    throw new Error(`Unsupported grammar: ${grammar}`);
  }
  const raw = parseFn.call(bridge, source);

  const parsed = JSON.parse(raw) as RawCstNode;
  return convertNode(parsed);
}

// ---------------------------------------------------------------------------
// Tree-walking helpers
// ---------------------------------------------------------------------------

/** Collect all named descendant nodes matching a given type. */
export function collectNodesByType(root: CstNode, nodeType: string): CstNode[] {
  const results: CstNode[] = [];
  function walk(node: CstNode): void {
    if (node.named && node.type === nodeType) {
      results.push(node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return results;
}

/** Collect all descendant nodes (named and anonymous). */
export function collectAllNodes(root: CstNode): CstNode[] {
  const results: CstNode[] = [];
  function walk(node: CstNode): void {
    results.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return results;
}
