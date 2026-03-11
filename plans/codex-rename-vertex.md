# Codex Task: Rename "Vertex_AI_Brain_2" → "Zeniths-Vectors"

Branch from `phase0-complete`. This is a **directory rename + content updates** — do not restructure or change any logic.

---

## Step 1: Rename the directory

Rename the directory `Vertex_AI_Brain_2/` → `Zeniths-Vectors/` at the repo root.

```bash
git mv Vertex_AI_Brain_2 Zeniths-Vectors
```

---

## Step 2: Update internal references

### `Zeniths-Vectors/vertex_gateway_filter.py`
- Line 5: Change `author: Vertex AI Brain` → `author: Zeniths-Vectors`

### `Zeniths-Vectors/docs/plans/2026-03-08-production-fixes.md`
- Replace all `Vertex_AI_Brain_2` → `Zeniths-Vectors`
- Replace all `Vertex AI Brain` → `Zeniths-Vectors`

### `Zeniths-Vectors/implementation_plan.md.resolved.md`
- Replace all `Vertex_AI_Brain_2` → `Zeniths-Vectors`
- Replace all `Vertex AI Brain` → `Zeniths-Vectors`

---

## Step 3: Update plan files (surgical path/name edits only)

### `plans/NEW-Phase-0.md`
Replace these exact strings:
- `Vertex_AI_Brain_2/` → `Zeniths-Vectors/` (path references)
- `Vertex_AI_Brain_2` → `Zeniths-Vectors` (non-path references)
- `/home/tanner/Projects/Vertex_AI_Brain_2/` → repo-relative `Zeniths-Vectors/`
- `Vertex Brain 2` → `Zeniths-Vectors`
- Do NOT change `Vertex AI Brain` when it refers to the older v3.0.0 origin in the assumption note — leave that historical reference as-is

### `plans/NEW-Plan-A.md`
- `Vertex_AI_Brain_2` → `Zeniths-Vectors`
- `Vertex Brain 2` → `Zeniths-Vectors`

### `plans/NEW-Plan-B.md`
- `Vertex_AI_Brain_2` → `Zeniths-Vectors`
- `Vertex Brain 2` → `Zeniths-Vectors`
- `/home/tanner/Projects/Vertex_AI_Brain_2/` → repo-relative `Zeniths-Vectors/`

---

## Step 4: Update any other refs found repo-wide

Search the entire repo (excluding `node_modules/`, `dist/`, `.git/`, `pnpm-lock.yaml`) for any remaining `Vertex_AI_Brain_2` strings and update them to `Zeniths-Vectors`.

---

## Critical rules

1. **Do NOT change any logic** — only directory name and string references
2. **Use `git mv`** for the directory rename so git tracks it properly
3. **Preserve all file contents** inside the renamed directory exactly as they are (except the string replacements above)
4. **Do NOT rename Python variables/functions** that happen to contain "vertex" — those refer to the Vertex AI service, not the directory

---

## Verification

1. `ls -d Zeniths-Vectors/` — must exist
2. `ls -d Vertex_AI_Brain_2/ 2>/dev/null` — must NOT exist
3. `python -m py_compile Zeniths-Vectors/gateway.py` — must exit 0
4. `grep -r "Vertex_AI_Brain_2" --include="*.py" --include="*.yaml" --include="*.yml" --include="*.md" --include="*.json" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist | grep -v '.git/'` — should have NO output
5. `grep -r "Vertex AI Brain" Zeniths-Vectors/ --include="*.py"` — should have NO output

Commit message: `refactor: rename Vertex_AI_Brain_2 → Zeniths-Vectors`
