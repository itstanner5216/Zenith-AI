# Tree-sitter Grammar WASM Assets

This directory holds the pre-compiled `.wasm` files for every grammar listed in
`services/patch-engine/runtime/grammar-manifest.json`.

## How these files are produced

Each grammar repo publishes its tree-sitter grammar as a C library. The
`tree-sitter` CLI compiles them to WASM using Emscripten:

```bash
# Example for a single grammar:
tree-sitter build --wasm node_modules/tree-sitter-javascript
```

The download script (`scripts/download-grammars.mjs`) automates this for every
manifest entry by fetching pre-built WASM artifacts from GitHub releases or
building from source.

## Keeping assets in sync with the manifest

The build will **fail** if any `wasmPath` listed in `grammar-manifest.json` is
missing from this directory. To refresh after updating the manifest:

```bash
pnpm run grammars:download
```

## Pinned versions

Each grammar is pinned to a `sourceRef` (git tag) in the manifest. When updating
a grammar version:

1. Update `sourceRef` in `grammar-manifest.json`.
2. Run `pnpm run grammars:download` to fetch the new WASM.
3. Verify the CST snapshot tests still pass (Task 0.4).
4. Commit the updated JSON and the new `.wasm` file together.

## Build pipeline

The `tree-sitter-wasm-copy` esbuild plugin reads `grammar-manifest.json` and:
1. Copies `tree-sitter.wasm` (runtime) from `node_modules/web-tree-sitter/`.
2. Copies each grammar `.wasm` from this directory to the output `grammars/` dir.
3. Removes stale `.wasm` files from output that are no longer in the manifest.
4. Fails the build if any source `.wasm` is missing.

## .gitignore note

The `.wasm` files in this directory **should be committed** to the repo since
the plan requires bundled grammars only (no runtime downloads).
