# tree-sitter-sql.wasm — Build Provenance

This file documents exactly how `tree-sitter-sql.wasm` was built and how to
reproduce it. It exists because this grammar requires a manual build (see
[Why manual build was needed](#why-manual-build-was-needed)).

## Grammar source

| Field   | Value                                                                 |
| ------- | --------------------------------------------------------------------- |
| Repo    | [DerekStride/tree-sitter-sql](https://github.com/DerekStride/tree-sitter-sql) |
| Ref     | `v0.3.3`                                                              |
| License | MIT                                                                   |

## Build toolchain

| Tool             | Version   | Notes                                                                                          |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------- |
| tree-sitter CLI  | `0.24.7`  | Installed via `npm install -g tree-sitter-cli@0.24.7`                                          |
| Emscripten       | `3.1.64`  | Pulled automatically by tree-sitter CLI via Docker image `emscripten/emsdk:3.1.64`             |
| Docker           | —         | tree-sitter CLI invokes `docker run emscripten/emsdk:3.1.64` internally when `--wasm` is specified |

## Reproducible command sequence

```bash
# 1. Install tree-sitter CLI
npm install -g tree-sitter-cli@0.24.7

# 2. Clone grammar at pinned ref
git clone --depth 1 --branch v0.3.3 https://github.com/DerekStride/tree-sitter-sql.git /tmp/tree-sitter-sql-build
cd /tmp/tree-sitter-sql-build

# 3. Generate parser from grammar.js
tree-sitter generate

# 4. Build WASM (requires Docker — uses emscripten/emsdk:3.1.64 internally)
tree-sitter build --wasm .

# 5. Copy to grammars directory
cp tree-sitter-sql.wasm packages/plugin/grammars/tree-sitter-sql.wasm

# 6. Clean up
rm -rf /tmp/tree-sitter-sql-build
```

## Output artifact

| Field | Value               |
| ----- | ------------------- |
| File  | `tree-sitter-sql.wasm` |
| Size  | 1,953,972 bytes     |
| Built | 2026-03-17          |

## Why manual build was needed

DerekStride/tree-sitter-sql does not publish pre-built `.wasm` release assets.
The other 9 grammars in the manifest all have GitHub release assets and are
fetched automatically by `scripts/download-grammars.mjs`.

## Updating this record

If the manifest `sourceRef` for SQL is ever updated, this build must be repeated
with the new ref. When doing so:

1. Follow the [Reproducible command sequence](#reproducible-command-sequence)
   above, substituting the new ref in the `git clone --branch` step.
2. Update the **Grammar source → Ref** and **Output artifact** sections in this
   file to match the new build.
3. Commit the updated `.wasm` and this provenance file together.
