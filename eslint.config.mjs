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
  // TypeScript/TSX files — syntax-level checks, no type-aware rules.
  //
  // ESLint 10 discovers per-package configs by searching upward from each linted
  // file (e.g. packages/web/eslint.config.js for web files), so type-aware
  // per-package rules are applied automatically.  This root config covers files
  // not served by a package config (plugin sources, root scripts, etc.).
  //
  // NOTE: Do NOT access tseslint.configs.* getters here.  typescript-eslint v8+
  // registers the calling file's directory as a tsconfigRootDir candidate each
  // time a getter fires; a second access from packages/web/eslint.config.js
  // would push a second candidate and cause a fatal parse error when linting
  // across both packages.
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
      // Disable the base rule — TypeScript's own checker handles this.
      "no-unused-vars": "off",
      "no-undef": "off",
      // Warn on unused variables so SARIF captures basic TS issues.
      // Full type-aware enforcement runs via per-package configs.
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

