# Zenith-AI — Broken Code Audit (2026-03-20)

## Baseline Runs
- `pnpm test` (root): ✅ all suites passed.
- `pnpm build` (root): ❌ fails in `packages/plugin` (rust-tree-sitter-bridge requires local Emscripten clang at `/tmp/emsdk-tree-sitter/upstream/bin/clang` or `EMSDK_DIR`).
- `pnpm exec tsc --noEmit` (per package): failures listed below.

## Build / Infra Blockers
- `packages/plugin`: `node esbuild.config.mjs production` aborts because `scripts/build-rust-tree-sitter-bridge.mjs` expects EMSDK toolchain (`clang` under `/tmp/emsdk-tree-sitter`). Install and point `EMSDK_DIR` or vendor the wasm artifacts to unblock builds.
- `packages/landing`: `next build` warns `eslint` key in `next.config.js` is unsupported, `images.domains` is deprecated (use `remotePatterns`), and the `middleware` convention is deprecated (switch to `proxy`). Config needs updating to avoid future build breaks.

## TypeScript Failures

### Plugin (`packages/plugin`)
- `components/ui/separator.tsx:25-37` — TS2322: `style` prop not allowed on `SeparatorRoot` alias. Extend props to include `style` or move gradient to classes/tokens.
- `services/patch-engine/rust-tree-sitter-runtime.ts:33-43` — TS2352: default export from wasm module typed as `() => Promise<void>` but module is not that shape. Define a module type for the wasm bundle and guard the `default` call (or cast via `unknown`) before invoking.
- `services/patch-engine/testing/_grammar-smoke.test.ts:3-4` — TS2459/TS5097: `Grammar` type not exported from `rust-tree-sitter-runtime`, and importing with `.ts` extension is disallowed. Export `Grammar` and import without the `.ts` suffix (or enable `allowImportingTsExtensions`).
- `views/assistant/ai-chat/chat.tsx` (and related: `export-chat-as-markdown.ts`, `message-renderer.tsx`, `services/chat-history-manager.ts`, all tool-handler files, `types/annotations.ts`) — TS2724/TS2322/TS2551: using removed `Message`/`ToolInvocation`/`LanguageModel`/`toDataStreamResponse` symbols from `ai` v1 while the repo has the newer AI SDK. Migrate to the v2+ types (`UIMessage`/`UIToolInvocation`/`LanguageModelV2`) and the new streaming helpers.

### Release Notes (`packages/release-notes`)
- `src/index.ts:294` — TS2322: `LanguageModelV1` assigned to `LanguageModel` (now expects v2 with `supportedUrls`). Update to `LanguageModelV2` or wrap in the new provider helpers before passing to `generateObject`.

### Web (`packages/web`)
- `app/api/(sync)/files/route.ts:25-38` — TS2352: casting `getFiles` result to `FilesResponse` but service returns `FileListResponse` without `total/page/limit`. Add pagination fields in `getFiles` or adjust the response type/shape.
- `app/api/(sync)/upload/route.ts:37,78`, `app/api/files/upload/route.ts:37`, `app/api/process-pending-uploads/route.ts:33` — TS2345: `Buffer` not assignable to `ArrayBufferView` in `fs.writeFileSync`. Write using `new Uint8Array(...)` or type the buffer as `NodeJS.ArrayBufferView`/cast, or align tsconfig/types to Node’s definitions.
- `app/dashboard/sync/page.tsx:9` — TS2322: `<style jsx global>` props not recognized (styled-jsx types missing in app router). Move the CSS into a supported global stylesheet or add `styled-jsx` typings/config.
- `app/not-found.tsx:5-10` — TS2786: `Link` rejected as JSX component (Next/React type mismatch). Align TypeScript/React/Next versions or use the current `Link` API (`legacyBehavior`+`<a>` or ensure the file is a client component with supported props).
- `components/ui/logo.tsx:12` — TS2786: `Image` rejected as JSX component for the same Next/React type mismatch. Update to the supported `next/image` signature or adjust tsconfig/types to Next’s preset.

## Miscellaneous
- `pnpm install` skipped native build scripts (browser-tabs-lock, bufferutil, core-js, esbuild, sharp, unrs-resolver, utf-8-validate). If those binaries are required at runtime, run `pnpm approve-builds` to allow their postinstall steps.
