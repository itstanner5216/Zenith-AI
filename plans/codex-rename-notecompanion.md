# Codex Task: Rename "Note Companion" / "FileOrganizer" → "Zenith-AI"

Branch from `phase0-complete`. This is a **surgical find-and-replace** — do not restructure, refactor, or change any logic. Only change names/strings.

---

## Rename Map

Apply these replacements **repo-wide** in all `.ts`, `.tsx`, `.json`, `.yaml`, `.yml`, `.css`, `.py` files. Exclude `node_modules/`, `dist/`, `.git/`, `pnpm-lock.yaml`.

| Old | New | Context |
|-----|-----|---------|
| `FileOrganizer` (PascalCase class/type) | `ZenithAI` | Class names, type refs, variable types |
| `fileOrganizer` (camelCase variable) | `zenithAI` | Variable names |
| `fileorganizer2000` (manifest ID) | `zenith-ai` | `manifest.json` `id` field only |
| `file-organizer-2000-monorepo` | `zenith-ai-monorepo` | Root `package.json` `name` field |
| `@file-organizer/plugin` | `@zenith-ai/plugin` | Package name + all imports/refs |
| `@file-organizer/web` | `@zenith-ai/web` | Package name + all imports/refs |
| `@file-organizer/release-notes` | `@zenith-ai/release-notes` | Package name + all imports/refs |
| `file-organizer` (kebab in other contexts) | `zenith-ai` | CSS classes, config keys, etc. |
| `Note Companion` (display string) | `Zenith-AI` | User-facing strings, titles, descriptions |
| `note-companion` (kebab) | `zenith-ai` | Package names, URLs, references |
| `NoteCompanion` (PascalCase) | `ZenithAI` | Code identifiers |
| `noteCompanion` (camelCase) | `zenithAI` | Code identifiers |
| `Note Companion (prev. File Organizer 2000)` | `Zenith-AI` | `manifest.json` `name` field |
| `landing-namecompanion` | `zenith-ai-landing` | `packages/landing/package.json` `name` |

**DO NOT rename** the user-facing settings UI labels/descriptions in `packages/plugin/views/settings/` — those will be updated separately in Plan A and Plan B.

---

## Files to touch

Every file below must be checked and renamed where applicable:

### Root config
- `package.json` — `name` field
- `manifest.json` — `id` and `name` fields
- `tsconfig.json` — `@file-organizer/*` path alias
- `docker-compose.yml`
- `promptfooconfig.yaml`
- `.github/workflows/docker-publish.yml`
- `.github/workflows/manual-release.yml`

### packages/plugin/ (48 files — the bulk)
- `package.json` — `name` field
- `index.ts` — `FileOrganizer` class → `ZenithAI`, all refs
- `settings.ts` — `FileOrganizerSettings` → `ZenithAISettings`
- `constants.ts`
- `fileUtils.ts`
- `handlers/commandHandlers.ts`
- `handlers/eventHandlers.ts`
- `inbox/index.ts`
- `inbox/services/error-service.ts`
- `inbox/services/error-service.test.ts`
- `inbox/services/record-manager.ts`
- `inbox/services/youtube-service.ts`
- `components/processing-status-bar.tsx`
- `components/upgrade-button.tsx`
- `views/assistant/view.tsx`
- `views/assistant/provider.tsx`
- `views/assistant/ai-chat/chat.tsx`
- `views/assistant/ai-chat/container.tsx`
- `views/assistant/ai-chat/export-chat-as-markdown.ts`
- `views/assistant/ai-chat/services/chat-history-manager.ts`
- `views/assistant/dashboard/onboarding-wizard.tsx`
- `views/assistant/dashboard/view.tsx`
- `views/assistant/meetings/enhance-note-handler.tsx`
- `views/assistant/meetings/index.tsx`
- `views/assistant/meetings/meeting-metadata.ts`
- `views/assistant/meetings/meeting-predicate.test.ts`
- `views/assistant/meetings/meeting-recorder.tsx`
- `views/assistant/meetings/recent-meetings.tsx`
- `views/assistant/meetings/screenpipe-meetings.tsx`
- `views/assistant/meetings/transcribe-handler.ts`
- `views/assistant/organizer/ai-format/templates.tsx`
- `views/assistant/organizer/ai-format/user-templates.tsx`
- `views/assistant/organizer/chunks.tsx`
- `views/assistant/organizer/components/license-validator.tsx`
- `views/assistant/organizer/components/undo-button.tsx`
- `views/assistant/organizer/folders/box.tsx`
- `views/assistant/organizer/organizer.tsx`
- `views/assistant/organizer/tags.tsx`
- `views/assistant/organizer/titles/box.tsx`
- `views/assistant/organizer/transcript.tsx`
- `views/assistant/synchronizer/sync-tab.tsx`
- `views/settings/account-data.tsx`
- `views/settings/advanced-tab.tsx`
- `views/settings/catalyst-gate.tsx`
- `views/settings/customization-tab.tsx`
- `views/settings/experiment-tab.tsx`
- `views/settings/file-config-tab.tsx`
- `views/settings/general-tab.tsx`
- `views/settings/main.tsx`
- `views/settings/top-up-credits.tsx`
- `views/settings/top-up-minutes.tsx`
- `views/settings/view.tsx`

### packages/web/
- `package.json` — `name` field
- `app/layout.tsx`
- `app/onboarding/page.tsx`
- `app/top-up-success/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/self-hosted/page.tsx`
- `app/dashboard/subscribers/client-component.tsx`
- `app/dashboard/sync/_components/FileList.tsx`
- `app/dashboard/sync/page.tsx`
- `app/components/license-form.tsx`
- `app/api/cron/redeploy/route.ts`
- `components/ui/logo.tsx`
- `srm.config.ts`
- `.github/workflows/update.yml`

### packages/mobile/
- `package.json` — `name` field
- `app.config.ts`
- `app/(auth)/index.tsx`
- `app/(auth)/sign-in.tsx`
- `app/(auth)/sign-up.tsx`
- `app/(auth)/welcome.tsx`
- `app/docs/privacy-policy.tsx`
- `app/docs/terms-of-service.tsx`
- `app/(tabs)/notes.tsx`
- `app/(tabs)/settings.tsx`
- `components/processing-status.tsx`
- `components/usage-status.tsx`

### packages/landing/
- `package.json` — `name` field
- `app/layout.tsx`
- `app/blog/layout.tsx`
- `app/blog/page.tsx`
- `app/docs/page.tsx`
- `app/privacy/page.tsx`
- `app/terms-of-service/page.tsx`
- `app/(landing)/layout.tsx`
- `app/(landing)/page.tsx`
- `app/(landing)/mobile/page.tsx`
- `app/(landing)/components/beta-request-form.tsx`
- `app/(landing)/components/faq-section.tsx`
- `app/(landing)/components/pricing-cards.tsx`
- `lib/github.ts`

### packages/release-notes/
- `package.json` — `name` field
- `src/index.ts`

### Plans (surgical path/name updates only)
- `plans/NEW-Phase-0.md` — update path references and name strings
- `plans/NEW-Plan-A.md` — update path references and name strings
- `plans/NEW-Plan-B.md` — update path references and name strings

In plan files, apply these path replacements:
- `/home/tanner/Projects/.note-companion` → `/home/tanner/Projects/.note-companion` (keep as-is, this is the local dir)
- `FileOrganizerPlugin` → `ZenithAIPlugin` (in code snippets within plans)
- `FileOrganizerSettings` → `ZenithAISettings` (in code snippets within plans)
- `FileOrganizer` → `ZenithAI` (in code snippets within plans)
- `Note Companion` → `Zenith-AI` (in prose within plans)
- `NoteCompanion` → `ZenithAI` (in code identifiers within plans)

---

## Critical rules

1. **Do NOT change any logic, imports structure, or file organization** — only names/strings
2. **Do NOT rename files on disk** — only change content within files
3. **Do NOT touch `pnpm-lock.yaml`** — it will regenerate
4. **Do NOT touch `node_modules/` or `dist/`**
5. **Preserve exact casing** — `ZenithAI` for PascalCase, `zenithAI` for camelCase, `zenith-ai` for kebab
6. **Be careful with `FileOrganizerPlugin`** — this is the main plugin class, rename to `ZenithAIPlugin` only if the current name is `FileOrganizerPlugin`. If it's just `FileOrganizer` (no Plugin suffix), rename to `ZenithAI`.

---

## Verification

After all renames:

1. `grep -r "FileOrganizer" --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v dist | grep -v pnpm-lock` — should have NO output
2. `grep -r "file-organizer" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yaml" | grep -v node_modules | grep -v dist | grep -v pnpm-lock` — should have NO output
3. `grep -r "Note Companion" --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v dist` — should have NO output
4. `grep -r "note-companion" --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v dist` — should have NO output (except maybe `meetings.json` path refs, which are fine)
5. `grep -r "fileorganizer" --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v dist` — should have NO output
6. `grep -r "ZenithAI" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist | wc -l` — should be > 200

Commit message: `refactor: rename Note Companion / FileOrganizer → Zenith-AI repo-wide`
