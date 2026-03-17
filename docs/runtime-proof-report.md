# Grammar Runtime Proof Report — Task 0.5

> Generated from the automated runtime proof at
> `packages/plugin/services/patch-engine/testing/runtime-proof.test.ts`

## Proof Status: ✅ PASS

All 11 grammar crates compiled into the Rust tree-sitter bridge load,
parse representative input, and produce structurally valid CSTs with
correct UTF-8 byte offsets.

## Bridge Metrics

| Metric | Value |
|--------|-------|
| WASM binary size | 8.30 MiB |
| Bridge init time | <100 ms (first call) |
| Bridge crate version | `rust-tree-sitter-bridge` v0.1.0 |
| tree-sitter core | v0.25.10 (resolved from `"0.25"`) |
| wasm-bindgen | v0.2.114 |
| Target | `wasm32-unknown-unknown` |
| Binding | `wasm-bindgen --target nodejs` |

## Grammar Crate Versions (from Cargo.lock)

| Grammar | Crate | Resolved Version | Source |
|---------|-------|-----------------|--------|
| markdown | `tree-sitter-md` | 0.5.3 | crates.io |
| json | `tree-sitter-json` | 0.24.8 | crates.io |
| typescript | `tree-sitter-typescript` | 0.23.2 | crates.io |
| tsx | `tree-sitter-typescript` | 0.23.2 | crates.io (same crate) |
| javascript | `tree-sitter-javascript` | 0.25.0 | crates.io |
| python | `tree-sitter-python` | 0.25.0 | crates.io |
| bash | `tree-sitter-bash` | 0.25.1 | crates.io |
| css | `tree-sitter-css` | 0.25.0 | crates.io |
| yaml | `tree-sitter-yaml` | 0.7.2 | crates.io |
| sql | `tree-sitter-sequel` | 0.3.11 | git (DerekStride/tree-sitter-sql) |
| go | `tree-sitter-go` | 0.25.0 | crates.io |

## Per-Grammar Probe Results

| Grammar | Root Type | Named Nodes | Parse Time | Byte Offsets |
|---------|-----------|-------------|------------|--------------|
| markdown | `document` | 27 | 4 ms | ✅ valid |
| json | `document` | 22 | 1 ms | ✅ valid |
| typescript | `program` | 25 | 1 ms | ✅ valid |
| tsx | `program` | 22 | 1 ms | ✅ valid |
| javascript | `program` | 19 | <1 ms | ✅ valid |
| python | `module` | 22 | 1 ms | ✅ valid |
| bash | `program` | 18 | <1 ms | ✅ valid |
| css | `stylesheet` | 21 | 1 ms | ✅ valid |
| yaml | `stream` | 32 | <1 ms | ✅ valid |
| sql | `program` | 29 | 1 ms | ✅ valid |
| go | `source_file` | 20 | <1 ms | ✅ valid |

## Markdown-Specific Proof

The markdown grammar correctly identifies:
- Frontmatter (`minus_metadata`)
- ATX headings (`atx_heading`) with section nesting
- Fenced code blocks (`fenced_code_block`) with `info_string`
- Paragraphs with inline formatting
- Pipe tables

This matches the CST-to-StructuralNode mapping table in
`docs/tree-sitter-markdown-node-map.md`.

## Runtime Caveats

1. **WASM binary size (8.30 MiB)**: The bridge bundles 10 grammar crates
   (11 languages) into a single WASM binary. This is loaded once at plugin
   startup and cached for the session. Size is acceptable for a desktop
   Electron app but would need lazy loading for web deployment.

2. **Synchronous WASM instantiation**: The bridge uses
   `new WebAssembly.Module()` + `new WebAssembly.Instance()` (synchronous).
   Obsidian/Electron allows this for CJS modules. If async instantiation is
   needed in the future, the bridge JS can be patched to use
   `WebAssembly.compile()` + `WebAssembly.instantiate()`.

3. **Host-env shim**: The WASM module imports C stdlib functions
   (`iswspace`, `iswalpha`, `towlower`, `strcmp`, etc.) from a host-env
   shim (`rust-tree-sitter-host-env.cjs`). This shim must be bundled
   alongside the bridge JS. esbuild handles this via CJS require().

4. **C++ scanner grammars**: Python and YAML grammars use C++ scanners.
   The build requires Emscripten's `clang++` for WASM compilation.
   Once compiled, the C++ code is in the WASM binary and has no additional
   runtime requirements.

5. **Stub header patching**: The `tree-sitter-language` v0.1.7 crate ships
   minimal C stdlib stub headers that shadow the Emscripten sysroot.
   The build script (`build-rust-tree-sitter-bridge.mjs`) patches these
   stubs before every build. If `tree-sitter-language` is updated, the
   version in the patch path must be updated accordingly.

## WASM Deployment

The esbuild config copies `rust_tree_sitter_bridge_bg.wasm` to the output
directory alongside `main.js`. The bridge JS locates the WASM file via
`__dirname` at runtime. This works in Obsidian because:
- The plugin is loaded from `.obsidian/plugins/{plugin-name}/`
- `main.js` and the WASM file are in the same directory
- `__dirname` in Electron's CJS context resolves to the plugin directory

## Live Obsidian Proof (Manual Step)

The automated tests verify the bridge in a Node.js environment. To complete
the full Task 0.5 exit criteria, load the plugin in Obsidian and verify:

1. Plugin loads without errors in the developer console
2. The `runRuntimeProof()` function executes successfully
3. Parse a vault note containing frontmatter, headings, and code blocks

The `runtime-proof.ts` module exports `runRuntimeProof()` for this purpose.
