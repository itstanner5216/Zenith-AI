import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-types/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/build/**",
      "**/coverage/**",
      // Plugin compiled output (esbuild artifact)
      "packages/plugin/main.js",
      // WASM-generated artifacts — contain non-standard JS patterns
      "**/rust-tree-sitter-bridge/pkg/**",
    ],
  },
  // JavaScript/CJS/MJS files
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
  },
  // TypeScript/TSX files — use TS parser but NO type-aware rules.
  // Type-aware and package-specific rules run per-package via `pnpm lint` (turbo).
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: false,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Warn on unused vars so SARIF captures basic TS issues.
      // Full type-aware enforcement runs per-package via `turbo lint`.
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];
