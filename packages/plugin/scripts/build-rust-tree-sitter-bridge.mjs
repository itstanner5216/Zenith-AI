import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(__dirname, "..");
const bridgeDir = path.join(
  pluginDir,
  "services",
  "patch-engine",
  "runtime",
  "rust-tree-sitter-bridge"
);
const emsdkDir = process.env.EMSDK_DIR || "/tmp/emsdk-tree-sitter";
const sysroot = path.join(emsdkDir, "upstream", "emscripten", "cache", "sysroot");
const clang = path.join(emsdkDir, "upstream", "bin", "clang");
const clangxx = path.join(emsdkDir, "upstream", "bin", "clang++");
const llvmAr = path.join(emsdkDir, "upstream", "bin", "llvm-ar");
const wasmPath = path.join(
  bridgeDir,
  "target",
  "wasm32-unknown-unknown",
  "release",
  "rust_tree_sitter_bridge.wasm"
);
const pkgDir = path.join(bridgeDir, "pkg");
const generatedJsPath = path.join(pkgDir, "rust_tree_sitter_bridge.js");

function ensureExists(targetPath, message) {
  if (!existsSync(targetPath)) {
    throw new Error(message);
  }
}

function run(command, args, cwd, extraEnv = {}) {
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
  });
}

/**
 * Patches tree-sitter-language's WASM stub headers in the Cargo registry.
 *
 * tree-sitter-language v0.1.x ships minimal stub headers under
 * `wasm/include/` (ctype.h, string.h, wctype.h, etc.) for pure-WASM
 * builds without a sysroot. These stubs shadow the Emscripten sysroot
 * when cc-rs adds them to the include path via `-I`, and they are missing
 * many functions that grammar scanners actually use (isdigit, strcmp,
 * towlower, va_list, etc.).
 *
 * Since we compile with a full Emscripten sysroot, the fix is to add
 * the missing declarations directly into the stub headers without breaking
 * the source files under `wasm/src/` that depend on them.
 *
 * The patch is idempotent: a marker comment prevents double-patching.
 */
function patchTreeSitterLanguageStubs() {
  const registryRoot = path.join(os.homedir(), ".cargo", "registry", "src");
  if (!existsSync(registryRoot)) return;

  let wasmIncludeDir = "";
  try {
    for (const host of readdirSync(registryRoot)) {
      const candidate = path.join(
        registryRoot,
        host,
        "tree-sitter-language-0.1.7",
        "wasm",
        "include"
      );
      if (existsSync(candidate)) {
        wasmIncludeDir = candidate;
        break;
      }
    }
  } catch {
    return;
  }

  if (!wasmIncludeDir) return;

  const patchMarker = "/* zenith-sysroot-augment */";

  // Augment each stub header with the missing declarations that grammar
  // scanners need. We append before the final #endif so the original
  // content is preserved and the new declarations are still inside the
  // include guard.
  const augmentations = {
    "ctype.h": [
      "static inline int isdigit(int c) { return c >= '0' && c <= '9'; }",
      "static inline int isalpha(int c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }",
      "static inline int isalnum(int c) { return isdigit(c) || isalpha(c); }",
      "static inline int isspace(int c) { return c == ' ' || c == '\\t' || c == '\\n' || c == '\\r' || c == '\\f' || c == '\\v'; }",
      "static inline int isupper(int c) { return c >= 'A' && c <= 'Z'; }",
      "static inline int islower(int c) { return c >= 'a' && c <= 'z'; }",
      "static inline int tolower(int c) { return isupper(c) ? c + 32 : c; }",
      "static inline int toupper(int c) { return islower(c) ? c - 32 : c; }",
    ],
    "string.h": [
      "void *memcpy(void *, const void *, __SIZE_TYPE__);",
      "void *memset(void *, int, __SIZE_TYPE__);",
      "void *memmove(void *, const void *, __SIZE_TYPE__);",
      "int memcmp(const void *, const void *, __SIZE_TYPE__);",
      "__SIZE_TYPE__ strlen(const char *);",
      "int strcmp(const char *, const char *);",
      "int strncmp(const char *, const char *, __SIZE_TYPE__);",
      "char *strncpy(char *, const char *, __SIZE_TYPE__);",
    ],
    "wctype.h": [
      "static inline wint_t towlower(wint_t c) { return (c >= L'A' && c <= L'Z') ? c + 32 : c; }",
      "static inline wint_t towupper(wint_t c) { return (c >= L'a' && c <= L'z') ? c - 32 : c; }",
      "static inline bool iswlower(wint_t c) { return c >= L'a' && c <= L'z'; }",
      "static inline bool iswupper(wint_t c) { return c >= L'A' && c <= L'Z'; }",
    ],
  };

  for (const [filename, decls] of Object.entries(augmentations)) {
    const stubPath = path.join(wasmIncludeDir, filename);
    if (!existsSync(stubPath)) continue;

    const content = readFileSync(stubPath, "utf8");
    if (content.includes(patchMarker)) continue;

    // Insert before the final #endif
    const lastEndif = content.lastIndexOf("#endif");
    if (lastEndif === -1) continue;

    const patch = "\n" + patchMarker + "\n" + decls.join("\n") + "\n\n";
    const patched = content.slice(0, lastEndif) + patch + content.slice(lastEndif);
    writeFileSync(stubPath, patched);
  }
}

if (!existsSync(clang) || !existsSync(sysroot)) {
  const prebuiltWasm = path.join(pkgDir, "rust_tree_sitter_bridge_bg.wasm");
  if (existsSync(prebuiltWasm)) {
    console.log(
      "Emscripten SDK not found; using pre-built WASM artifacts. " +
      "Set EMSDK_DIR to rebuild from source."
    );
    process.exit(0);
  }
  throw new Error(
    `Expected local Emscripten clang at ${clang}. Install the SDK first or set EMSDK_DIR.`
  );
}

mkdirSync(pkgDir, { recursive: true });
patchTreeSitterLanguageStubs();

run(
  "cargo",
  ["build", "--release", "--target", "wasm32-unknown-unknown"],
  bridgeDir,
  {
    CC_wasm32_unknown_unknown: clang,
    CXX_wasm32_unknown_unknown: clangxx,
    AR_wasm32_unknown_unknown: llvmAr,
    CFLAGS_wasm32_unknown_unknown: `--target=wasm32-unknown-unknown --sysroot=${sysroot} -Wno-incompatible-pointer-types -include stdbool.h -include ctype.h -include string.h -include wctype.h`,
    CXXFLAGS_wasm32_unknown_unknown: `--target=wasm32-unknown-unknown --sysroot=${sysroot} -fexceptions`,
  }
);

run(
  "wasm-bindgen",
  [wasmPath, "--target", "nodejs", "--out-dir", pkgDir],
  bridgeDir
);

let generatedJs = readFileSync(generatedJsPath, "utf8");
generatedJs = generatedJs.replaceAll(
  'require("env")',
  'require("../../rust-tree-sitter-host-env.cjs")'
);

if (!generatedJs.includes("exports.__wasm = wasm;")) {
  generatedJs = generatedJs.replace(
    "let wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;\nwasm.__wbindgen_start();",
    "let wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;\nexports.__wasm = wasm;\nwasm.__wbindgen_start();"
  );
}

writeFileSync(generatedJsPath, generatedJs);
