# Rust Tree-Sitter WASM Viability Spike Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Determine whether a minimal Rust-to-WASM bridge using the official `tree-sitter` crate can be built and exercised inside the plugin workspace while preserving UTF-8 byte offsets at the JavaScript boundary.

**Architecture:** Create a tiny isolated Rust crate under the plugin package, expose one minimal parse function for JSON and one for TypeScript through `wasm-bindgen`, drive it from a failing `node:test` harness, and verify both buildability and returned offset semantics against multi-byte input.

**Tech Stack:** Rust, cargo, `wasm-bindgen`, `wasm32-unknown-unknown`, Node.js, `node:test`, plugin worktree

---

### Task 1: Add a failing Rust/WASM viability test

**Files:**
- Create: `packages/plugin/spikes/rust-tree-sitter-viability.test.ts`

**Step 1: Write the failing test**

Encode the required viability property:
- load a future JS wrapper for the Rust/WASM module
- parse JSON containing `é🎉`
- parse TypeScript containing `é🎉`
- assert returned root indices equal UTF-8 byte lengths, not JS string lengths

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test spikes/rust-tree-sitter-viability.test.ts`
Expected: FAIL because the wrapper/module does not exist yet.

### Task 2: Install Rust/WASM tooling

**Files:**
- No tracked files required unless setup notes are needed

**Step 1: Add required Rust target**

Install `wasm32-unknown-unknown` if missing.

**Step 2: Add `wasm-bindgen` CLI if missing**

Install the CLI required to generate JS glue for the `.wasm` output.

**Step 3: Verify toolchain**

Run:
- `rustup target list --installed`
- `wasm-bindgen --version`

Expected: target and CLI available.

### Task 3: Create the minimal Rust bridge crate

**Files:**
- Create: `packages/plugin/spikes/rust-tree-sitter-bridge/Cargo.toml`
- Create: `packages/plugin/spikes/rust-tree-sitter-bridge/src/lib.rs`

**Step 1: Write minimal Rust implementation**

The crate should:
- depend on official `tree-sitter`
- depend on one or two grammar crates
- export one minimal function via `wasm-bindgen`
- accept source text
- return:
  - grammar name
  - UTF-8 byte length
  - reported root start/end byte offsets

Keep the returned payload tiny and JSON-serializable.

**Step 2: Build the WASM**

Run cargo build for `wasm32-unknown-unknown`, then run `wasm-bindgen` to emit JS glue and final `.wasm`.

### Task 4: Add the JS wrapper and rerun the test

**Files:**
- Create: `packages/plugin/spikes/rust-tree-sitter-viability.ts`

**Step 1: Add thin JS loader**

Load the generated `.wasm`/JS glue and expose a single JS function that the test can call.

**Step 2: Run the failing test again**

Run: `node --import tsx --test spikes/rust-tree-sitter-viability.test.ts`
Expected: PASS if the Rust/WASM path returns true UTF-8 byte offsets.

### Task 5: Record the verdict

**Files:**
- Create: `docs/plans/2026-03-17-rust-tree-sitter-viability-results.md`

**Step 1: Summarize**

Capture:
- whether the Rust/WASM bridge built successfully
- whether JS could load it
- whether reported indices matched UTF-8 bytes
- whether the experiment introduced obvious packaging friction

**Step 2: Final recommendation**

State one of:
- viable now
- viable with moderate bridge work
- not viable for this plugin path
