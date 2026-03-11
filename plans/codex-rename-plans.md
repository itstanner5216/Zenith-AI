# Codex Task: Rename old references in Plan A and Plan B

Branch from `master`. These plan files still contain old project names and paths from before the rename. Apply surgical find-and-replace — do NOT change any plan logic, task descriptions, or code structure.

---

## Files to modify

- `plans/NEW-Plan-A.md`
- `plans/NEW-Plan-B.md`

**Do NOT touch any other files.**

---

## Replacements to apply (in both files)

### Path replacements
| Old | New |
|-----|-----|
| `/home/tanner/Projects/.note-companion` | `/home/tanner/Projects/Zenith-AI` |
| `/home/tanner/Projects/Vertex_AI_Brain_2/` | `Zeniths-Vectors/` |
| `Vertex_AI_Brain_2` | `Zeniths-Vectors` |

### Name replacements (in prose/comments)
| Old | New |
|-----|-----|
| `Note Companion` | `Zenith-AI` |
| `NoteCompanion` (in code comments/logs) | `ZenithAI` |
| `Vertex Brain 2` | `Zeniths-Vectors` |

### Code identifier replacements (in code snippets within the plans)
| Old | New |
|-----|-----|
| `FileOrganizerPlugin` | `ZenithAIPlugin` |
| `FileOrganizerSettings` | `ZenithAISettings` |
| `FileOrganizer` (standalone class ref) | `ZenithAI` |

### Specific line fixes

**Plan A line ~163:** `console.warn("[NoteCompanion] Vertex Brain unavailable...")`
→ `console.warn("[ZenithAI] Vertex Brain unavailable...")`

**Plan B line ~651:** `Run from /home/tanner/Projects/Vertex_AI_Brain_2/:`
→ `Run from Zeniths-Vectors/:`

---

## Rules

1. **Only change names and paths** — do not reword, restructure, or shorten any plan content
2. **Preserve code snippet formatting exactly** — only swap identifiers within them
3. **Do NOT touch the worktree/branch/ownership sections at the top** — those are already correct
4. **Historical references** to "Vertex_AI_Brain (the older v3.0.0 origin)" in the assumption notes should keep "Vertex_AI_Brain" as-is (it's referring to a different, older project)

---

## Verification

After changes:

1. `grep -c "FileOrganizer" plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — both should be 0
2. `grep -c "note-companion" plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — both should be 0
3. `grep -c "Vertex_AI_Brain_2" plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — both should be 0
4. `grep -c "Note Companion" plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — both should be 0
5. `grep -c "ZenithAI" plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — should be > 0 in both
6. `wc -l plans/NEW-Plan-A.md plans/NEW-Plan-B.md` — line counts should be unchanged

Commit message: `chore: rename old project references in Plan A and Plan B`
