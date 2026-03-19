# Zenith-AI Plugin — Complete Feature & Settings Audit

> **Methodology**: Every entry below was derived entirely from the literal source code. No documentation, comments, or assumptions were used. Settings were traced from `settings.ts` → settings UI tabs → runtime consumption. Features were traced from entry points (commands, event handlers, services) through to execution.

---

## Table of Contents

1. [Settings Reference](#settings-reference)
2. [UI Panels & Tabs](#ui-panels--tabs)
3. [Commands & Ribbon](#commands--ribbon)
4. [Active Features — Fully Wired](#active-features--fully-wired)
5. [Partially Wired / Conditionally Active Features](#partially-wired--conditionally-active-features)
6. [Settings Present in Code but NOT Wired Up / Deprecated](#settings-present-in-code-but-not-wired-up--deprecated)
7. [Feature-Level Code Descriptions](#feature-level-code-descriptions)

---

## Settings Reference

All settings originate from `packages/plugin/settings.ts` → class `ZenithAISettings`.

| Setting Key | Default Value | Type | Settings Tab | Description |
|---|---|---|---|---|
| `API_KEY` | `""` | string | General | License key used as Bearer token for all server API calls |
| `defaultDestinationPath` | `"_ZenithAI/Processed"` | string | Vault Access | Output folder for processed inbox files |
| `pathToWatch` | `"_ZenithAI/Inbox"` | string | Vault Access | Inbox folder; `create`/`rename`/`modify` events here trigger processing |
| `logFolderPath` | `"_ZenithAI/Logs"` | string | Vault Access | Folder for processing logs (created on startup) |
| `backupFolderPath` | `"_ZenithAI/Backups"` | string | Vault Access | Pre-format backup destination; also destination when file is bypassed |
| `templatePaths` | `"_ZenithAI/Templates"` | string | Vault Access | Folder scanned for classification templates |
| `ignoreFolders` | `[""]` | string[] | Vault Access | Comma-separated folder paths excluded from organizer visibility; `"*"` ignores all |
| `enableFileRenaming` | `true` | boolean | Organization Preferences | Controls whether `recommendNameStep` renames files during inbox processing |
| `enableAtomicNotes` | `false` | boolean | Experiment | Gates `AtomicNotes` section in Organizer sidebar |
| `enableSearchGrounding` | `false` | boolean | _(not exposed in settings UI)_ | Passed as `enableSearchGrounding` in chat body to `/api/chat` |
| `enableDeepSearch` | `false` | boolean | _(not exposed in settings UI)_ | Passed as `deepSearch` in chat body to `/api/chat` |
| `selectedModel` | `"gpt-4o-mini"` | `"gpt-4o-mini" \| "llama3.2"` | _(Chat model selector UI)_ | Persisted model choice for the AI chat |
| `customModelName` | `"llama3.2"` | string | _(Chat model selector UI)_ | Custom Ollama model name when "Ollama Model" selected |
| `showLocalLLMInChat` | `false` | boolean | Advanced → Chat Features | Shows/hides the model selector dropdown in chat; when false model is locked to Cloud |
| `backgroundScribeEnabled` | `false` | boolean | Advanced → Chat Features | Allows `BackgroundScribe.activate()` to proceed; also used in activation guard |
| `debugMode` | `false` | boolean | Advanced → Logging & Debug | Calls `logger.configure(value)` to enable verbose console logging |
| `enableTitleSuggestions` | `false` | boolean | Experiment | Gates `RenameSuggestion` section in Organizer sidebar (marked Deprecated in UI) |
| `enableSelfHosting` | `false` | boolean | Advanced → Self-Hosting | Switches server URL from `https://app.notecompanion.ai` to `selfHostingURL` |
| `selfHostingURL` | `"http://localhost:3010"` | string | Advanced → Self-Hosting | Self-host server base URL (shown only when `enableSelfHosting` is true) |
| `vertexBrainUrl` | `"http://localhost:8085"` | string | Organization Preferences → Vault Intelligence | Vertex Brain gateway URL; if set + healthy, enables vector services |
| `enableVectorAutoSort` | `true` | boolean | Organization Preferences → Vault Intelligence | Gates embedding-based folder routing in inbox pipeline |
| `autoSortConfidenceThreshold` | `0.75` | number (0–1) | Organization Preferences → Vault Intelligence | Minimum ranker score to accept embedding folder recommendation |
| `organizationRulesPath` | `"System/Cosmic Vault Structure.md"` | string | Organization Preferences → Vault Intelligence | Path to Cosmic Vault Structure note; content is injected into folder recommendation API calls |
| `pinnedTag` | `"pinned"` | string | Organization Preferences → General Settings | Files with this tag skip `recommendFolderStep` (and `recommendFolderWithEmbeddingsStep`) |
| `projectsPath` | `"Projects"` | string | Organization Preferences → Vault Intelligence | Root directory for project detection in Background Scribe and Context tab |
| `autoDetectProjectContext` | `true` | boolean | _(not exposed in UI)_ | Declared in `settings.ts` but never read in any code path |
| `backgroundScribeOutputFile` | `"TODO.md"` | string | Organization Preferences → Background Scribe | File path where Background Scribe writes synthesized TODO items |

---

## UI Panels & Tabs

### Assistant Sidebar (`fo2k.assistant.sidebar2`)

Opened via ribbon icon (sparkle), or by the `open-*-tab` commands. Four tabs:

| Tab | Icon | Component | What it Shows |
|---|---|---|---|
| **Organizer** | Sparkles | `organizer.tsx` → `AssistantView` | AI suggestions for the currently open note: classification + format action, tags, folders, (optionally) title suggestions, (optionally) atomic notes |
| **Inbox** | Inbox | `InboxLogs` | Live processing log — file name, status, queued/processing/completed/error, new path, classification, added tags |
| **Chat** | MessageSquare | `AIChatSidebar` → `ChatComponent` | Multi-session AI chat with tool use, context items, model selector, background scribe toggle |
| **Context** | Compass | `ProjectContextTab` | Active project detection + semantically related vault files (requires Vertex Brain) |

The **Inbox** tab badge shows the count of currently active + queued files.

### Settings Panel (5 tabs)

Accessed via Obsidian Settings → Zenith-AI.

| Tab Label | Component File | Key Content |
|---|---|---|
| **General** | `general-tab.tsx` | License key input + Activate button, Usage Statistics (token bar + audio transcription bar), Quick Tutorial iframe, support link; also embeds `AccountData` (sign-up/sign-in, Top-up Credits, Top-up Minutes) |
| **Organization Preferences** | `customization-tab.tsx` | Inbox Auto-Renaming toggle, Pinned Tag input, Vertex Brain URL, Enable Vector Auto-Sort toggle, Auto-Sort Confidence Threshold number input, Projects Path, Cosmic Vault Structure Path, Scribe Output File |
| **Vault Access** | `file-config-tab.tsx` | Folder browser (All / Active Paths / Ignored tabs), Inbox folder, Log folder, Output folder, Ignore folders, Backup folder, Templates folder, Restore Default Templates button |
| **Experiment** | `experiment-tab.tsx` | Atomic Notes toggle, Title Suggestions toggle (marked Deprecated) |
| **Advanced** | `advanced-tab.tsx` | Debug Mode toggle, Enable Self-Hosting toggle + Server URL input (conditional), Enable Local LLM in Chat toggle, Background Scribe toggle |

### Processing Status Bar

A React component (`ProcessingStatusBar`) mounted in the Obsidian status bar on plugin load. Reads live queue analytics from `Inbox.getInstance().getAnalytics()`.

---

## Commands & Ribbon

All commands registered in `index.ts` `onload()` and `commandHandlers.ts`:

| Command ID | Name | Behavior |
|---|---|---|
| `open-organizer-tab` | Open Organizer Tab | Opens/focuses sidebar; activates "organizer" tab |
| `open-inbox-tab` | Open Inbox Tab | Opens/focuses sidebar; activates "inbox" tab |
| `open-chat-tab` | Open Chat Tab | Opens/focuses sidebar; activates "chat" tab |
| `open-context-tab` | Open Cosmic Context Tab | Opens/focuses sidebar; activates "context" tab |
| `process-inbox-now` | Process inbox now | Immediately reads `pathToWatch` folder content and enqueues all files |
| `restore-default-templates` | Restore default templates | Shows a confirmation modal then restores bundled templates to `templatePaths` folder |
| `add-selection-to-chat` | Add Selection to Chat | Grabs editor selection → calls `addTextSelectionContext()` → opens chat tab |
| `add-to-inbox` | Put in inbox | Renames the active file to `pathToWatch/<filename>`, triggering inbox processing |

**Ribbon**: Single icon ("sparkle" → "Zenith-AI") that calls `ensureAssistantView()`.

---

## Active Features — Fully Wired

### Inbox Processing Pipeline

**Entry points**: Vault `create` event (file in `pathToWatch`), vault `rename` event (file renamed into `pathToWatch`), vault `modify` event for media files in `pathToWatch`, and plugin `onload` → `processBacklog()`.

**Pipeline steps** (in order, `inbox/index.ts`):

1. **Validate extension** (`hasValidFileStep`) — rejects unsupported types; bypassed files are moved to `backupFolderPath`.
2. **Create container** (`getContainerFileStep`) — for PDFs, creates an `.md` wrapper file; for all other types the file itself is the container.
3. **Move attachment** (`moveAttachmentFile`) — stub; media files stay in place (feature removed).
4. **Extract content** (`getContentStep`) — for `.md`: reads vault; for `.pdf`: runs `pdf.js` text extraction. Content written to container file.
5. **Sanitize content** (`cleanupStep`) — strips problematic characters; bypasses files with fewer than 5 non-frontmatter characters.
6. **Embed-based folder routing** (`recommendFolderWithEmbeddingsStep`) — only if `enableVectorAutoSort` is true AND `vertexBrainClient` is healthy. Runs vector search on content → tallies folder frequencies → ranks top 10 candidates via `VertexBrainClient.rank()` → applies folder if confidence ≥ `autoSortConfidenceThreshold`. Falls through to model routing if unavailable or below threshold.
7. **Classification** (`recommendClassificationStep`) — POST to `/api/classify1` with content (first 1000 chars) + template names from `templatePaths` folder. Result stored on context; triggers formatting.
8. **Model folder routing** (`recommendFolderStep`) — only runs if embedding step did NOT resolve a folder. POST to `/api/folders/v2`. Reads `organizationRulesPath` content and injects as `customInstructions`. Skips if file has `pinnedTag`.
9. **File rename** (`recommendNameStep`) — POST to `/api/title/v2`. Renames file if suggestion differs from current name. Only runs if `enableFileRenaming` is true (checked implicitly — it is always called; the `enableFileRenaming` setting gates nothing in the pipeline itself — **see partially wired section**).
10. **Format content** (`formatContentStep`) — reads matching template from `templatePaths`, streams formatted content via `/api/format-stream` back into the container file. Creates backup first via `backupTheFileAndAddReferenceToCurrentFile`. Only runs if classification confidence ≥ 80.
11. **Append attachment** (`appendAttachmentStep`) — appends `![[attachment.path]]` link in container file for media files.
12. **Tag recommendation** (`recommendTagsStep`) — POST to `/api/tags/v2`; appends suggested tags to file.
13. **Complete** — marks record as completed.

Concurrency: max 5 concurrent tasks overall; max 2 media tasks simultaneously.

### Organizer Sidebar (Organizer tab)

Activated by opening a markdown or PDF file with the sidebar visible and the right panel not collapsed. Watches `file-open` and `active-leaf-change` events (debounced 300ms).

Sections rendered per active file:

- **Classification + Format** (`ClassificationContainer` → `ai-format/templates`): Calls `/api/classify1` and offers format-in-place or format-in-split-view actions.
- **Tags** (`SimilarTags`): Calls `/api/tags/v2`; renders clickable tag chips to append to current file.
- **Folders** (`SimilarFolderBox`): Calls `/api/folders/v2`; renders folder suggestions with move action.
- **Titles** (`RenameSuggestion`): Calls `/api/title/v2`. **Only rendered when `enableTitleSuggestions` is true.**
- **Atomic Notes** (`AtomicNotes`): Calls `/api/concepts-and-chunks`. **Only rendered when `enableAtomicNotes` is true.**

Empty states shown for: no active file, file in ignored folder, media file, empty file.

### AI Chat Sidebar (Chat tab)

Multi-session chat powered by `@ai-sdk/react` → `useChat`. Sessions persisted via `ChatHistoryManager` (uses Obsidian app for storage). Max 10 tabs visible at a time.

**Chat request body** sent to `<serverUrl>/api/chat`:
- `messages` — conversation history
- `currentDatetime` — ISO timestamp (computed once per mount)
- `newUnifiedContext` — JSON of all context items (files, folders, tags, searchResults, currentFile, textSelections) + optional editor selection/cursor context
- `model` — `plugin.settings.selectedModel`
- `enableSearchGrounding` — `plugin.settings.enableSearchGrounding` OR model is a search-preview variant
- `deepSearch` — `plugin.settings.enableDeepSearch`

**Context items** (addable via `@` mention in chat input):
- `@file` — attaches a specific vault file with content
- `@folder` — attaches all files in a folder
- `@tag` — attaches all files with a given tag
- Text selections (via "Add Selection to Chat" command)
- Current open file (automatically tracked)

**Tool use**: `maxSteps: 5`. Tool invocations handled via `ToolInvocationHandler` and `SearchAnnotationHandler`.

**Local LLM mode**: When `showLocalLLMInChat` is true, the model selector dropdown appears. Selecting "Ollama Model" routes the request locally via `ollama-ai-provider` → `streamText()` directly in the plugin (no server). Model name from `customModelName`.

**Background Scribe toggle**: A button in the chat header (only visible when `backgroundScribe` instance exists, i.e., Vertex Brain is healthy). Clicks call `plugin.backgroundScribe.activate()` or `.deactivate()`. On each chat completion (`onFinish`), the workspace event `vault-intelligence:chat-turn` is fired with `conversationSummary` and `activeFile`. `BackgroundScribe` listens for this event.

**Export options**: Export chat to vault as markdown or copy to clipboard (`export-chat-as-markdown.ts`).

**Context limit indicator** (`ContextLimitIndicator`): Tracks context token usage and warns when nearing limits; switches to lightweight mode (content stripped from context items) automatically.

### Vault Intelligence — Vertex Brain Integration

Initialized in `onload()`. conditional on: `enableVectorAutoSort === true` AND `vertexBrainUrl` non-empty AND `VertexBrainClient.health()` returning `true`.

**VaultIndexer**: On startup, indexes all markdown files via `indexAll()`. On every vault `modify` event for `.md` files, enqueues the file for re-indexing. Each index operation sends content (up to 6000 chars), folder path, and tags to `VertexBrainClient.vectorUpsert()` (`POST /v1/vector-upsert`). Rate limited to 1 file per 150ms.

**VertexBrainClient** endpoints used:
- `/health` — health check (5s timeout)
- `/v1/embed` — text → float[] embedding (8000 char limit)
- `/v1/vector-upsert` — upsert a note's embedding + metadata
- `/v1/vector-search` — semantic search by query string, returns ranked results with similarity scores
- `/v1/rank` — reranks a list of folder candidate strings against content
- `/v1/answer` — RAG-style answer generation (used by Background Scribe for TODO synthesis)

**OrganizationPreferencesService**: Reads/writes the Cosmic Vault Structure file (`organizationRulesPath`). Caches content for 30s. Content is injected as `customInstructions` into folder recommendation API calls.

**BackgroundScribe**: Requires `backgroundScribeEnabled === true` AND Vertex Brain healthy. Listens for `vault-intelligence:chat-turn` workspace events. Buffers conversation summaries; 30s debounce before synthesis. On synthesis: detects active project via `projectsPath`, runs vector search, calls `VertexBrainClient.answer()`, writes result to `backgroundScribeOutputFile`.

### Event-Driven Inbox Triggers

`registerEventHandlers()` (called on `layoutReady`):
- Vault `create` event → if file lands in `pathToWatch` → enqueue.
- Vault `rename` event → if new path is in `pathToWatch` → enqueue.
- Vault `modify` event → if file is in `pathToWatch` AND extension is in `VALID_MEDIA_EXTENSIONS` → enqueue.

Global `modify` event on index.ts level: any `.md` file modified anywhere → `vaultIndexer.enqueue(file)`.

### Account & Auth (Settings → General)

- **License key input**: Validates format locally via `validateApiKey()`. Saves to `API_KEY` immediately on change.
- **Sign up / Sign in**: POSTs to `/api/sign-up` or `/api/sign-in`; retrieves `licenseKey` from response.
- **Usage Stats**: Fetches from `/api/public-usage` (primary) or `/api/usage` (fallback). Displays token usage bar and audio transcription minutes bar (if plan includes). Shows plan name and subscription status.
- **Top-up Credits / Top-up Minutes**: Components that open external payment/credit URLs.
- **Open Account Portal**: Opens `<serverUrl>/sign-in` in browser.
- **Dev Mode**: If `/api/health` returns `environment: "development"`, shows development token top-up UI.

---

## Partially Wired / Conditionally Active Features

### `enableFileRenaming` Setting

- **UI**: Toggled in Organization Preferences tab as "Inbox Auto-Renaming".
- **Reality**: The `recommendNameStep` in the inbox pipeline is always called — it is NOT gated by `enableFileRenaming`. The setting is read nowhere in the inbox pipeline. This setting has NO runtime effect. It is UI-only.

### `enableSearchGrounding` Setting

- **UI**: Not exposed in any settings tab — only writeable from code.
- **Runtime**: Read in `chat.tsx` `chatBody`/`prepareRequestBody` and sent to `/api/chat` as `enableSearchGrounding`. Also triggered automatically when `selectedModel` is `gpt-4o-search-preview` or `gpt-4o-mini-search-preview`.
- **Status**: Functional at API level, but has no user-facing toggle. Cannot be controlled by the user.

### `enableDeepSearch` Setting

- **UI**: Not exposed in any settings tab.
- **Runtime**: Read in `chat.tsx` and sent to `/api/chat` as `deepSearch`.
- **Status**: Functional at API level, but has no settings UI. User cannot toggle it.

### `autoDetectProjectContext` Setting

- **Declared**: In `settings.ts` with default `true`.
- **Read anywhere**: Never read in any file in the codebase.
- **Status**: Dead field. No effect whatsoever.

### `enableAtomicNotes` Setting

- **UI**: Toggled in Experiment tab.
- **Runtime**: If `true`, renders `AtomicNotes` component in the Organizer sidebar, which calls `/api/concepts-and-chunks`.
- **Status**: Functional when enabled. Off by default.

### `enableTitleSuggestions` Setting

- **UI**: Toggled in Experiment tab; UI explicitly labels it "**Deprecated**".
- **Runtime**: If `true`, renders `RenameSuggestion` section in the Organizer sidebar.
- **Status**: Functional when enabled but marked for removal.

### Cosmic Context Tab (`context`)

- **UI**: Fourth tab in the sidebar with Compass icon.
- **Runtime**: Requires `plugin.vertexBrainClient` to be non-null. Listens for `vault-intelligence:chat-turn` events fired during chat. Shows active project (detected from file path against `projectsPath`) and semantically similar files (filtered at similarity > 0.65).
- **Status**: Fully coded; only activates on chat turn events, so it is empty until user chats. Requires Vertex Brain to be configured and healthy.

### `BackgroundScribe` / `backgroundScribeEnabled`

- **UI**: Toggle in Advanced tab; separate `backgroundScribeOutputFile` in Organization Preferences.
- **Runtime**: The scribe instance is only created if Vertex Brain is healthy at startup. If Vertex Brain is unavailable, the toggle in Advanced settings does nothing (there is no instance to activate). The toggle in the chat header appears only when the instance exists.
- **Status**: Fully coded, conditionally available based on Vertex Brain health.

---

## Settings Present in Code but NOT Wired Up / Deprecated

| Setting Key | Status | Evidence |
|---|---|---|
| `autoDetectProjectContext` | **Dead** — never read anywhere in the codebase | Grep of all `.ts`/`.tsx` files returns zero consumers outside `settings.ts` |
| `enableSearchGrounding` | **No UI** — functional but inaccessible to users | Not referenced in any settings tab component |
| `enableDeepSearch` | **No UI** — functional but inaccessible to users | Not referenced in any settings tab component |
| `enableFileRenaming` | **UI only** — saves to settings but gates nothing in the pipeline | `recommendNameStep` never checks this flag |
| `enableTitleSuggestions` | **Deprecated** — labeled as such in the UI; will be removed | Still renders the `RenameSuggestion` component when true |

---

## Feature-Level Code Descriptions

### Inbox Pipeline — What Happens to a File

When a `.md` or `.pdf` file is created/renamed/modified into `pathToWatch`:

1. The `Inbox` singleton's concurrent queue (max 5 tasks, max 2 media) picks it up.
2. A `ProcessingContext` is assembled and a hash generated from the file to track state.
3. The file is validated for supported extension; unsupported → moved to `backupFolderPath`.
4. For PDFs: a new `.md` container is created; `pdf.js` extracts all text page by page and writes it to the container.
5. Content is sanitized (< 5 chars after stripping frontmatter → bypass to backup folder).
6. If `enableVectorAutoSort` AND Vertex Brain healthy: content is sent to `/v1/vector-search` → top similar notes tallied by folder → top 10 ranked via `/v1/rank`. If best score ≥ `autoSortConfidenceThreshold`, the file is moved there immediately without calling the cloud API.
7. In parallel: classify (first 1000 chars → `/api/classify1` → returns a template name), rename (first 1000 chars → `/api/title/v2`), and (if embeddings didn't resolve folder) folder route (first 1000 chars → `/api/folders/v2` with Cosmic Vault Structure injected as instructions).
8. Classification result + template from `templatePaths` → streaming format via `/api/format-stream` back into the file. A timestamped backup copy is created in `backupFolderPath` before formatting. The current file and backup each get a wikilink pointing to the other.
9. Tags from `/api/tags/v2` are appended (skipping any already present in frontmatter or as inline tags).
10. The record is marked "completed."

### AI Chat — How Context Is Built

Each request to `/api/chat` includes a `newUnifiedContext` JSON string. This is built from a Zustand store (`useContextItems`) containing:
- **files**: Vault files explicitly attached via `@file` mention; content included unless in lightweight mode.
- **folders**: Vault folders attached via `@folder`; content of all children included.
- **tags**: Tag groups attached via `@tag`.
- **currentFile**: The currently open Obsidian file (automatically tracked).
- **textSelections**: Snippets from "Add Selection to Chat" command.
- **searchResults**: Results from slash-command searches.

**Lightweight mode** is engaged automatically when total context size nears the context window limit — content is stripped, only metadata (path, name) is retained.

Additionally, **editor context** is always captured fresh per-request: current cursor position, current line, any selected text, file path.

### Vertex Brain Architecture

`VertexBrainClient` is a thin HTTP client wrapping the self-hosted Vertex Brain gateway. All requests go to `settings.vertexBrainUrl`. The plugin does not require Vertex Brain — all Vertex-dependent code paths check `plugin.vertexBrainClient` for null before executing.

`VaultIndexer` maintains a rate-limited queue (150ms between files) that calls `vectorUpsert` for every modified or newly indexed markdown file. On startup, all vault markdown files are indexed in one pass.

`OrganizationPreferencesService` reads the user's Cosmic Vault Structure note (a markdown file at `organizationRulesPath`) and caches it for 30 seconds. Its content is injected into the folder recommendation prompt as organizational rules.

### Background Scribe — Data Flow

1. User enables Background Scribe (toggle in Advanced Settings or chat header button).
2. `BackgroundScribe.activate()` is called; must pass the `backgroundScribeEnabled` guard.
3. It registers a listener for `vault-intelligence:chat-turn` workspace events.
4. After each chat turn completes, the chat component fires this event with `{ conversationSummary, activeFile }`.
5. Scribe pushes the summary to an in-memory buffer and sets/resets a 30-second debounce timer.
6. When the debounce fires: active project is detected from the current file's path (uses `projectsPath`), vector search finds related files, `VertexBrainClient.answer()` generates TODO items, result is written to `backgroundScribeOutputFile` (creates parent directories if needed; overwrites existing file).

### Tag Sanitization

All auto-appended tags go through `sanitizeTag()` and then a deduplication check against both frontmatter tags and inline tags before appending. The tag cleanup routine (`cleanupTagsInContent`) post-processes AI-generated content to strip leading `#` from frontmatter tags, convert spaces to underscores, and remove double-hashes (`##tag` → `#tag`) from inline tags.

### Backup System

Every format-in-place operation creates a timestamped backup: `<basename>_backup_YYYYMMDD_HHmmss.<ext>` in `backupFolderPath`, with a collision-avoidance counter appended if the name already exists. The original file gets a wikilink to the backup; the backup gets a wikilink to the formatted file.

### Supported File Types

| Category | Extensions |
|---|---|
| Images | `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp` |
| Audio | `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm` |
| Documents | `pdf` |
| Text | `md`, `txt` |

Media files (images, audio, PDF) in the inbox trigger a PDF-style container creation (a `.md` wrapper). For images/audio, the wrapper is created empty and the attachment is appended as `![[file.path]]`. The media concurrency cap is 2 simultaneous tasks.

### Server URL Resolution

`getServerUrl()`:
- If `enableSelfHosting` is `false` → `"https://app.notecompanion.ai"`
- If `enableSelfHosting` is `true` → `selfHostingURL` (trailing slash stripped)

All API calls (`/api/chat`, `/api/classify1`, `/api/title/v2`, `/api/folders/v2`, `/api/tags/v2`, `/api/format`, `/api/format-stream`, `/api/concepts-and-chunks`, `/api/usage`, `/api/public-usage`, `/api/sign-up`, `/api/sign-in`) use this URL as the base. The `API_KEY` is sent as `Authorization: Bearer <key>` on all requests except sign-up/sign-in.

### Model Migration

On `loadSettings()`, if `selectedModel` is `"gpt-4.1-mini"` (old name), it is automatically migrated to `"gpt-4o-mini"` and saved.
