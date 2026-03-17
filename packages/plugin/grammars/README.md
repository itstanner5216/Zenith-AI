# Tree-sitter Grammar WASM Assets

This directory holds the pre-compiled `.wasm` files for every grammar listed in
`services/patch-engine/runtime/grammar-manifest.json`.

## How these files are obtained

**Most grammars** publish pre-built `.wasm` release assets on GitHub. The
download script fetches those automatically:

```bash
pnpm run grammars:download
```

**Some grammars** (notably `tree-sitter-sql`) do not publish pre-built WASMs.
For those, you must build the WASM locally using the `tree-sitter` CLI and
Emscripten, then place the file here manually. For the exact toolchain and
commands used to build the current `tree-sitter-sql.wasm`, see
[BUILD-PROVENANCE.md](BUILD-PROVENANCE.md).

```bash
# Install tree-sitter CLI (requires Emscripten for --wasm builds)
npm install -g tree-sitter-cli

# Clone the grammar at the pinned ref
git clone https://github.com/DerekStride/tree-sitter-sql /tmp/tree-sitter-sql
cd /tmp/tree-sitter-sql && git checkout v0.3.3

# Build the WASM (requires emcc in PATH)
tree-sitter build --wasm .

# Copy to this directory
cp tree-sitter-sql.wasm packages/plugin/grammars/tree-sitter-sql.wasm
```

The download script will skip grammars that are already present, so manually
built files are preserved across runs.

## Keeping assets in sync with the manifest

The build **fails** if any `wasmPath` listed in `grammar-manifest.json` is
missing from this directory. To refresh after updating the manifest:

```bash
pnpm run grammars:download   # fetches release assets, skips already-present
pnpm run grammars:verify     # checks output dir after build
```

## Pinned versions

Each grammar is pinned to a `sourceRef` (git tag) in the manifest. When updating
a grammar version:

1. Update `sourceRef` in `grammar-manifest.json`.
2. Delete the old `.wasm` from this directory.
3. Run `pnpm run grammars:download` to fetch the new version.
4. If the grammar has no release asset, build from source (see above).
5. Verify the CST snapshot tests still pass (Task 0.4).
6. Commit the updated JSON and the new `.wasm` file together.

## Build pipeline

The `tree-sitter-wasm-copy` esbuild plugin reads `grammar-manifest.json` and:
1. Copies `tree-sitter.wasm` (runtime) from `node_modules/web-tree-sitter/`.
2. Copies each grammar `.wasm` from this directory to the output `grammars/` dir.
3. Removes stale `.wasm` files from output that are no longer in the manifest.
4. **Fails the build** if any source `.wasm` is missing.

## .gitignore note

The `.wasm` files in this directory **should be committed** to the repo since
the plan requires bundled grammars only (no runtime downloads).
