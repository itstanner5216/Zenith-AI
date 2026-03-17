/**
 * Core engine types for the Zenith Patch Engine.
 *
 * All structural coordinates use UTF-8 byte offsets.
 * These types are the canonical contract between the parser, matcher,
 * safety gates, edit transaction, and outline generator.
 */

// ---------------------------------------------------------------------------
// Node Types
// ---------------------------------------------------------------------------

/** Discriminated node types for the structural tree. */
export type NodeType =
  | "document"
  | "frontmatter"
  | "section"
  | "heading"
  | "paragraph"
  | "code_block"
  | "code_symbol"
  | "list"
  | "list_item"
  | "blockquote"
  | "table";

// ---------------------------------------------------------------------------
// Node Metadata
// ---------------------------------------------------------------------------

/** Metadata attached to every structural node. */
export interface NodeMetadata {
  /** Heading level (1–6) for heading nodes, section depth for sections. */
  level?: number;
  /** Human-readable label (heading text, symbol name, language tag, etc.). */
  label?: string;
  /** Language identifier for code_block / code_symbol nodes. */
  language?: string;
  /** Content hash exposed to the model. 8 hex chars by default, extended on collision. */
  hash?: string;
  /** Byte length of the raw excerpt used for outline display. */
  excerptBytes?: number;
  /** When true, symbol extraction was skipped for this code_block. */
  symbolsSkipped?: boolean;
  /** Reason symbol extraction was skipped. */
  skipReason?: "language_unsupported" | "block_oversized" | "parse_incomplete";
}

// ---------------------------------------------------------------------------
// Structural Node
// ---------------------------------------------------------------------------

/** A node in the structural tree representing a parseable document region. */
export interface StructuralNode {
  /** Unique identifier within the parsed document (deterministic). */
  id: string;
  /** Discriminated node type. */
  type: NodeType;
  /** Inclusive start byte offset (UTF-8). */
  startByte: number;
  /** Exclusive end byte offset (UTF-8). */
  endByte: number;
  /** Parent node id, or null for the document root. */
  parentId: string | null;
  /** Ordered child nodes. */
  children: StructuralNode[];
  /** Node-specific metadata. */
  metadata: NodeMetadata;
}

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------

/** A model-facing outline entry produced from the structural tree. */
export interface OutlineEntry {
  /** Content hash (8–12 hex chars, unique within the file). */
  hash: string;
  /** Node type. */
  type: NodeType;
  /** Human-readable label, truncated to `maxLabelChars`. */
  label: string;
  /** Nesting depth (0-based). */
  depth: number;
  /** Symbol names inside this node (for code_block / code_symbol). */
  symbols?: string[];
  /** When true, symbol extraction was skipped for this code_block. */
  symbolsSkipped?: boolean;
  /** Reason symbol extraction was skipped. */
  skipReason?: "language_unsupported" | "block_oversized" | "parse_incomplete";
  /** Byte-bounded excerpt of the node content. */
  excerpt?: string;
}

// ---------------------------------------------------------------------------
// Parsed Document
// ---------------------------------------------------------------------------

/** The result of parsing a source file into a structural tree. */
export interface ParsedDocument {
  /** Vault-relative file path. */
  path: string;
  /** First 16 hex chars of the SHA-256 hash of the raw file bytes. */
  sourceFileHash16: string;
  /** The byte-canonical source content. */
  bytes: import("./utils/byte-text").ByteText;
  /** Root node of the structural tree. */
  root: StructuralNode;
  /** Model-facing outline entries. */
  outline: OutlineEntry[];
  /** Number of parse errors in the baseline parse (before any edits). */
  baselineErrorCount: number;
  /** Whether the source was read from vault or an open editor buffer. */
  origin: "vault" | "editor";
}

// ---------------------------------------------------------------------------
// Edit Target
// ---------------------------------------------------------------------------

/** Targeting descriptor for an edit operation. */
export interface EditTarget {
  /** Direct content hash lookup (preferred). */
  hash?: string;
  /** Heading text anchor for scope narrowing. */
  heading?: string;
  /** Code block anchor for scope narrowing. */
  codeBlock?: {
    /** Language identifier filter. */
    language?: string;
    /** 0-based index among matching code blocks. */
    index?: number;
  };
  /** Symbol name within a code block. */
  symbol?: string;
  /** Exact substring match within a scoped region. */
  contains?: string;
  /** Target the frontmatter block. */
  frontmatter?: boolean;
  /** Target a table by index. */
  table?: {
    /** 0-based index among tables in the document. */
    index: number;
  };
}

// ---------------------------------------------------------------------------
// Edit Operations
// ---------------------------------------------------------------------------

/** The five supported edit operations. */
export type EditOperation =
  | "replace"
  | "insert_before"
  | "insert_after"
  | "append"
  | "delete";

/** A single edit request against a document. */
export interface EditDocumentRequest {
  /** Vault-relative file path. */
  path: string;
  /** File hash from a prior read (exactly 16 lowercase hex chars). */
  sourceFileHash16: string;
  /** Target node descriptor. */
  target: EditTarget;
  /** Edit operation to perform. */
  operation: EditOperation;
  /** Content for replace/insert/append operations. Ignored for delete. */
  content?: string;
  /** Human-readable reason for the edit. */
  reason: string;
}

/** A batch edit request (max 3 edits, single file, all-or-nothing). */
export interface BatchEditDocumentRequest {
  /** Vault-relative file path. */
  path: string;
  /** File hash from a prior read (exactly 16 lowercase hex chars). */
  sourceFileHash16: string;
  /** Array of edits to apply atomically (max 3). */
  edits: Array<{
    /** Target node descriptor. */
    target: EditTarget;
    /** Edit operation to perform. */
    operation: EditOperation;
    /** Content for replace/insert/append operations. Ignored for delete. */
    content?: string;
    /** Human-readable reason for the edit. */
    reason: string;
  }>;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/** Diagnostic codes emitted by the patch engine. */
export type DiagnosticCode =
  | "NEVER_READ"
  | "FILE_CHANGED"
  | "EDITOR_DIRTY"
  | "HASH_NOT_FOUND"
  | "AMBIGUOUS_TARGET"
  | "SYMBOL_TARGET_UNAVAILABLE"
  | "BUDGET_EXCEEDED"
  | "BOUNDARY_VIOLATION"
  | "STRUCTURE_BROKEN"
  | "PATH_UNSAFE"
  | "PATH_MISMATCH"
  | "OVERLAPPING_EDITS"
  | "WRITE_VERIFY_FAILED"
  | "RESTORE_FAILED"
  | "LOCK_LOST";

/** A machine-readable diagnostic returned on edit failure. */
export interface EditDiagnostic {
  /** Diagnostic code identifying the failure class. */
  code: DiagnosticCode;
  /** Short human-readable message. */
  shortMessage: string;
  /** Actionable hints for the model to recover. */
  hints: string[];
  /** Fresh outline attached when the file has changed. */
  currentOutline?: StructuralOutlineResult;
  /** Candidate nodes when target resolution is ambiguous. */
  candidates?: Array<{
    hash: string;
    type: string;
    label: string;
    excerpt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Structural Outline Result
// ---------------------------------------------------------------------------

/** The public outline response returned by read tools. */
export interface StructuralOutlineResult {
  /** Vault-relative file path. */
  path: string;
  /** First 16 hex chars of the file content hash. */
  sourceFileHash16: string;
  /** Whether the source was read from vault or editor buffer. */
  origin: "vault" | "editor";
  /** Ordered outline entries. */
  outline: OutlineEntry[];
}

// ---------------------------------------------------------------------------
// Preview / Apply Results
// ---------------------------------------------------------------------------

/** A diff hunk in the preview. */
export interface DiffHunk {
  /** Starting line number in the original. */
  oldStart: number;
  /** Number of lines in the original. */
  oldLines: number;
  /** Starting line number in the modified. */
  newStart: number;
  /** Number of lines in the modified. */
  newLines: number;
  /** The diff content lines (prefixed with +/-/space). */
  lines: string[];
}

/** Diff statistics. */
export interface DiffStats {
  /** Number of added lines. */
  additions: number;
  /** Number of deleted lines. */
  deletions: number;
  /** Number of unchanged lines in the diff context. */
  unchanged: number;
}

/** The result of a non-mutating preview operation. */
export interface PreviewResult {
  /** The original parsed document. */
  originalDoc: ParsedDocument;
  /** The proposed new file bytes after applying edits. */
  proposedBytes: import("./utils/byte-text").ByteText;
  /** Diff hunks for the affected scope. */
  hunks: DiffHunk[];
  /** Diff statistics. */
  stats: DiffStats;
  /** Change ratio (bytes changed / total bytes). */
  changeRatio: number;
  /** The match stage that resolved the target. */
  matchStage: "hash" | "anchor" | "contains_exact" | "fuzzy";
  /** Gate validation results. */
  gateResults: SafetyGateResult[];
  /** The matched target node. */
  matchedNode: StructuralNode;
  /** The edit request that produced this preview. */
  request: EditDocumentRequest;
}

/** The result of applying an edit to a file. */
export interface ApplyResult {
  /** Whether the apply succeeded. */
  success: boolean;
  /** The new file hash after successful write. */
  newSourceFileHash16?: string;
  /** Fresh outline after successful write. */
  newOutline?: StructuralOutlineResult;
  /** Diagnostic on failure. */
  diagnostic?: EditDiagnostic;
}

// ---------------------------------------------------------------------------
// Safety Gates
// ---------------------------------------------------------------------------

/** Result from a single safety gate check. */
export interface SafetyGateResult {
  /** Name of the gate. */
  gate: string;
  /** Whether the gate passed. */
  passed: boolean;
  /** Diagnostic emitted on failure. */
  diagnostic?: EditDiagnostic;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/** An undo entry representing a single successful apply. */
export interface UndoEntry {
  /** Vault-relative file path. */
  path: string;
  /** The file bytes before the edit was applied. */
  previousBytes: Uint8Array;
  /** The file hash before the edit. */
  previousHash: string;
  /** The file hash after the edit. */
  newHash: string;
  /** Timestamp of the apply. */
  timestamp: number;
  /** Human-readable reason from the edit request. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Source Snapshot
// ---------------------------------------------------------------------------

/** A snapshot of file content at a point in time. */
export interface SourceSnapshot {
  /** Vault-relative file path. */
  path: string;
  /** File content as a string. */
  content: string;
  /** Whether the content was read from vault or editor buffer. */
  origin: "vault" | "editor";
  /** Whether this snapshot can be written to (false when editor is dirty). */
  writable: boolean;
}

// ---------------------------------------------------------------------------
// Match Result
// ---------------------------------------------------------------------------

/** Result of the node matching pipeline. */
export interface MatchResult {
  /** Whether a unique match was found. */
  status: "matched" | "not_found" | "ambiguous";
  /** Which stage of the pipeline produced the result. */
  stage: "hash" | "anchor" | "contains_exact" | "fuzzy";
  /** The matched node (when status is "matched"). */
  node?: StructuralNode;
  /** Candidate nodes (when status is "ambiguous"). */
  candidates?: Array<{
    hash: string;
    type: string;
    label: string;
    excerpt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Outline Caps (constants)
// ---------------------------------------------------------------------------

/** Maximum number of outline nodes returned to the model. */
export const OUTLINE_MAX_NODES = 250;

/** Maximum number of symbols reported per code block. */
export const OUTLINE_MAX_SYMBOLS_PER_CODE_BLOCK = 25;

/** Maximum character length for outline labels. */
export const OUTLINE_MAX_LABEL_CHARS = 120;

/** Maximum byte length for outline excerpts. */
export const OUTLINE_MAX_EXCERPT_BYTES = 160;

// ---------------------------------------------------------------------------
// Budget Thresholds (provisional — replace after calibration)
// ---------------------------------------------------------------------------

/** PROVISIONAL — Single edit file-change ratio threshold. */
export const BUDGET_SINGLE_EDIT_RATIO = 0.35; // provisional — validate against calibration corpus

/** PROVISIONAL — Batch edit file-change ratio threshold. */
export const BUDGET_BATCH_EDIT_RATIO = 0.45; // provisional — validate against calibration corpus

/** PROVISIONAL — Target expansion ratio threshold. */
export const BUDGET_EXPANSION_RATIO = 4.0; // provisional — validate against calibration corpus

// ---------------------------------------------------------------------------
// Cache Defaults (constants)
// ---------------------------------------------------------------------------

/** Maximum number of entries in the AST cache. */
export const CACHE_MAX_ENTRIES = 128;

/** Maximum total bytes of cached parsed documents. */
export const CACHE_MAX_TOTAL_BYTES = 32 * 1024 * 1024; // 32 MiB

/** Files larger than this are not cached. */
export const CACHE_MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MiB

// ---------------------------------------------------------------------------
// Undo Defaults
// ---------------------------------------------------------------------------

/** Maximum undo stack depth per file. */
export const UNDO_MAX_DEPTH = 6;

// ---------------------------------------------------------------------------
// Code Block Limits (provisional)
// ---------------------------------------------------------------------------

/** Maximum code block byte size for symbol extraction. PROVISIONAL — validate against fixture corpus. */
export const MAX_CODE_BLOCK_BYTES = 32768; // 32 KB — provisional
