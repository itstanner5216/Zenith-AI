# Dependency Upgrade Plan — Zenith-AI Monorepo

> **Philosophy: No pinning to old versions. Update to latest, adapt code to match. Build once, stay current.**

Generated from: audit reports across root monorepo, packages/plugin, packages/web, and Zeniths-Vectors gateway.

---

## Overview

This plan brings all packages to current stable versions, eliminates dependency drift and duplication, and removes dead code. The goal is a clean, consistent dependency graph — no version splits between packages, no redundant direct installs shadowing catalog entries, no packages that aren't imported anywhere.

Changes are ordered so each phase can be merged independently. Phases 1–2 are low-risk and should be completed before any feature work resumes. Phase 3 (Tiptap v3) is the highest-effort item and is isolated to keep it reviewable.

---

## Cross-Cutting Decisions

These affect multiple packages and inform every phase below.

| Decision | Rationale |
|---|---|
| **Unify TypeScript → 5.9.3** | Plugin is at 5.2.2, root/web at 5.8.2. Mismatched TS versions cause silent type drift and inconsistent plugin behavior. One version everywhere. |
| **Unify Tailwind → v4** | Plugin is on v3, web is already on v4. Keeping both means two different config systems in one monorepo. Migrate plugin to v4. |
| **Drop direct `openai` package from plugin + web** | Project already uses `@ai-sdk/openai` via the pnpm catalog. Having a direct `openai` v4/v6 dep alongside it creates ESM/CJS conflicts and doubles the maintenance surface. Use the catalog entry exclusively. |
| **Remove dead deps: `jimp` (plugin), `tiptap` (web)** | `jimp` is not imported anywhere in plugin. `tiptap` is declared as a dep in web but has zero imports. Dead weight. |
| **Create `.nvmrc` with Node 22 LTS** | Currently running Node v24 experimental with no version lock. Node 22 is the active LTS (supported until April 2027). Pin it. |
| **Enable TypeScript strict mode (phased)** | `strict: false` in root tsconfig. Enabling it all at once will flood the codebase with errors. Phase 5 does this incrementally. |

---

## Phase 1 — Foundation

**Prerequisite for all other phases. No feature work until this is merged.**

### 1.1 — Create `.nvmrc`

```bash
echo "22" > /home/tanner/Projects/Zenith-AI/.nvmrc
```

Update CI (if applicable) to run `nvm use` or set `node-version: '22'` in workflow files.

---

### 1.2 — Align TypeScript to 5.9.3

**Files to update:**

- `package.json` (root) — `typescript` devDep
- `packages/plugin/package.json` — `typescript` devDep (currently `5.2.2`)
- `packages/web/package.json` — `typescript` devDep (currently `5.8.2`)

If TypeScript is in the pnpm catalog (`pnpm-workspace.yaml` or root `package.json` catalog block), update it there and remove per-package overrides:

```yaml
# pnpm-workspace.yaml catalog entry
typescript: "^5.9.3"
```

Otherwise update each `package.json` directly:

```bash
cd /home/tanner/Projects/Zenith-AI
pnpm add -D typescript@^5.9.3 --workspace-root
pnpm add -D typescript@^5.9.3 --filter plugin
pnpm add -D typescript@^5.9.3 --filter web
```

**Verify:** `pnpm tsc --version` in each package returns `5.9.x`.

---

### 1.3 — Bump `@types/node`

- Root: `22.x → 25.x`
- `packages/web`: `20.8.5 → 25.5.0`

```bash
pnpm add -D @types/node@^25.0.0 --workspace-root
pnpm add -D @types/node@^25.0.0 --filter web
```

`@types/node` 25.x follows Node 22 LTS API surface. No code changes expected — it's additive.

---

### 1.4 — Remove dead dependencies

**`packages/plugin/package.json`** — remove `jimp`:

```bash
pnpm remove jimp --filter plugin
```

Confirm it's not imported anywhere first:
```bash
grep -r "jimp" /home/tanner/Projects/Zenith-AI/packages/plugin/src
# expected: no output
```

**`packages/web/package.json`** — remove `tiptap` (all `@tiptap/*` entries):

```bash
grep -r "@tiptap" /home/tanner/Projects/Zenith-AI/packages/web/src
# expected: no output — confirm before removing
pnpm remove @tiptap/core @tiptap/react @tiptap/starter-kit --filter web
# adjust the list to match what's actually declared in packages/web/package.json
```

---

### 1.5 — Drop direct `openai` package

**`packages/plugin/package.json`** — remove `openai` direct dep, use `@ai-sdk/openai` from catalog:

```bash
grep -r "from 'openai'" /home/tanner/Projects/Zenith-AI/packages/plugin/src
# For each import found, replace with the @ai-sdk/openai equivalent
pnpm remove openai --filter plugin
```

**`packages/web/package.json`** — remove `openai` direct dep:

```bash
grep -r "from 'openai'" /home/tanner/Projects/Zenith-AI/packages/web
# Primary hit: packages/web/lib/models.ts
pnpm remove openai --filter web
```

`packages/web/lib/models.ts` changes required (see also Phase 4 — Drizzle + minor web deps):
- Replace `createOpenAI()` import from `'openai'` with `import { openai } from '@ai-sdk/openai'`
- Remove any direct `openai.responses` API calls — use Vercel AI SDK's `generateText` / `streamText` with the `@ai-sdk/openai` provider instead
- Audit the full file: `cat /home/tanner/Projects/Zenith-AI/packages/web/lib/models.ts`

---

### 1.6 — Fix missing node_modules in plugin

```bash
cd /home/tanner/Projects/Zenith-AI
pnpm install
```

This resolves the issue where most packages in `packages/plugin` are declared but missing from `node_modules`.

---

### 1.7 — ESLint 9 → 10

ESLint 10 drops support for the legacy `.eslintrc.*` format. Only `eslint.config.js` (flat config) is supported.

**Check current config format:**
```bash
ls /home/tanner/Projects/Zenith-AI/eslint.config*
ls /home/tanner/Projects/Zenith-AI/.eslintrc*
```

**If still on `.eslintrc.*`:** Migrate to flat config first, then upgrade.

ESLint provides a migration tool:
```bash
npx @eslint/migrate-config .eslintrc.json
# or .eslintrc.js / .eslintrc.yaml — adjust as needed
```

Then upgrade:
```bash
pnpm add -D eslint@^10.0.0 --workspace-root
```

**Plugin compatibility:** Check that `eslint-plugin-*` packages used in the config support ESLint 10. Inspect `peerDependencies` for each plugin. Common ones to check:
- `@typescript-eslint/eslint-plugin` — update to latest alongside ESLint 10
- `eslint-plugin-react` / `eslint-plugin-react-hooks`
- `eslint-config-next` (if present in web)

```bash
pnpm add -D @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest --workspace-root
```

**Verify:** `pnpm eslint --version` returns `10.x.x`. Run `pnpm lint` and fix any rule-level errors surfaced by the new version.

---

### Phase 1 Completion Checklist

- [ ] `.nvmrc` created with `22`
- [ ] TypeScript unified at `5.9.3` across root, plugin, web
- [ ] `@types/node` at `25.x` in root and web
- [ ] `jimp` removed from plugin (confirmed no imports)
- [ ] `tiptap` deps removed from web (confirmed no imports)
- [ ] `openai` direct dep removed from plugin and web; `models.ts` updated
- [ ] `pnpm install` run, plugin node_modules populated
- [ ] ESLint upgraded to 10.x, flat config in place, `pnpm lint` passes

---

## Phase 2 — Tailwind Unification (Plugin v3 → v4)

**Goal:** Plugin and web both use Tailwind v4 with consistent configuration.

### What's changing

Tailwind v4 drops the `tailwind.config.js` file approach. Configuration moves to CSS using `@import "tailwindcss"` and `@theme` / `@plugin` directives. There is no JavaScript config file by default.

### Steps

**1. Remove old Tailwind v3 deps from plugin:**

```bash
pnpm remove tailwindcss @tailwindcss/typography autoprefixer --filter plugin
# autoprefixer is already updated but no longer needed as a PostCSS step in v4
```

**2. Install Tailwind v4 in plugin:**

```bash
pnpm add tailwindcss@^4.0.0 @tailwindcss/vite --filter plugin
# or @tailwindcss/postcss if plugin uses PostCSS rather than Vite
```

**3. Update PostCSS config in plugin (if present):**

`packages/plugin/postcss.config.js` or `.cjs`:
```js
// v4 PostCSS setup
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**4. Update CSS entry point in plugin:**

Remove `@tailwind base; @tailwind components; @tailwind utilities;` directives.

Replace with:
```css
@import "tailwindcss";
```

Any custom theme extensions previously in `tailwind.config.js` move into the CSS file using `@theme`:
```css
@import "tailwindcss";

@theme {
  --color-brand: #your-color;
  /* ... */
}
```

**5. Remove `tailwind.config.js` from plugin** once all customizations are migrated to CSS.

**6. Check for `@apply` usage:**

```bash
grep -r "@apply" /home/tanner/Projects/Zenith-AI/packages/plugin/src
```

`@apply` still works in v4 but must use CSS variable-based tokens. Update any that reference v3-only utility names.

**7. Check for content configuration:**

v4 auto-detects content files. Explicit `content: []` arrays in the old config are not needed unless the plugin has unusual file locations outside the default scan paths.

### What to test after

- All Tailwind utility classes render correctly in plugin UI
- Custom theme tokens (colors, spacing, fonts) still apply
- `pnpm build` in plugin succeeds without PostCSS errors
- Compare visual output of plugin components against pre-migration screenshots (if available)

---

## Phase 3 — Tiptap v3 Migration (Plugin)

**HIGH EFFORT. Isolate on its own branch. Do not combine with other phases.**

### Files affected

- `packages/plugin/src/tiptap.tsx` — main editor component
- `packages/plugin/src/mention-with-spaces.ts` — custom mention extension
- `packages/plugin/src/suggestion.ts` — suggestion dropdown logic

### API changes to be aware of

Tiptap v3 is a full rewrite of the extension and node API. Key breaking changes:

**Package structure:**
```bash
# v2
@tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-mention

# v3 — package names may change; verify on release
# Check https://tiptap.dev/docs/migration for the current v3 package list
pnpm add @tiptap/core@^3.0.0 @tiptap/react@^3.0.0 @tiptap/starter-kit@^3.0.0 @tiptap/extension-mention@^3.0.0 --filter plugin
```

**`useEditor` hook:**
- v3 changes the `useEditor` hook API — `editor` may now be returned with different initialization semantics
- Null-check patterns for `editor` may need updating in `tiptap.tsx`

**Extension API:**
- `Node.create()` / `Mark.create()` — `addCommands`, `addKeyboardShortcuts`, `addInputRules` signatures may change
- Custom extensions in `mention-with-spaces.ts` will need to be audited against the v3 extension guide

**Suggestion API:**
- The `suggestion` utility used in `suggestion.ts` for dropdown rendering has changed in v3
- `SuggestionOptions` type and the `render()` lifecycle (`onStart`, `onUpdate`, `onKeyDown`, `onExit`) likely have updated signatures
- Floating UI / Tippy.js integration may also change — check if `tippyjs-for-react` is still the recommended approach in v3

**Schema changes:**
- If any custom nodes/marks are defined, their `schema` block format may differ in v3
- `parseHTML` and `renderHTML` implementations should be re-verified

### Migration approach

1. Read the official Tiptap v3 migration guide before writing any code: https://tiptap.dev/docs/migration
2. Start with `tiptap.tsx` — get basic editor rendering before touching extensions
3. Then migrate `mention-with-spaces.ts` — the most likely source of breaking changes
4. Finally `suggestion.ts` — depends on the mention extension being stable first
5. Run the plugin in dev mode and test: basic typing, mentions, suggestion dropdown keyboard navigation, content serialization/deserialization

### Commands

```bash
# Install v3 packages (verify exact package names from tiptap.dev first)
pnpm add @tiptap/core@^3.0.0 @tiptap/react@^3.0.0 @tiptap/starter-kit@^3.0.0 @tiptap/extension-mention@^3.0.0 --filter plugin

# Remove any v2-only packages that were split or renamed
pnpm remove @tiptap/extension-placeholder @tiptap/extension-history --filter plugin
# (adjust based on what's actually in packages/plugin/package.json)
```

---

## Phase 4 — Backend & Infrastructure Updates

### 4.1 — Gateway Python deps (Zeniths-Vectors)

All Python dependency updates are **backward compatible — zero code changes required**.

```bash
cd /home/tanner/Projects/Zenith-AI/Zeniths-Vectors
pip install --upgrade fastapi uvicorn httpx pydantic
# or if using requirements.txt:
pip-compile --upgrade requirements.in -o requirements.txt
pip install -r requirements.txt
```

Specific version targets:
- `fastapi`: `0.115.6 → 0.135.1` (20 minor versions of bug fixes and performance improvements)
- All other Python deps: upgrade to latest compatible with Python version in use

**Verify:** `uvicorn gateway:app --reload` starts without import errors. Hit all gateway endpoints with a basic smoke test.

---

### 4.2 — Redis investigation

`redis` is declared in `Zeniths-Vectors/requirements.txt` but is **not imported anywhere in `gateway.py`**.

```bash
grep -r "redis\|Redis" /home/tanner/Projects/Zenith-AI/Zeniths-Vectors/
```

- If no imports found anywhere in the gateway source: **remove from `requirements.txt`**
- If found in a file other than `gateway.py`: document why and keep it
- If it was intended for caching/session storage and was never implemented: remove it and open a tracking issue if the feature is still wanted

---

### 4.3 — Docker image pinning (OpenWebUI + LiteLLM)

Currently using `:main` rolling tags — these are mutable and will silently change on every pull, making deployments non-reproducible.

**Find the compose file:**
```bash
find /home/tanner/Projects/Zenith-AI -name "docker-compose*.yml" -o -name "compose.yml" | head -10
```

**Current (risky):**
```yaml
image: ghcr.io/open-webui/open-webui:main
image: ghcr.io/berriai/litellm:main
```

**Replace with pinned digest or semver tag:**
```bash
# Get current latest tag/digest for each image
docker manifest inspect ghcr.io/open-webui/open-webui:main | grep digest
docker manifest inspect ghcr.io/berriai/litellm:main | grep digest
```

Then pin to a specific release tag (preferred over digest for readability):
```yaml
# Check https://github.com/open-webui/open-webui/releases for latest stable
image: ghcr.io/open-webui/open-webui:v0.x.y

# Check https://github.com/BerriAI/litellm/releases for latest stable
image: ghcr.io/berriai/litellm:v1.x.y
```

Set a calendar reminder or Dependabot rule to review these monthly. Do **not** go back to `:main`.

---

### 4.4 — Drizzle ORM + Drizzle Kit

- `drizzle-orm`: `0.31.4 → 0.45.1`
- `drizzle-kit`: `0.22.8 → 0.31.10`

These are large version jumps but the Drizzle team maintains backward compatibility for standard query patterns. The risk is in schema migration commands.

```bash
pnpm add drizzle-orm@^0.45.1 --filter web
pnpm add -D drizzle-kit@^0.31.10 --filter web
```

**After upgrading:**

1. Run `pnpm drizzle-kit check` to verify schema consistency
2. Run `pnpm drizzle-kit generate` to confirm migration generation still works
3. **Do not run `migrate` against a production database without reviewing the generated SQL**
4. Check the Drizzle changelog for 0.31→0.45 for any query API changes: https://orm.drizzle.team/changelogs

---

### 4.5 — `dotenv-cli` major update (web)

`dotenv-cli`: `7.4.4 → 11.0.0`

Requires **Node v18+** — Node 22 LTS (set in Phase 1) satisfies this.

```bash
pnpm add -D dotenv-cli@^11.0.0 --filter web
```

No API changes expected for standard `dotenv-cli` usage in npm scripts. Verify `pnpm dev` and `pnpm build` scripts in `packages/web/package.json` that use `dotenv-cli` still work.

---

### 4.6 — PostgreSQL (defer)

PostgreSQL pg16 is supported until November 2028. **No action needed now.** Schedule a pg17 migration review in late 2026.

---

## Phase 5 — TypeScript Strict Mode (Phased)

**Do this last. Strict mode surfaces real bugs but generates a lot of noise. Do it incrementally.**

The root `tsconfig.json` currently has `"strict": false`. Rather than flipping the switch globally, enable flags one at a time and fix errors before moving to the next.

### Order of flags (lowest noise → highest noise)

**Step 1** — add to root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```
Run `pnpm tsc --noEmit` across the workspace. Fix all errors. Commit.

**Step 2:**
```json
"strictNullChecks": true
```
This is the highest-impact flag. Expect the most errors here. Fix and commit.

**Step 3:**
```json
"strictFunctionTypes": true,
"strictBindCallApply": true
```
Fix and commit.

**Step 4:**
```json
"strictPropertyInitialization": true,
"noImplicitThis": true
```
Fix and commit.

**Step 5** — replace all individual flags with:
```json
"strict": true
```
Run `pnpm tsc --noEmit` one final time to confirm zero errors. If new errors appear, fix them — they were likely masked by the phased approach.

### Useful commands during this phase

```bash
# Count errors across workspace before each step
pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l

# See errors by file
pnpm tsc --noEmit 2>&1 | grep "error TS" | sed 's/(.*//' | sort | uniq -c | sort -rn | head -20
```

---

## What's Already Done

| Item | Status |
|---|---|
| `autoprefixer` updated to `10.4.27`, pnpm store corruption resolved | ✅ Done |
| `framer-motion` re-extracted clean | ✅ Done |

---

## Execution Order Summary

```
Phase 1: Foundation          ← start here, blocks everything else
  └─ .nvmrc, TS alignment, dead dep removal, openai drop, pnpm install, ESLint 10

Phase 2: Tailwind unification ← low risk, can be done in parallel with Phase 4
  └─ plugin v3 → v4

Phase 3: Tiptap v3           ← HIGH EFFORT, own branch, own PR
  └─ tiptap.tsx, mention-with-spaces.ts, suggestion.ts

Phase 4: Backend + infra     ← low risk, all safe updates
  └─ FastAPI, Redis cleanup, Docker pinning, Drizzle, dotenv-cli

Phase 5: Strict mode         ← last, after codebase is otherwise stable
  └─ noImplicitAny → strictNullChecks → ... → strict: true
```

---

## Notes

- All `pnpm` commands above assume you're running from the monorepo root unless `cd` is shown explicitly.
- After each phase, run `pnpm install && pnpm build` from the root to catch integration issues early.
- Do not merge Phase 3 (Tiptap) until it has been manually tested in the actual plugin UI — type-checking alone will not catch rendering regressions.
