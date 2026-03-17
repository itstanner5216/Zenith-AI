# Zenith Patch Engine — Definitive Execution Plan

## Summary
Build Zenith Patch Engine as a portable core editing engine with an Obsidian adapter layer. The engine will expose structural outlines with content hashes, require `sourceFileHash16` on every edit request, resolve targets deterministically, preview edits client-side, and only write through a per-file locked, verified atomic path.

This plan is intentionally ordered to de-risk the hardest unknowns first:
1. Prove the real Obsidian/WASM runtime and markdown grammar path.
2. Build the read path and outline contract before any write logic.
3. Build deterministic matching and hard safety gates before fallback behavior.
4. Ship preview-only shadow mode before enabling writes.
5. Remove legacy editing tools only after measurable release gates pass.

## Locked Decisions Used In This Plan
- Bundled grammars only; no runtime downloads.
- Rust tree-sitter bridge (compiled to WASM via `wasm-bindgen`) with all grammars statically linked.
- `ByteText` byte-canonical core using `Uint8Array`, `TextEncoder`, `TextDecoder`.
- Frontmatter and tables are opaque whole-block targets.
- Operations are `replace`, `insert_before`, `insert_after`, `append`, `delete`.
- Batch edits are single-file only, max 3, all-or-nothing.
- Undo is session-scoped, depth 6 per file, one entry per successful apply.
- Diff algorithm is Myers only in v1.
- Incremental parsing is scaffolded but disabled by default.
- Open-editor vs saved-vault mismatch fails closed with `EDITOR_DIRTY`.
- Change-budget threshold ships only after calibration; provisional dev threshold is allowed behind write-disabled shadow mode.

## Key Public Interfaces

```ts
export interface StructuralOutlineResult {
  path: string;
  sourceFileHash16: string;
  origin: "vault" | "editor";
  outline: OutlineEntry[];
}

export interface EditDocumentRequest {
  path: string;
  sourceFileHash16: string;
  target: EditTarget;
  operation: "replace" | "insert_before" | "insert_after" | "append" | "delete";
  content?: string;
  reason: string;
}

export interface BatchEditDocumentRequest {
  path: string;
  sourceFileHash16: string;
  edits: Array<{
    target: EditTarget;
    operation: "replace" | "insert_before" | "insert_after" | "append" | "delete";
    content?: string;
    reason: string;
  }>;
}

export interface EditDiagnostic {
  code:
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
  shortMessage: string;
  hints: string[];
  currentOutline?: StructuralOutlineResult;
  candidates?: Array<{ hash: string; type: string; label: string; excerpt: string }>;
}
```

## Architecture
```text
read/open file
  -> SourceResolver
  -> ParserManager
  -> DocumentParser
  -> HashRegistry
  -> OutlineGenerator
  -> ASTCache

edit preview
  -> NodeMatcher
  -> SafetyGates
  -> EditTransaction
  -> DiffBuilder
  -> PatchDiffPreview

apply
  -> FileLockManager
  -> FileWriter(Vault.process + verify)
  -> UndoManager
  -> cache refresh
```

## Phase 0 — Runtime Proof And Rollout Guardrails

### Task 0.1 — Prove Rust tree-sitter bridge inside the real plugin runtime
Files:
- `packages/plugin/package.json`
- `packages/plugin/esbuild.config.mjs`
- `packages/plugin/services/patch-engine/rust-tree-sitter-runtime.ts`
- `packages/plugin/services/patch-engine/runtime/rust-tree-sitter-bridge/Cargo.toml`
- `packages/plugin/services/patch-engine/runtime/rust-tree-sitter-bridge/src/lib.rs`
- `packages/plugin/scripts/build-rust-tree-sitter-bridge.mjs`

Steps:
- Build a Rust crate targeting `wasm32-unknown-unknown` that statically links tree-sitter grammar crates for:
  - markdown
  - typescript
  - tsx
  - javascript
  - python
  - json
  - yaml
  - bash
  - css
  - sql
  - go
- Compile to WASM via `cargo build --release`, bind via `wasm-bindgen --target nodejs`.
- Provide a host-env shim for C stdlib functions required by grammar scanners.
- Expose one `parse_{grammar}(source: &str) -> String` function per grammar, returning full CST as JSON with UTF-8 byte offsets.
- Wrap in TypeScript: `parseCst(grammar: Grammar, source: string): Promise<CstNode>`.
- Block the rest of the project until markdown grammar parses successfully in the running plugin.

Snippet:
```ts
export type Grammar = "json" | "markdown" | "typescript" | "tsx" | "javascript" | "python" | "bash" | "css" | "yaml" | "sql" | "go";

export interface CstNode {
  readonly type: string;
  readonly named: boolean;
  readonly startByte: number;
  readonly endByte: number;
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
  readonly text: string;
  readonly children: readonly CstNode[];
}

export async function parseCst(grammar: Grammar, source: string): Promise<CstNode>;
```

### Task 0.2 — Add feature flags and shadow-mode controls
Files:
- `packages/plugin/services/patch-engine/config.ts`

Steps:
- Add `enablePatchEnginePreview`, `enablePatchEngineWrites`, `enableFallbackScanner`, `enableIncrementalParsing`.
- Defaults:
  - preview: `true`
  - writes: `false`
  - fallback scanner: `true`
  - incremental parsing: `false`

Snippet:
```ts
export interface PatchEngineFlags {
  enablePatchEnginePreview: boolean;
  enablePatchEngineWrites: boolean;
  enableFallbackScanner: boolean;
  enableIncrementalParsing: boolean;
}
```

### Task 0.3 — Obsidian Markdown Compatibility Matrix
Files:
- `packages/plugin/services/patch-engine/testing/fixtures/obsidian/*.md`
- `docs/obsidian-markdown-compat.md`
- `packages/plugin/services/patch-engine/parsers/obsidian-syntax-policy.ts`

Steps:
- Create fixtures for callouts, wiki-links, embeds, Dataview blocks, Templater syntax, MathJax, nested blockquotes, and mixed markdown notes.
- Classify each construct for v1 as one of:
  - **structurally supported** — parsed into its own `StructuralNode`, targetable by hash
  - **preserved as inline content** — stays inside its parent paragraph/section node, not independently targetable
  - **treated as opaque block** — gets its own node but only whole-block replace/delete allowed (same policy as frontmatter/tables)
  - **unsupported/fail-closed** — engine does not attempt to parse; edits to regions containing this construct require manual handling
- Define outline behavior for each construct: whether it appears as its own outline entry, stays inside a parent entry, or is excluded from targeting.
- Add regression tests that prove edits preserve byte correctness around these constructs (especially multi-byte wiki-link targets and MathJax delimiters).
- Exit criteria: every Obsidian-specific syntax has an explicit v1 policy and at least one fixture-backed test.

### Task 0.4 — tree-sitter Markdown CST Discovery Spike
Files:
- `packages/plugin/scripts/inspect-markdown-cst.ts`
- `packages/plugin/services/patch-engine/testing/fixtures/cst/*.md`
- `docs/tree-sitter-markdown-node-map.md`

Steps:
- Run the chosen markdown grammar against 10–15 representative fixtures in the real plugin/runtime stack, including:
  - standard headings, frontmatter, tables, fenced code blocks
  - code blocks inside list items and blockquotes
  - fixtures from Task 0.3 (Obsidian-specific syntax)
  - malformed/partial markdown
- Capture actual node types and tree shape for each fixture.
- Write a mapping table from CST node types to the `StructuralNode` model (`tree-sitter node type → NodeType`).
- Add snapshot-style tests so parser assumptions stay locked as grammars change (snapshot the CST output; break the build if the grammar produces different structure).
- Exit criteria: `DocumentParser` is implemented from observed CST output, not inferred structure.

### Task 0.5 — Grammar Runtime Proof in Obsidian

This is a separate blocker from CST verification. The Rust bridge WASM binary must load, bundle, and parse in the actual Electron/Obsidian environment before the engine is built on top of it.

Steps:
- Load the Rust bridge WASM binary in the live plugin (not just a Node.js test harness).
- Parse a minimal note and a real vault note (at least one with frontmatter, headings, and code blocks).
- Record bridge crate version, WASM binary size, and any runtime caveats (memory, load time, async behavior).
- Verify the grammar crate versions in Cargo.toml match the expected versions.
- Block later phases until this passes.
- Exit criteria: markdown grammar loads, parses, and produces expected CST in a running Obsidian plugin, not just in tests.

Phase 0 exit criteria:
- Markdown grammar loads in Obsidian (Task 0.5 proof, not just Task 0.1 bundling).
- Rust bridge WASM binary bundles cleanly.
- Preview shadow mode can be turned on with writes still disabled.
- Every Obsidian-specific markdown construct has a v1 policy (Task 0.3).
- CST-to-StructuralNode mapping table exists and is snapshot-locked (Task 0.4).

## Phase 1 — Host Abstraction And Byte-Correct Core

### Task 1.1 — Define host adapters and source resolution
Files:
- `packages/plugin/services/patch-engine/adapters.ts`
- `packages/plugin/services/patch-engine/obsidian-adapters.ts`
- `packages/plugin/services/patch-engine/source-resolver.ts`

Steps:
- Create `FileSystemAdapter` and `EditorBufferAdapter`.
- Implement Obsidian adapters.
- Add `SourceResolver` with the following rules:
  - If no open editor exists, read vault content.
  - If editor content exists and equals vault bytes, origin is `vault`.
  - If editor content exists and differs from vault bytes, return origin `editor` for outline generation, but mark the snapshot as not directly writable.
- Apply path rule:
  - if open editor bytes differ from current vault bytes at apply time, reject with `EDITOR_DIRTY`.

Snippet:
```ts
export interface FileSystemAdapter {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): boolean;
  stat(path: string): { size: number; mtime: number } | null;
}

export interface EditorBufferAdapter {
  getOpenContent(path: string): string | null;
  isOpen(path: string): boolean;
}

export interface SourceSnapshot {
  path: string;
  content: string;
  origin: "vault" | "editor";
  writable: boolean;
}
```

### Task 1.1a — Source of Truth and Dirty-Editor Rules
Files:
- `packages/plugin/services/patch-engine/source-resolver.ts`
- `packages/plugin/services/patch-engine/testing/editor-dirty.test.ts`

Steps:
- Define whether preview reads from editor content, vault content, or both:
  - If the file is open in an editor, read from editor buffer (this is what the user sees).
  - If the file is not open, read from vault.
  - Store `origin: "vault" | "editor"` on every `ParsedDocument` and `SourceSnapshot`.
- Define exact `EDITOR_DIRTY` behavior:
  - At **preview time**: if editor bytes differ from vault bytes, use editor bytes for preview but include `origin: "editor"` and `editorDirty: true` in the response so the model knows the state.
  - At **apply time**: if editor bytes differ from vault bytes, reject with `EDITOR_DIRTY` and return both hashes. Do not silently write vault content that would overwrite unsaved editor changes.
  - If editor bytes match vault bytes, proceed normally.
- `EditorBufferAdapter.getOpenContent(path)` must iterate `app.workspace.getLeavesOfType('markdown')` — not just `app.workspace.activeLeaf` — to find content from any open pane, tab, or popout window.
- Test multi-pane scenarios explicitly:
  - File open in two split panes (same content)
  - File open in editor but modified (dirty)
  - File not open in any editor
  - File open in a popout window
- Make write enablement depend on this policy being stable (source-resolver behavior must not change after writes are enabled without re-running dirty-editor tests).
- Exit criteria: no ambiguity about what content the engine is previewing or writing against.

### Task 1.2 — Introduce `ByteText`
Files:
- `packages/plugin/services/patch-engine/utils/byte-text.ts`

Steps:
- Use `Uint8Array`, not `Buffer`, in the core engine.
- Support:
  - `fromString`
  - `fromBytes`
  - `toBytes`
  - `toString`
  - `sliceBytes`
  - `detectNewlineStyle`
  - bounded excerpt decode
- Keep all structural coordinates in UTF-8 byte offsets only.

Snippet:
```ts
export class ByteText {
  static fromString(text: string): ByteText;
  static fromBytes(bytes: Uint8Array): ByteText;
  toBytes(): Uint8Array;
  toString(): string;
  sliceBytes(startByte: number, endByte: number): Uint8Array;
  detectNewlineStyle(): "\n" | "\r\n" | "mixed";
}
```

### Task 1.3 — Define core engine types
Files:
- `packages/plugin/services/patch-engine/types.ts`

Steps:
- Define:
  - `StructuralNode`
  - `OutlineEntry`
  - `ParsedDocument`
  - `EditTarget`
  - `EditDocumentRequest`
  - `BatchEditDocumentRequest`
  - `PreviewResult`
  - `ApplyResult`
  - `UndoEntry`
  - `EditDiagnostic`
- Add `code_symbol` as a real node type, not just metadata.
- Store only byte ranges in nodes; do not store full node content on every node unless needed for hashing/excerpts.

Snippet:
```ts
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

export interface StructuralNode {
  id: string;
  type: NodeType;
  startByte: number;
  endByte: number;
  parentId: string | null;
  children: StructuralNode[];
  metadata: NodeMetadata;
}
```

Phase 1 exit criteria:
- Core engine compiles without Obsidian imports outside adapter modules.
- Byte utilities are testable independently.

## Phase 2 — Parser, Fallback Scanner, Hashing, Outline, Cache

### Task 2.1 — Implement `ParserManager`
Files:
- `packages/plugin/services/patch-engine/parsers/parser-manager.ts`
- `packages/plugin/services/patch-engine/index.ts`

Steps:
- Initialize the Rust bridge once via `initTreeSitterOnce()`.
- All grammars are statically compiled into the bridge — no lazy loading needed.
- Expose `parseMarkdown(source: string): Promise<CstNode>` and `parseLanguage(grammar: Grammar, source: string): Promise<CstNode | null>`.
- `parseLanguage` returns `null` for unsupported grammars (those not compiled into the bridge).
- Dispose is a no-op (WASM module is process-scoped); keep the method for interface symmetry.

Snippet:
```ts
export class ParserManager {
  async initialize(): Promise<void>;
  async parseMarkdown(source: string): Promise<CstNode>;
  async parseLanguage(grammar: Grammar, source: string): Promise<CstNode | null>;
  getSupportedGrammars(): readonly Grammar[];
  dispose(): void;
}
```

### Task 2.2 — Implement markdown fallback scanner
Files:
- `packages/plugin/services/patch-engine/parsers/markdown-fallback-scanner.ts`

Steps:
- Scan headings, frontmatter, fenced code blocks, tables, and paragraphs.
- Ignore heading markers inside code fences.
- Support code fences with no language tag.
- Support code fences nested inside list items and blockquotes by tracking fence state, not indentation alone.
- Use this scanner only when markdown grammar load or parse output is unusable.

Snippet:
```ts
export interface FallbackNode {
  type: "frontmatter" | "heading" | "code_block" | "table" | "paragraph";
  startByte: number;
  endByte: number;
  label?: string;
  level?: number;
  language?: string;
}
```

### Task 2.3 — Build `DocumentParser`
Files:
- `packages/plugin/services/patch-engine/parsers/document-parser.ts`
- `packages/plugin/services/patch-engine/parsers/symbol-extractors/typescript.ts`
- `packages/plugin/services/patch-engine/parsers/symbol-extractors/python.ts`

Steps:
- Parse markdown into structural nodes.
- Section grouping algorithm:
  - create a synthetic root section
  - for each heading, pop until the nearest lower heading level exists
  - attach the new section there
- Handle:
  - empty files
  - files with no headings
  - single-heading files
  - H1→H4 jumps
  - duplicate heading text at same level
  - list-contained and blockquote-contained code blocks
- Parse supported code blocks and emit top-level `code_symbol` nodes with absolute file byte ranges.
- Unsupported language or oversized code block:
  - keep `code_block`
  - skip `code_symbol` extraction
- Unsupported/oversized block policy:
  - Supported languages for symbol extraction: those compiled into the Rust bridge crate (`Cargo.toml` dependencies). Currently: markdown, JSON, TypeScript, TSX, JavaScript, Python, Bash, CSS, YAML, SQL, Go. Adding a language means adding a `tree-sitter-{lang}` crate dependency and a corresponding `parse_{lang}` export in `lib.rs`. All others are unsupported.
  - Oversized threshold: `maxCodeBlockBytes = 32768` (32 KB). Blocks exceeding this skip symbol extraction regardless of language. **PROVISIONAL — validate against fixture corpus from Tasks 0.3/0.4.**
  - Partial parse failure: if tree-sitter parse produces `ERROR` nodes covering >50% of block bytes, treat as parse failure and skip symbol extraction. **PROVISIONAL — validate against fixture corpus.**
- When symbol extraction is skipped (any reason):
  - Node type stays `code_block` (never promoted to parent of `code_symbol` children).
  - `symbol` anchor targeting against this block returns `SYMBOL_TARGET_UNAVAILABLE` (not `HASH_NOT_FOUND`) with:
    - `reason`: `"language_unsupported"` | `"block_oversized"` | `"parse_incomplete"`
    - `retryHint`: `"Target this block by its code_block hash instead"`
    - `blockHash`: the `code_block` node's hash for immediate retry
  - Outline entry includes `symbolsSkipped: true` and `skipReason` so the model knows not to attempt symbol-level edits.

Snippet:
```ts
export interface ParsedDocument {
  path: string;
  sourceFileHash16: string;
  bytes: ByteText;
  root: StructuralNode;
  outline: OutlineEntry[];
  baselineErrorCount: number;
  origin: "vault" | "editor";
}
```

### Task 2.4 — Implement content hashing and deterministic disambiguation
Files:
- `packages/plugin/services/patch-engine/hashing/content-hasher.ts`
- `packages/plugin/services/patch-engine/hashing/hash-registry.ts`

Steps:
- File hash:
  - raw file bytes
  - expose first 16 hex chars as `sourceFileHash16`
- Node hash normalization:
  - normalize `\r\n` to `\n`
  - trim trailing whitespace per line
  - preserve indentation and inner whitespace
- Node hash exposure:
  - default 8 chars
  - extend to 10 or 12 on true collision
- Identical-content duplicate nodes:
  - disambiguate deterministically in the registry using occurrence order within the file
  - exposed model-facing hash must still be unique per node
- Log:
  - true collisions
  - duplicate-content disambiguations

Snippet:
```ts
export class HashRegistry {
  register(doc: ParsedDocument): void;
  lookup(hash: string): StructuralNode | null;
  listDuplicateContentEvents(): DuplicateContentEvent[];
  listCollisionEvents(): HashCollisionEvent[];
}
```

### Task 2.5 — Generate structural outlines
Files:
- `packages/plugin/services/patch-engine/outline/outline-generator.ts`

Steps:
- Produce model-facing outline entries with:
  - hash
  - type
  - label
  - depth
  - symbol names
- Add outline caps:
  - `maxNodes = 250`
  - `maxSymbolsPerCodeBlock = 25`
  - `maxLabelChars = 120`
  - `maxExcerptBytes = 160`
- If caps are exceeded:
  - truncate low-priority detail
  - keep headings and code blocks over paragraphs
- Include `sourceFileHash16` and `origin`.

### Task 2.6 — Implement AST cache with byte-budget LRU
Files:
- `packages/plugin/services/patch-engine/cache/ast-cache.ts`

Steps:
- Initial defaults:
  - `maxEntries = 128`
  - `maxTotalBytes = 32 * 1024 * 1024`
  - do not cache parsed docs whose raw file size exceeds `1 MiB`
- Cache key is `(path, sourceFileHash16)`.
- On eviction or invalidation:
  - dispose stored trees
  - clear registry references
- After successful write:
  - immediately refresh active entry rather than waiting for vault events

Phase 2 exit criteria:
- Read tools can produce outlines for all edge-case fixture types.
- Hashes are unique per node within a file.
- Large-file cache behavior is bounded.

## Phase 3 — Matching, Diagnostics, And Safety Gates

### Task 3.0 — Request Contract Enforcement
Files:
- `packages/web/app/api/(newai)/chat/tools.ts`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/edit-document-handler.tsx`
- `packages/plugin/services/patch-engine/session/read-registry.ts`
- `packages/plugin/services/patch-engine/testing/request-contract.test.ts`

Steps:
- Make `sourceFileHash16` schema-required for both single and batch edit tools, with strict format validation (exactly 16 hex chars, lowercase).
- Implement an in-session read registry keyed by `(path, sourceFileHash16, origin)`:
  - Populated only by read/open tool results (outline, file-read responses).
  - Entries expire when a new read for the same path produces a different hash.
  - Never populated by edit results — the model must read again after editing.
- Reject preview or apply when the submitted hash was never issued by a prior read for that path, even if the request is otherwise well-formed. Return `NEVER_READ` with `retryHint: "Request the file outline first to obtain a valid sourceFileHash16"`.
- Reject unsafe targeting patterns early (before matching):
  - Missing hash plus broad anchors → reject
  - Fuzzy match request without a narrowed scope → reject
  - Path mismatch between the read that produced the hash and the edit path → reject with `PATH_MISMATCH`
  - Cross-file hash replay (hash from file A used in edit to file B) → reject
- Add tests for:
  - Missing hash (schema rejection)
  - Malformed hash (format validation)
  - Never-read hash (registry rejection)
  - Stale hash (registry expiry)
  - Wrong path (path mismatch)
  - Cross-file replay
- Exit criteria: model compliance is enforced by the request path, not just the system prompt.

### Task 3.1 — Implement deterministic `NodeMatcher`
Files:
- `packages/plugin/services/patch-engine/matching/node-matcher.ts`
- `packages/plugin/services/patch-engine/matching/byte-search.ts`
- `packages/plugin/services/patch-engine/matching/fuzzy-matcher.ts`

Steps:
- Match pipeline:
  - direct hash lookup
  - structural anchor narrowing
  - exact scoped `contains`
  - fuzzy scoped fallback
- Fuzzy rules:
  - only allowed after scope narrows to a single section or a single code block
  - use Damerau-Levenshtein
  - minimum similarity `0.85`
  - minimum margin over second-best `0.10`
- Ambiguity behavior:
  - return candidates
  - never auto-select
- `symbol` target resolves to `code_symbol` node when present; otherwise fail, do not guess inside raw code blocks.

Snippet:
```ts
export interface MatchResult {
  status: "matched" | "not_found" | "ambiguous";
  stage: "hash" | "anchor" | "contains_exact" | "fuzzy";
  node?: StructuralNode;
  candidates?: Array<{ hash: string; type: string; label: string; excerpt: string }>;
}
```

### Task 3.2 — Implement six hard safety gates
Files:
- `packages/plugin/services/patch-engine/gates/safety-gates.ts`
- `packages/plugin/services/patch-engine/gates/change-budget.ts`
- `packages/plugin/services/patch-engine/gates/boundary-respect.ts`
- `packages/plugin/services/patch-engine/gates/structural-integrity.ts`
- `packages/plugin/services/patch-engine/gates/path-safety.ts`

Steps:
- Gate 1: `NEVER_READ`
  - reject when `sourceFileHash16` is missing
- Gate 2: `FILE_CHANGED`
  - reject when current vault hash differs from request hash
  - return fresh outline
- Gate 3: `BUDGET_EXCEEDED`
  - provisional shadow-mode default:
    - single edit file-change ratio `0.35`
    - batch file-change ratio `0.45`
    - target expansion ratio `4.0`
  - mark these as temporary until calibration replaces them
- Gate 4: `BOUNDARY_VIOLATION`
  - compute the editable scope:
    - `code_symbol` if matched
    - else `code_block`
    - else parent section
  - ensure the edit remains fully inside that scope
- Gate 5: `STRUCTURE_BROKEN`
  - compare proposed parse error count against baseline
  - reject only when new catastrophic parse errors are added
  - if the target is code inside a supported fenced block, also parse that code content
- Gate 6: `PATH_UNSAFE`
  - canonicalize path
  - reject traversal and out-of-vault paths
  - optionally require prior in-session read registration
- Extra source rule:
  - if editor buffer exists and its bytes differ from current vault bytes at preview or apply time, return `EDITOR_DIRTY`

Snippet:
```ts
export class SafetyGates {
  async validate(
    request: EditDocumentRequest,
    match: StructuralNode,
    doc: ParsedDocument,
    snapshot: SourceSnapshot
  ): Promise<SafetyGateResult[]>;
}
```

Phase 3 exit criteria:
- All failure modes return machine-readable diagnostics.
- No ambiguous match is ever auto-applied.
- Dirty-editor conflicts fail closed.

## Phase 4 — Edit Transactions, Diff Preview, Write Path, Undo

### Task 4.1 — Implement byte-accurate operations
Files:
- `packages/plugin/services/patch-engine/engine/operations.ts`
- `packages/plugin/services/patch-engine/utils/byte-splicer.ts`

Steps:
- Convert each operation into one `ByteEdit`.
- Preserve file newline style when inserting.
- Treat frontmatter and table nodes as whole-block only for `replace` and `delete`.
- Normalize after the full transaction only:
  - preserve dominant newline style
  - collapse 4+ blank lines to 3
  - ensure file ends with exactly one newline

Snippet:
```ts
export interface ByteEdit {
  startByte: number;
  endByte: number;
  insertText: string;
}

export function spliceBytes(src: ByteText, edit: ByteEdit): ByteText;
```

### Task 4.2 — Implement batch transaction processor
Files:
- `packages/plugin/services/patch-engine/engine/edit-transaction.ts`
- `packages/plugin/services/patch-engine/engine/batch-processor.ts`

Steps:
- Enforce `edits.length <= 3`.
- Resolve all targets first.
- Reject overlapping target byte ranges with `OVERLAPPING_EDITS`.
- Sort descending by `startByte`.
- Apply bottom-up.
- Reparse once at the end.
- Produce one preview and one undo entry for the batch.

### Task 4.3 — Implement Myers diff preview
Files:
- `packages/plugin/services/patch-engine/diff/diff-builder.ts`
- `packages/plugin/views/assistant/ai-chat/components/patch-diff-preview.tsx`

Steps:
- Diff only the affected scope, not the entire file.
- Surface:
  - file path
  - target label
  - match stage
  - gate summary
  - additions/deletions
  - change ratio
- UI must never display hashes in chat bubbles.

Snippet:
```ts
export interface DiffResult {
  hunks: DiffHunk[];
  stats: { additions: number; deletions: number; unchanged: number };
  changeRatio: number;
}
```

### Task 4.4 — Implement verified atomic writer and undo
Files:
- `packages/plugin/services/patch-engine/io/file-lock-manager.ts`
- `packages/plugin/services/patch-engine/io/file-writer.ts`
- `packages/plugin/services/patch-engine/undo/undo-manager.ts`

Steps:
- `FileLockManager` provides queue semantics per path.
- Under lock:
  - read current vault bytes
  - compare with request hash
  - compare open editor bytes, if any
  - reject on dirty mismatch
  - capture recovery snapshot in transient context (see Task 4.4a)
  - call `Vault.process`
  - reread file
  - verify written hash equals intended hash
  - on success: commit undo entry to user undo stack (see Task 4.4a)
  - on failure: restore from recovery snapshot (see Task 4.4a)
- Track self-writes:
  - mark path during write
  - clear after direct cache refresh completes
- Undo:
  - use same writer path
  - one successful apply = one undo entry
  - max depth `6`

Snippet:
```ts
export class FileLockManager {
  async withLock<T>(path: string, fn: () => Promise<T>): Promise<T>;
}

export class FileWriter {
  async apply(preview: PreviewResult): Promise<ApplyResult>;
  isSelfWrite(path: string): boolean;
}
```

### Task 4.4a — Write Verification and Recovery Semantics
Files:
- `packages/plugin/services/patch-engine/io/file-writer.ts`
- `packages/plugin/services/patch-engine/undo/undo-manager.ts`
- `packages/plugin/services/patch-engine/testing/write-recovery.test.ts`

Steps:
- Clarify the write-verify-recover sequence inside the file lock (extends Task 4.4):
  1. Under lock, read current vault bytes and verify request hash.
  2. Capture a **recovery snapshot** (pre-write bytes + hash) in a transient recovery context — NOT in the user undo stack.
  3. Call `Vault.process` to write.
  4. Re-read the file and hash-verify that written content equals intended content.
  5. **On verification success**:
     - Discard the recovery snapshot (no longer needed).
     - Commit an undo entry to the user undo stack (one successful apply = one undo entry, per Task 4.4).
     - Invalidate and refresh the AST cache entry for this path.
  6. **On verification failure** (`written hash ≠ intended hash`):
     - Read the recovery snapshot (step 2).
     - Write the snapshot bytes back via `Vault.process` (restore).
     - Re-read and verify the restore by comparing hash to the recovery snapshot hash.
     - Do NOT commit any undo entry — the apply never succeeded, so there is nothing for the user to undo.
     - Discard the recovery snapshot.
     - Invalidate the AST cache entry for this path (force full reparse on next access).
     - Return `WRITE_VERIFY_FAILED` with `retryHint: "File was restored to pre-edit state. Re-read the file and retry."`.
     - If the restore verification also fails, return `RESTORE_FAILED` with both hashes (intended and actual). Do NOT retry. Surface the error to the user.
  7. **On lock loss** (if the file lock cannot be held through the full write+verify+restore sequence):
     - Return `LOCK_LOST`. Do not attempt partial recovery without the lock.
     - Log the event for diagnostics.
- The file lock MUST be held for the entire sequence (steps 1–7). No unlock between write and verify.
- Add injected-failure tests:
  - Mid-write exception (simulate `Vault.process` throwing) → verify no partial write, recovery snapshot discarded, undo stack unchanged.
  - Post-write hash mismatch (simulate corrupted write) → verify restore occurs, no undo entry committed, `WRITE_VERIFY_FAILED` returned.
  - Restore failure (simulate double corruption) → verify `RESTORE_FAILED` returned, no infinite retry loop.
  - Lock timeout during recovery → verify `LOCK_LOST` returned.
- Exit criteria: every write failure mode has a defined recovery path and a test that exercises it.

Phase 4 exit criteria:
- Preview is non-mutating.
- Apply is fully serialized per file.
- Undo restores exact previous file bytes.

## Phase 5 — Tool Integration, Prompt Migration, Lifecycle, Shadow Mode

### Task 5.1 — Extend read tools to return outlines
Files:
- `packages/plugin/views/assistant/ai-chat/tool-handlers/metadata-handler.tsx`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/open-file-handler.tsx`

Steps:
- Return:
  - file content
  - `sourceFileHash16`
  - `origin`
  - structural outline
- Strip outline and hashes from human chat rendering.
- Cache parsed document on read.

### Task 5.2 — Add new edit tool schemas
Files:
- `packages/web/app/api/(newai)/chat/tools.ts`

Steps:
- Add `editDocument`.
- Add `batchEditDocument`.
- Require `sourceFileHash16` in both.
- Keep legacy edit schemas registered until cutover gates pass.

Snippet:
```ts
const editDocumentSchema = z.object({
  path: z.string(),
  sourceFileHash16: z.string(),
  target: z.object({
    hash: z.string().optional(),
    heading: z.string().optional(),
    codeBlock: z.object({
      language: z.string().optional(),
      index: z.number().optional(),
    }).optional(),
    symbol: z.string().optional(),
    contains: z.string().optional(),
    frontmatter: z.boolean().optional(),
    table: z.object({ index: z.number() }).optional(),
  }),
  operation: z.enum(["replace", "insert_before", "insert_after", "append", "delete"]),
  content: z.string().optional(),
  reason: z.string(),
});
```

### Task 5.3 — Build preview/apply handlers
Files:
- `packages/plugin/views/assistant/ai-chat/tool-handlers/edit-document-handler.tsx`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/batch-edit-document-handler.tsx`
- `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`

Steps:
- Preview flow:
  - validate request
  - fetch cached or fresh parsed document
  - resolve target
  - run gates
  - build preview
- Apply flow:
  - require explicit user apply
  - call writer
  - refresh cache
  - return success/failure payload to model
- Chat UI:
  - human-facing message shows only semantic result
  - hashes stay in tool payloads only

### Task 5.4 — Update system prompt
Files:
- `packages/web/lib/prompts/chat-prompt.ts`

Steps:
- Remove old edit-tool instructions.
- Add required workflow:
  - always read first
  - always include `sourceFileHash16`
  - prefer hash targets
  - never use line numbers
  - never reproduce large `old_str` text to locate targets
  - use batch only for up to 3 disjoint edits
  - retry using `currentOutline` on failure

### Task 5.5 — Wire plugin lifecycle and shadow mode
Files:
- `packages/plugin/services/patch-engine/patch-engine.ts`
- `packages/plugin/index.ts`

Steps:
- Initialize `PatchEngine` on plugin load.
- Register vault events:
  - modify
  - delete
  - rename
- Ignore modify events caused by self-writes until direct cache refresh is done.
- Enable shadow mode:
  - previews on
  - writes off
  - old editing tools still available
- Do not delete legacy writers in this phase.

Phase 5 exit criteria:
- New engine previews work in the live plugin.
- Human UI stays hash-free.
- Legacy tools still exist as fallback.

## Phase 6 — Testing, Calibration, Release Gates, Cutover

### Task 6.1 — Add automated tests with `node:test`
Files:
- `packages/plugin/services/patch-engine/testing/host-adapter-mock.ts`
- `packages/plugin/services/patch-engine/testing/*.test.ts`
- `packages/plugin/package.json`

Steps:
- Use `node:test`.
- Add unit and integration suites for:
  - hash generation and disambiguation
  - byte splicing
  - markdown parsing
  - code symbol extraction
  - outline generation caps
  - matcher ambiguity
  - all safety gates
  - batch overlap rejection
  - file locking
  - undo
  - `EDITOR_DIRTY`

### Task 6.2 — Add deterministic fuzz/property tests
Files:
- `packages/plugin/services/patch-engine/testing/fuzz-splice.test.ts`
- `packages/plugin/services/patch-engine/testing/fuzz-batch.test.ts`

Steps:
- Generate Unicode-heavy fixtures:
  - emoji
  - CJK
  - surrogate pairs
  - CRLF/LF mixes
- Generate valid non-overlapping edits.
- Verify:
  - unaffected byte ranges remain unchanged
  - result decodes cleanly
  - undo restores exact original bytes

### Task 6.3 — Build calibration corpus and thresholds
Files:
- `packages/plugin/services/patch-engine/testing/corpus/`
- `packages/plugin/services/patch-engine/testing/change-budget-calibration.test.ts`
- `packages/plugin/services/patch-engine/diagnostics/perf-log.ts`

Steps:
- Collect 40-60 representative markdown/code files.
- Add scenario buckets:
  - legitimate edits
  - suspicious edits
  - adversarial edits
- Measure:
  - change ratio
  - parse time
  - match time
  - gate time
  - diff time
- Replace provisional budget threshold with a measured default before enabling writes.

### Task 6.4 — Define and enforce release gates
Files:
- `packages/plugin/services/patch-engine/testing/release-gates.md`

Steps:
- Require:
  - zero wrong-target accepts on curated bad cases
  - zero UTF-8 corruption failures
  - 100% stale-read rejection in staged conflict tests
  - p95 pipeline time under 5 seconds on benchmark corpus
- Keep `enablePatchEngineWrites = false` until gates pass.
- Only after gates pass:
  - remove legacy tool schemas
  - remove old handlers
  - remove old second-call modify endpoint if present

## Non-MVP Items Explicitly Deferred
- WAL-style crash recovery and idempotency persistence.
- Multi-file transactions.
- Histogram or Patience diff shipping in v1.
- Incremental parsing enabled by default.
- Semantic or embedding-based matching.
- Persistent undo across sessions.

## Test Scenarios That Must Exist Before Cutover
- Empty file.
- No headings.
- Single heading.
- H1→H4 jump.
- Duplicate heading text at same level.
- Paragraph duplicates with identical normalized content.
- Fenced code block with no language tag.
- Code block inside list item.
- Code block inside blockquote.
- Frontmatter whole-block replace.
- Table whole-block replace.
- Emoji and CJK adjacent to edit boundaries.
- CRLF preservation.
- File over 1000 lines.
- Two simultaneous applies to the same file.
- Preview against editor content followed by apply against changed vault content.
- Batch edit with reverse-order normalization hazard.

## Synthesis Notes
- Plan 4 supplied the winning core architecture: `ByteText`, hard `sourceFileHash16`, bounded matching, LRU byte-budget, and performance instrumentation.
- Plan 1 supplied the strongest integration shape: adapters, prompt migration, lifecycle wiring, and detailed task decomposition.
- Plan 2 supplied the strongest write-path hardening: post-write verification, self-write suppression, and better batch undo semantics.
- Plan 3 contributed useful caution on fuzzy matching and large-file memory behavior, but its WAL/idempotency and heuristic diff switching were rejected as too expensive for v1.
- Added in this synthesis because all four missed them or left them under-specified:
  - `EDITOR_DIRTY`
  - Cargo.toml grammar dependencies
  - outline-size caps
  - shadow mode with writes disabled
  - release gates
  - normalize-once-after-batch rule

## Risk Assessment
| Rank | Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---:|---|
| 1 | Byte splice corruption around multi-byte boundaries | Medium | Critical | `ByteText`, byte-only ranges, deterministic fuzz tests, Unicode-heavy corpus |
| 2 | Editor buffer differs from vault at apply time and causes clobber risk | Medium | Critical | `EDITOR_DIRTY`, revalidation under lock, fail-closed apply path |
| 3 | Markdown grammar fails in real Obsidian runtime | Medium | Critical | Phase 0 runtime spike, fallback scanner, pinned Cargo.toml grammar crate versions |
| 4 | Cache invalidation race after rapid writes | Medium | High | direct cache refresh, self-write suppression, hash-keyed cache entries |
| 5 | Budget threshold either blocks good edits or allows unsafe edits | High | Medium | provisional shadow-mode threshold only, measured calibration before write enablement |

## Testing Strategy Suggestions
- Use a real vault-derived corpus early; toy markdown is not enough for this engine.
- Track success metrics during shadow mode:
  - preview success rate
  - stale rejection rate
  - ambiguity rate
  - dirty-editor rejection rate
  - p95 pipeline timing
- Add “wrong target challenge” fixtures where many nodes share similar text.
- Test identical-content node disambiguation as its own category.
- Treat “preview succeeded but apply rejected” as a first-class metric during shadow mode; it will expose source-of-truth issues quickly.
