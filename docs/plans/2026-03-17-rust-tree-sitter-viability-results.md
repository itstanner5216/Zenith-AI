# Rust Tree-Sitter WASM Viability Spike Results

## Verdict

The Rust/WASM tree-sitter bridge is **viable in this worktree** and is now the strongest runtime candidate explored so far for preserving the patch engine's byte-canonical requirements.

The path is not zero-friction, but it is working:
- the required Rust and WASM tooling can be installed without root access
- the bridge crate can be compiled to WebAssembly
- JavaScript bindings can be generated
- the resulting bridge can be called from Node/plugin code
- the spike returns UTF-8 byte offsets correctly for multi-byte JSON and TypeScript samples
- the plugin build still passes with the spike files present

## Fresh Evidence

### 1. Red phase

Created:
- `packages/plugin/spikes/rust-tree-sitter-viability.test.ts`

Verified:
- the red test failed initially because the Rust/WASM wrapper did not exist yet

### 2. Toolchain setup

Installed successfully:
- `rustup target add wasm32-unknown-unknown`
- `rustup target add wasm32-unknown-emscripten`
- `cargo install wasm-bindgen-cli`
- local user-space Emscripten SDK at `/tmp/emsdk-tree-sitter`

No root/system package install was ultimately required.

### 3. Minimal bridge created

Created:
- `packages/plugin/spikes/rust-tree-sitter-bridge/Cargo.toml`
- `packages/plugin/spikes/rust-tree-sitter-bridge/src/lib.rs`
- `packages/plugin/spikes/rust-tree-sitter-viability.ts`

The bridge uses:
- official `tree-sitter`
- `tree-sitter-json`
- `tree-sitter-typescript`
- `wasm-bindgen`

### 4. Build path that worked

The direct `wasm32-unknown-unknown` build initially failed because the grammar crates could not find the C/WASM sysroot.

The direct `wasm32-unknown-emscripten` build got further, but was awkward for `wasm-bindgen`/Node-style consumption.

The working path was:

- keep Rust target as `wasm32-unknown-unknown`
- point the grammar crate C compilation to the local Emscripten clang/sysroot via:
  - `CC_wasm32_unknown_unknown=/tmp/emsdk-tree-sitter/upstream/bin/clang`
  - `CXX_wasm32_unknown_unknown=/tmp/emsdk-tree-sitter/upstream/bin/clang++`
  - `AR_wasm32_unknown_unknown=/tmp/emsdk-tree-sitter/upstream/bin/llvm-ar`
  - `CFLAGS_wasm32_unknown_unknown='--target=wasm32-unknown-unknown --sysroot=/tmp/emsdk-tree-sitter/upstream/emscripten/cache/sysroot'`

With that configuration:

- `cargo build --release --target wasm32-unknown-unknown` succeeded
- `wasm-bindgen ... --target nodejs` succeeded

Generated successfully:
- `packages/plugin/spikes/rust-tree-sitter-bridge/pkg/rust_tree_sitter_bridge.js`
- `packages/plugin/spikes/rust-tree-sitter-bridge/pkg/rust_tree_sitter_bridge_bg.wasm`

### 5. Runtime import shaping

The generated JS/WASM pair still needed local runtime shaping:
- the JS glue expected an `env` module
- the imported C-side allocator functions needed a separate host allocator instead of being routed into Rust’s `__wbindgen_*` allocator

The final replacement path is now tracked in source:

- host adapter:
  - `packages/plugin/spikes/rust-tree-sitter-bridge/rust-tree-sitter-host-env.cjs`
- build script:
  - `packages/plugin/scripts/build-rust-tree-sitter-bridge.mjs`

The build script now:
- builds the Rust bridge with the explicit clang/sysroot wiring
- runs `wasm-bindgen`
- patches the generated JS to import the tracked host adapter instead of `require("env")`
- exposes the underlying wasm exports needed by the host adapter

The tracked host adapter now provides:
- the required `env.*` imports
- a JS-managed heap for the tree-sitter C side
- zeroing `calloc`
- minimal stdio/error/time shims required for the spike

The old fake package shim under `pkg/node_modules/env` was removed after this tracked replacement path was in place, and the spike test remained green.

### 6. Semantic proof

Command:

`node --import tsx --test spikes/rust-tree-sitter-viability.test.ts`

Result:
- exit `0`
- `2` tests passed

The tests prove:
- JSON sample with `é🎉` returns root offsets matching UTF-8 byte length
- TypeScript sample with `é🎉` returns root offsets matching UTF-8 byte length

### 7. Plugin safety check

Command:

`pnpm --filter @zenith-ai/plugin build`

Result:
- exit `0`

So the working spike files do not currently break the plugin build.

## Interpretation

This is the first candidate that has actually produced positive evidence for the core requirement:

- JS-callable
- grammar-backed
- multi-byte aware
- UTF-8 byte-oriented at the API boundary we control

Unlike `node-tree-sitter`, this path has not forced the engine back into JS/code-unit indexing semantics.

## Recommendation

Classify this path as:

**viable with moderate integration work**

The remaining work is not “is this possible?”
That question is now answered: **yes**.

The remaining work is productization:
- decide how to package the local toolchain assumptions
- decide whether to harden or further minimize the tracked host adapter
- decide whether to generalize the bridge beyond JSON and TypeScript
- decide how to integrate bundled grammars and parser lifecycle into the actual patch engine architecture

## Bottom Line

The Rust/WASM route is now the best proven option explored so far for preserving the plan’s byte-canonical semantics.
