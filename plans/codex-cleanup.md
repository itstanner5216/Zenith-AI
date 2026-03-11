# Codex Task: Stale Documentation & File Cleanup

Branch from `phase0-complete`. The project is being substantially rearchitected. Remove stale docs, analysis files, and leftover artifacts that are no longer relevant. **Do NOT write new documentation** — just delete what's outdated.

---

## CRITICAL: Do NOT touch these

- `plans/` directory — **do not modify or delete anything in plans/**
- `packages/` directory — **do not delete any source code files**
- `Vertex_AI_Brain_2/` — **do not delete** (may already be renamed to `Zeniths-Vectors/`)
- `README.md` — **keep** (will be rewritten later)
- `LICENSE` — **keep**
- `AGENTS.MD` — **keep** (active agent instructions)

---

## Files to DELETE

### Root-level stale analysis/migration docs

These are one-off analysis documents from the original "Note Companion" / "File Organizer 2000" project that no longer apply:

```
AI_SDK_ELEMENTS_MIGRATION.md
AI_SDK_ELEMENTS_MIGRATION_EXTENDED.md
ANALYSIS.md
ASSISTANT_STYLING_ANALYSIS.md
BACKWARD_COMPATIBILITY_STRATEGY.md
ORGANIZER_BEHAVIOR_ANALYSIS.md
REACT_HOOKS_ERROR_FIX.md
IMPLEMENTATION-LOCAL-TOOLS.md
EXAMPLE_PROMPTS.md
SELF-HOSTING.md
CONTRIBUTING.md
```

### Root-level stale config/artifacts

```
meetings.json
promptfooconfig.yaml
test-release.js
render.yaml
Dockerfile
Dockerfile.optimized
```

### `docs/` stale files

Delete these files (keep the `docs/screenshots/` directory and its images):

```
docs/GPT-4.1-MINI-USAGE.md
docs/code-analysis/CLEANUP_SUMMARY.md
docs/code-analysis/ORPHANED_CODE_ANALYSIS.md
docs/code-analysis/README.md
```

After deleting the above, if `docs/code-analysis/` is empty, delete the directory too.

### `memory/` directory

These are old Cursor AI memory files from 2024 that are no longer relevant:

```
memory/2024-07-29-mobile-image-upload-workflow.md
memory/2024-07-30-sdk-implementation-failure-web-search.md
memory/2024-09-25-expo-run-command-directory.md
memory/2024-09-25-remove-expo-share-intent.md
```

Delete the entire `memory/` directory.

### `tutorials/` directory

These tutorials are all written for the old "Note Companion" / "File Organizer 2000" product and will need to be fully rewritten. Delete the entire directory:

```
tutorials/
```

### `scripts/` stale file

```
scripts/create-fabric-provider.js
```

If `scripts/` is empty after deletion, delete the directory too.

### `patches/` stale file

```
patches/xcode@3.0.1.patch
```

If `patches/` is empty after deletion, delete the directory too.

### `.cecli/` directory

This is local CLI cache/history, should not be in the repo:

```
.cecli/
```

---

## Files to KEEP (for reference, do not delete)

- `README.md` — will be rewritten later
- `AGENTS.MD` — active agent instructions
- `LICENSE` — legal requirement
- `package.json` — project config
- `manifest.json` — plugin manifest
- `tsconfig.json` — TypeScript config
- `turbo.json` — monorepo config
- `pnpm-workspace.yaml` — workspace config
- `pnpm-lock.yaml` — lockfile
- `docker-compose.yml` — active infra
- `main.css` — plugin styles
- `docs/2026-03-08-vault-intelligence-design.md` — current design doc
- `docs/screenshots/*` — useful images
- Everything in `plans/` — active implementation plans
- Everything in `packages/` — source code
- Everything in `Vertex_AI_Brain_2/` (or `Zeniths-Vectors/`) — backend code

---

## Verification

After cleanup:

1. `ls AI_SDK_ELEMENTS_MIGRATION.md 2>/dev/null` — should NOT exist
2. `ls tutorials/ 2>/dev/null` — should NOT exist
3. `ls memory/ 2>/dev/null` — should NOT exist
4. `ls .cecli/ 2>/dev/null` — should NOT exist
5. `ls plans/NEW-Phase-0.md` — MUST still exist
6. `ls packages/plugin/index.ts` — MUST still exist
7. `ls AGENTS.MD` — MUST still exist
8. `ls README.md` — MUST still exist
9. `ls docs/2026-03-08-vault-intelligence-design.md` — MUST still exist
10. `ls docs/screenshots/` — MUST still exist

Commit message: `chore: remove stale docs, analysis files, and legacy artifacts`
