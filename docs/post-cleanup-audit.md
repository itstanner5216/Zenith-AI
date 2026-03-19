# Zenith-AI — Post-Cleanup Feature & Settings Audit

> **Branch:** `cleanup/settings-purge`
> **Date:** 2026-03-18
> **Scope:** Plugin (`packages/plugin`), Web backend (`packages/web`), environment variables

---

## Table of Contents

1. [Not Wired Up / Dead Code](#not-wired-up--dead-code)
2. [Plugin Settings](#plugin-settings)
3. [Settings UI Tabs](#settings-ui-tabs)
4. [Sidebar Tabs & Views](#sidebar-tabs--views)
5. [Inbox Processing Pipeline](#inbox-processing-pipeline)
6. [AI Chat System](#ai-chat-system)
7. [Chat Tools (Client-Executed)](#chat-tools-client-executed)
8. [Vault Intelligence Services](#vault-intelligence-services)
9. [Plugin Commands](#plugin-commands)
10. [Web API Endpoints](#web-api-endpoints)
11. [Web Environment Variables](#web-environment-variables)

---

## Not Wired Up / Dead Code

Items that exist in settings or code but are **not functionally connected** or have **no runtime effect**.

| Item | Location | Issue |
|---|---|---|
| `autoDetectProjectContext` | `settings.ts:35` | Defined in settings class, **never read** anywhere in the codebase. No consumer exists. |
| `enableTitleSuggestions` | `settings.ts:23` | Gates a deprecated UI panel in `organizer.tsx:390`. The panel renders title suggestions but the feature description says it's deprecated and should be removed. |
| `enableAtomicNotes` | `settings.ts:13` | Gates a panel in `organizer.tsx:417`. The panel renders an "atomic notes" view, but the feature's actual generation logic is server-side and its real-world utility is unclear. |
| `Inbox.getFileStatus()` | `inbox/index.ts` | Method body is `return undefined;` — always returns nothing. Dead code. |
| `Inbox.getFileEvents()` | `inbox/index.ts` | Method body is `return [];` — always returns nothing. Dead code. |
| `settingsSchema` in `tools.ts` | `web: chat/tools.ts:3-13` | Zod schema for `renameInstructions` and `customFolderInstructions` defined at top of file but **never used** — these settings were deleted from the plugin. |
| `settingsSchema` in `tools.ts` | `web: chat/tools.ts:3-13` | Defines `renameInstructions` and `customFolderInstructions` as parameters for the `generateSettings` tool. However, these settings were **deleted from the plugin** during cleanup — the `generateSettings` tool handler (`settings-update-handler.tsx`) may apply values to nonexistent settings fields. Needs audit. |

---

## Plugin Settings

All settings defined in `packages/plugin/settings.ts` on the cleanup branch.

### Authentication

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `API_KEY` | `string` | `""` | Bearer token sent as `Authorization` header on every API call to the web backend (`getServerUrl()/api/*`). Validated client-side by `validateApiKey()` in `apiUtils.ts` for format (starts with valid prefix). Used throughout `index.ts` for all `fetch()` calls. |

### Folder Paths

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `defaultDestinationPath` | `string` | `"_ZenithAI/Processed"` | Target folder for files after inbox processing. Used in `moveFile()` as the fallback destination when no AI-suggested folder is chosen. Also excluded from user folder lists and search context. |
| `pathToWatch` | `string` | `"_ZenithAI/Inbox"` | Folder monitored for new files. `registerEventHandlers()` watches this path and auto-enqueues any file created/moved here into the `Inbox` queue. `processBacklog()` scans this folder on startup. |
| `logFolderPath` | `string` | `"_ZenithAI/Logs"` | Directory created on plugin init (`ensureFolderExists`). Used by the `RecordManager` to persist processing logs as JSON files. Each inbox run writes a log entry here. |
| `backupFolderPath` | `string` | `"_ZenithAI/Backups"` | Destination for file backups before destructive formatting operations. `backupTheFileAndAddReferenceToCurrentFile()` copies the original file here with a timestamped name. Also used as the fallback error/bypass folder (consolidated from the deleted `errorFilePath` and `bypassedFilePath`). |
| `templatePaths` | `string` | `"_ZenithAI/Templates"` | Folder containing classification templates (e.g., `meeting_note.md`, `enhance.md`). Read by `getTemplateInstructions()` and `getTemplateNames()`. Templates drive the formatting instruction for `formatStream()`. Created with defaults on first run. |

### Folder Filtering

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `ignoreFolders` | `string[]` | `[""]` | Comma-separated list in UI, stored as array. `getAllUserFolders()` excludes these plus all system paths (`_ZenithAI/*`). If set to `["*"]`, **all** folders are excluded from AI folder suggestions. |

### Inbox Processing

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `enableFileRenaming` | `boolean` | `true` | When `true`, the inbox pipeline's rename step calls `plugin.recommendName()` to get AI-suggested filenames and renames the processed file. When `false`, the file keeps its original name. Toggled in Customization tab → "Inbox Auto-Renaming". |

### Model & Chat

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `selectedModel` | `"gpt-4o-mini" \| "llama3.2"` | `"gpt-4o-mini"` | Sent in the `body` of `useChat()` requests as the `model` field. The web backend uses this to select the AI model for chat completions. Migration: auto-fixes `"gpt-4.1-mini"` → `"gpt-4o-mini"` on load. |
| `customModelName` | `string` | `"llama3.2"` | When the user selects "custom" in the model selector, this value is used as the Ollama model identifier. Sent to the `ollama()` provider for local inference. Editable inline in the model selector dropdown. |
| `showLocalLLMInChat` | `boolean` | `false` | Gates the model selector dropdown in the chat UI. When `false`, the selector shows "Cloud" as non-interactive text. When `true`, clicking opens a dropdown with Cloud and Ollama model options. Also enables the local Ollama routing path in `chat.tsx`. |
| `enableSearchGrounding` | `boolean` | `false` | Sent in the chat request `body.enableSearchGrounding`. The web backend uses this to enable Tavily-based web search grounding alongside the AI response. Also togglable per-message via the search toggle button in the chat input bar (`search-toggle.tsx`). |
| `enableDeepSearch` | `boolean` | `false` | Sent in the chat request `body.deepSearch`. Enables deeper, multi-step web search on the backend. Togglable per-message via the search toggle button (second toggle in `search-toggle.tsx`). |
| `backgroundScribeEnabled` | `boolean` | `false` | Master toggle for the Background Scribe service. When toggled in settings, `BackgroundScribe.activate()` or `.deactivate()` is called. The scribe listens for `vault-intelligence:chat-turn` workspace events, buffers conversation summaries, and debounce-synthesizes TODO items. |

### Debug & Hosting

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `debugMode` | `boolean` | `false` | Passed to `logger.configure()`. When `true`, the `LoggerService` emits `console.log`/`console.warn`/`console.error` for all log calls. When `false`, all logging is silently suppressed. |
| `enableSelfHosting` | `boolean` | `false` | `getServerUrl()` returns `selfHostingURL` when `true`, otherwise returns `"https://app.notecompanion.ai"`. Allows running the web backend on your own infrastructure. |
| `selfHostingURL` | `string` | `"http://localhost:3010"` | The URL used when `enableSelfHosting` is `true`. Trailing slashes are stripped automatically. All API calls go to this base URL. |

### Vault Intelligence

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `vertexBrainUrl` | `string` | `"http://localhost:8085"` | Base URL of the Vertex Brain gateway (a local Docker service running `Zeniths-Vectors/`). On plugin load, a `VertexBrainClient` is created with this URL and a health check is performed. If unhealthy, vector auto-sort is disabled for the session. |
| `enableVectorAutoSort` | `boolean` | `true` | Master toggle for the vector-based auto-sort system. When `true` AND `vertexBrainUrl` is healthy, the `VaultIndexer` indexes all markdown files on startup and re-indexes on modify events. The inbox pipeline uses vector similarity for folder suggestions. |
| `autoSortConfidenceThreshold` | `number` | `0.75` | Minimum similarity score (0–1) from vector search for a folder suggestion to be auto-applied without showing the suggestion UI. Used in `inbox/index.ts` during the `shouldSkipAction()` decision. |
| `organizationRulesPath` | `string` | `"System/Cosmic Vault Structure.md"` | Path to a vault note defining the user's folder organization rules. Read by `OrganizationPreferencesService.getRules()` and injected as context into AI folder/tag recommendation prompts. The chat tool `update_vault_structure` writes to this file. Auto-created with a template if it doesn't exist. |
| `pinnedTag` | `string` | `"pinned"` | Files with this tag are excluded from auto-sort. The inbox pipeline checks for this tag before moving files. Referenced in the Cosmic Vault Structure template. |
| `projectsPath` | `string` | `"Projects"` | Root directory used for project detection. `detectProjectFromPath()` in `context/index.tsx` regex-matches `{projectsPath}/([^/]+)` against file paths to determine the active project context. Also used by Background Scribe for project-scoped TODO synthesis. |
| `autoDetectProjectContext` | `boolean` | `true` | ⚠️ **NOT WIRED UP.** Defined in settings but never read anywhere in the codebase. Intended to control whether project context detection runs automatically. |
| `backgroundScribeOutputFile` | `string` | `"TODO.md"` | File path where Background Scribe writes synthesized TODO items. `BackgroundScribe.writeOutputFile()` creates or appends to this file after debounced synthesis. |

### Experiments

| Setting | Type | Default | Code-Level Description |
|---|---|---|---|
| `enableAtomicNotes` | `boolean` | `false` | Gates the Atomic Notes panel in the organizer sidebar (`organizer.tsx:417`). When enabled, the sidebar shows a section that breaks the current note into standalone atomic notes. The actual splitting is done via the `/api/concepts-and-chunks` endpoint. |
| `enableTitleSuggestions` | `boolean` | `false` | ⚠️ **Deprecated.** Gates the Title Suggestions panel in the organizer sidebar (`organizer.tsx:390`). Calls `plugin.recommendName()` to show AI-suggested titles for the current file. The experiment tab UI marks this as deprecated with instructions to use inbox auto-renaming instead. |

---

## Settings UI Tabs

The settings view (`packages/plugin/views/settings/view.tsx`) renders five tabs:

### General Tab (`general-tab.tsx`)

- **API Key input** — text field for `API_KEY`, validated with `validateApiKey()` (format check, not server round-trip)
- **Key status indicator** — shows valid/invalid/checking/idle based on format validation
- **Usage stats display** — fetches from `plugin.fetchUsageStats()` → `GET /api/public-usage` or `GET /api/usage`, shows token usage bar and audio minutes
- **Top Up Credits** — renders a `TopUpCredits` component for purchasing additional tokens
- **Account Data** — renders an `AccountData` component showing user/email info

### Customization Tab (`customization-tab.tsx`) — "Organization Preferences"

- **Inbox Auto-Renaming** toggle → `enableFileRenaming`
- **Pinned Tag** text input → `pinnedTag`
- **Vertex Brain URL** text input → `vertexBrainUrl`
- **Enable Vector Auto-Sort** toggle → `enableVectorAutoSort`
- **Auto-Sort Confidence Threshold** number input (0–1) → `autoSortConfidenceThreshold`
- **Projects Path** text input → `projectsPath` (sanitized on blur)
- **Cosmic Vault Structure Path** text input → `organizationRulesPath`
- **Scribe Output File** text input → `backgroundScribeOutputFile` (sanitized on blur)

### File Config Tab (`file-config-tab.tsx`) — "Vault Access"

- **Inbox Folder** text input → `pathToWatch`
- **Log Folder** text input → `logFolderPath`
- **Output Folder** text input → `defaultDestinationPath`
- **Ignore Folders** text input (comma-separated) → `ignoreFolders`
- **Backup Folder** text input → `backupFolderPath`
- **Templates Folder** text input → `templatePaths`
- **Folder Browser** — interactive panel with All/Active/Ignored tabs showing vault folder structure with search
- **Path validation** — checks folder existence on change, shows warnings
- **Restore Default Templates** button — calls `plugin.restoreTemplates()`

### Experiment Tab (`experiment-tab.tsx`)

- **Atomic Notes** toggle → `enableAtomicNotes`
- **Title Suggestions (Deprecated)** toggle → `enableTitleSuggestions` — shows deprecation notice in UI

### Advanced Tab (`advanced-tab.tsx`)

- **Debug Mode** toggle → `debugMode` (also calls `logger.configure()`)
- **Enable Self-Hosting** toggle → `enableSelfHosting`
- **Server URL** text input (shown only when self-hosting enabled) → `selfHostingURL`
- **Enable Local LLM in Chat** toggle → `showLocalLLMInChat`
- **Background Scribe** toggle → `backgroundScribeEnabled` (also calls `activate()`/`deactivate()`)

---

## Sidebar Tabs & Views

The assistant sidebar (`packages/plugin/views/assistant/view.tsx`) has four tabs:

| Tab | Icon | Component | Description |
|---|---|---|---|
| **Organizer** | Sparkles | `AssistantView` | Shows the active file's AI-generated classification, tag suggestions, folder suggestions, and formatting options. Contains the deprecated Title Suggestions and Atomic Notes sub-panels (gated by settings). |
| **Inbox** | Inbox | `InboxLogs` | Displays processing status for files in the inbox queue. Shows log entries from `RecordManager` with status (queued/processing/completed/error), new paths, tags, and error messages. |
| **Chat** | MessageSquare | `AIChatSidebar` | Full AI chat interface with streaming responses, tool execution, context items, search grounding, model selection, chat history, and Background Scribe integration. |
| **Context** | Compass | `ProjectContextTab` | Shows the detected project context based on the active file's path and vector-similar files. Listens for `vault-intelligence:chat-turn` events to update dynamically. Requires a healthy Vertex Brain connection. |

---

## Inbox Processing Pipeline

Located in `packages/plugin/inbox/index.ts`. Singleton `Inbox` class with a concurrent queue.

**Flow:**
1. **File detection** — `registerEventHandlers()` watches `pathToWatch` for file creates/renames
2. **Enqueue** — files are added to the queue (max 5 concurrent regular, 2 concurrent media)
3. **Process** — for each file:
   - Extract text (`getTextFromFile()` — reads markdown or uses `extractTextFromPDF()` with pdf.js)
   - Classify content via `POST /api/classify1` using template names
   - Get formatting instruction from matching template file
   - Format via `POST /api/format-stream` (streaming)
   - Recommend tags via `POST /api/tags/v2`
   - Recommend folders via `POST /api/folders/v2` (includes Cosmic Vault Structure rules as context)
   - Rename file if `enableFileRenaming` is on via `POST /api/title/v2`
   - Move to destination folder
   - Append tags (inline, not frontmatter)
4. **Logging** — `RecordManager` tracks each step's status and writes JSON logs to `logFolderPath`
5. **Error handling** — failed files are moved to `backupFolderPath`

**Hardcoded values (post-cleanup):**
- Content cutoff: `1000` chars for API sampling (was `contentCutoffChars` setting)
- PDF pages: reads **all pages** (was limited by `pdfPageLimit`)
- Tags: always appended inline (was controlled by `useSimilarTagsInFrontmatter`)
- Format behavior: always **override** (was `formatBehavior` setting)
- Sync folder: hardcoded `"_ZenithAI/Sync"` (was `syncFolderPath` setting)

---

## AI Chat System

Located in `packages/plugin/views/assistant/ai-chat/chat.tsx`.

**Architecture:** Hybrid streaming chat using Vercel AI SDK's `useChat` hook.

- **Cloud path:** `POST {serverUrl}/api/chat` with bearer auth, sends messages + context + model + search flags
- **Local path:** When `showLocalLLMInChat` is on and custom model selected, uses `ollama()` provider for local inference via `streamText()` (no server round-trip for the AI call itself)
- **Context injection:** Builds a `contextString` from attached files, folders, tags, search results, text selections, and current file content. Sent in `body.newUnifiedContext`
- **Search grounding:** `body.enableSearchGrounding` and `body.deepSearch` flags enable web search on the backend
- **Tool execution:** Server defines tools (no `execute` function), AI decides to call them, client receives `toolInvocations` and routes to handler components that execute locally using Obsidian API
- **Chat history:** `ChatHistoryManager` persists sessions to a `.zenith-ai-chat-history.json` file in the vault root
- **Background Scribe integration:** Emits `vault-intelligence:chat-turn` events with conversation summaries; scribe icon in header shows active/inactive state

---

## Chat Tools (Client-Executed)

Defined server-side in `packages/web/app/api/(newai)/chat/tools.ts`, executed client-side in `packages/plugin/views/assistant/ai-chat/tool-handlers/`.

### Search & Discovery

| Tool | Handler | Description |
|---|---|---|
| `getSearchQuery` | `search-handler.tsx` | Searches vault files by content using keyword matching on all markdown files. Returns matching file titles, content, and paths. |
| `searchByName` | `search-rename-handler.tsx` | Searches files by name pattern (glob-like matching). |
| `getLastModifiedFiles` | `last-modified-handler.tsx` | Returns the N most recently modified files from the vault. |
| `getNotesForDateRange` | `date-range-handler.tsx` | Finds files created or modified within a date range. |
| `getTaggedFiles` | `tagged-files-handler.tsx` | Finds files containing specific tags using metadata cache. Supports AND/OR matching and exclusions. |
| `getBacklinks` | `backlinks-handler.tsx` | Gets all files linking to specified files (incoming links). |
| `getOutgoingLinks` | `outgoing-links-handler.tsx` | Gets all outgoing links and embeds from specified files. |
| `getHeadings` | `headings-handler.tsx` | Extracts heading structure (H1-H6) from files. |
| `findBrokenLinks` | `broken-links-handler.tsx` | Scans for unresolved `[[wikilinks]]` in the vault. |

### Content Manipulation

| Tool | Handler | Description |
|---|---|---|
| `appendContentToFile` | `append-content-handler.tsx` | Appends content to an existing file or the current file. |
| `addTextToDocument` | `add-text-handler.tsx` | Adds new sections/content with formatting to a document. |
| `modifyDocumentText` | `modify-text-handler.tsx` | Edits existing document content (find and replace within a file). |
| `extractHighlights` | `extract-highlights-handler.tsx` | Reads file content so the AI can extract key quotes and insights. |
| `bulkFindReplace` | `bulk-find-replace-handler.tsx` | Find and replace text across multiple files with regex support. |

### File Operations

| Tool | Handler | Description |
|---|---|---|
| `openFile` | `open-file-handler.tsx` | Opens a file in the Obsidian workspace. |
| `moveFiles` | `move-files-handler.tsx` | Moves files to different folders using `app.fileManager.renameFile()`. |
| `renameFiles` | `rename-files-handler.tsx` | Renames files with AI-suggested names. |
| `createNewFiles` | `create-files-handler.tsx` | Creates new notes with content, optionally linking them in the current file. |
| `deleteFiles` | `delete-files-handler.tsx` | Deletes files (to trash by default, or permanently). |
| `mergeFiles` | `merge-files-handler.tsx` | Concatenates multiple files into one with separators. |
| `exportToFormat` | `export-to-format-handler.tsx` | Exports notes to PDF, HTML, or plain text. |

### Metadata & Organization

| Tool | Handler | Description |
|---|---|---|
| `getFileMetadata` | `metadata-handler.tsx` | Extracts file metadata (size, dates, frontmatter, tags, links, word count). |
| `updateFrontmatter` | `frontmatter-handler.tsx` | Adds, updates, or removes YAML frontmatter properties. |
| `addTags` | `tags-handler.tsx` | Adds tags to files in frontmatter, inline, or both. |
| `createTemplate` | `create-template-handler.tsx` | Creates reusable note templates with placeholders. |
| `executeActionsOnFileBasedOnPrompt` | `execute-actions-handler.tsx` | Complex file operations driven by natural language prompt. |

### Vault Management

| Tool | Handler | Description |
|---|---|---|
| `generateSettings` | `settings-update-handler.tsx` | Updates plugin settings (rename/folder instructions) via AI suggestion. |
| `analyzeVaultStructure` | `onboard-handler.tsx` | Analyzes vault folder structure for onboarding/organization suggestions. |
| `update_vault_structure` | `update-vault-structure-handler.tsx` | Updates the Cosmic Vault Structure rules document. |

---

## Vault Intelligence Services

Located in `packages/plugin/services/`.

### VertexBrainClient (`vertex-brain-client.ts`)

HTTP client for the Vertex Brain gateway (Docker: `Zeniths-Vectors/`).

| Method | Endpoint | Description |
|---|---|---|
| `health()` | `GET /health` | 5s timeout health check. Returns `false` if unhealthy. |
| `embed(text)` | `POST /v1/embed` | Generates embedding vector for text (max 8000 chars). |
| `vectorUpsert(params)` | `POST /v1/vector-upsert` | Indexes a file's content, folder path, and tags. |
| `vectorSearch(query, limit)` | `POST /v1/vector-search` | Semantic similarity search. Returns `VaultSearchResult[]` with similarity scores. |

### VaultIndexer (`vault-indexer.ts`)

Background service that indexes all markdown files into the Vertex Brain vector store.

- **On startup:** calls `indexAll()` — enqueues every markdown file
- **On file modify:** `plugin.registerEvent(app.vault.on("modify", ...))` enqueues the changed file
- **Rate limited:** 150ms between API calls to avoid overloading the gateway
- **Gated by:** `enableVectorAutoSort` — if false, `enqueue()` is a no-op

### OrganizationPreferencesService (`organization-preferences.ts`)

Manages the Cosmic Vault Structure document.

- Reads from `organizationRulesPath` with 30s in-memory cache
- `ensureExists()` creates the file with a default template if missing
- `updateRules()` writes new content and invalidates cache
- Rules are injected as context in folder recommendation API calls and chat system prompts

### BackgroundScribe (`background-scribe.ts`)

Buffers chat conversations and synthesizes TODO items.

- **Activation:** `activate()` — registers listener for `vault-intelligence:chat-turn` events
- **Deactivation:** `deactivate()` — unregisters listener, clears buffer
- **Buffer:** Stores `{timestamp, content}` entries from each chat turn
- **Synthesis:** After 30s debounce, calls `synthesizeTODO()` which:
  - Detects project context from active file path
  - Uses `vectorSearch()` to find related project files
  - Generates TODO content (via Vertex Brain)
  - Writes to `backgroundScribeOutputFile`
- **Event:** Triggers `zenith-ai:background-scribe-changed` workspace event on activate/deactivate (chat UI listens to update scribe icon)

### LoggerService (`logger.ts`)

Conditional logging service.

- `configure(enabled)` — sets whether logging is active
- Keeps last 100 log entries in memory
- Wraps `console.log/warn/error/debug` with `[ZenithAI]` prefix
- Safely stringifies objects with circular reference protection

---

## Plugin Commands

Registered in `index.ts` via `this.addCommand()`.

| Command ID | Name | Description |
|---|---|---|
| `open-organizer-tab` | Open Organizer Tab | Opens the assistant sidebar and switches to the Organizer tab |
| `open-inbox-tab` | Open Inbox Tab | Opens the assistant sidebar and switches to the Inbox tab |
| `open-chat-tab` | Open Chat Tab | Opens the assistant sidebar and switches to the Chat tab |
| `process-inbox-now` | Process inbox now | Scans the inbox folder and enqueues all pending files for processing |
| `restore-default-templates` | Restore default templates | Shows a confirmation modal, then restores the 4 built-in templates (meeting_note, enhance, research_paper, flash_cards) |
| `add-selection-to-chat` | Add Selection to Chat | Takes the current editor text selection, adds it to the chat context items, and opens the Chat tab |

---

## Web API Endpoints

Located in `packages/web/app/api/`.

### AI Endpoints (`(newai)/`)

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | Streaming AI chat with tool definitions. Accepts messages, context, model, search flags. |
| `/api/classify1` | POST | Classifies document content against template names. Returns `documentType`. |
| `/api/folders` | POST | AI folder recommendation (legacy). |
| `/api/folders/v2` | POST | AI folder recommendation with confidence scores and custom instructions. |
| `/api/tags/v2` | POST | AI tag recommendation with scores and existing tag awareness. |
| `/api/title/v2` | POST | AI title/name recommendation for files. |
| `/api/format` | POST | One-shot content formatting with instruction. |
| `/api/format-stream` | POST | Streaming content formatting. |
| `/api/concepts-and-chunks` | POST | Extracts concepts for atomic note generation. |
| `/api/vision` | POST | OCR/image processing via vision model. |
| `/api/modify` | POST | AI content modification. |
| `/api/enhance-meeting-note` | POST | Specialized meeting note enhancement. |

### File Upload & Processing

| Route | Method | Description |
|---|---|---|
| `/api/create-upload-url` | POST | Generates R2 pre-signed upload URLs for large files. |
| `/api/record-upload` | POST | Records upload metadata after successful R2 upload. |
| `/api/process-file` | POST | Triggers backend processing of an uploaded file. |
| `/api/get-upload-status/[fileId]` | GET | Polls processing status for an uploaded file. |
| `/api/process-pending-uploads` | POST | Processes any pending uploads that haven't been handled. |
| `/api/trigger-processing` | POST | Triggers processing for a batch of files. |

### User & Billing

| Route | Method | Description |
|---|---|---|
| `/api/usage` | GET | Returns token/audio usage stats for the authenticated user. |
| `/api/public-usage` | GET | Public usage endpoint (works even when rate-limited). |
| `/api/sign-in` | POST | Authentication endpoint. |
| `/api/sign-up` | POST | Registration endpoint. |
| `/api/files` | GET | Lists user's files. |

### System

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check endpoint. |
| `/api/cron` | POST | Cron job endpoint (monthly token resets, etc.). |

---

## Web Environment Variables

From `packages/web/.env.example` and code references.

### Required — AI Providers

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for GPT models and Whisper transcription |
| `OPENAI_API_BASE` | Custom base URL for OpenAI-compatible APIs |
| `OPENAI_WHISPER_BASE_URL` | Optional separate endpoint for Whisper/transcription |
| `MODEL_PROVIDER` | AI provider: `openai`, `google`, `anthropic`, `groq`, `mistral`, `deepseek` |
| `MODEL_NAME` | Primary text model name (default: `gpt-4o-mini`) |
| `VISION_MODEL_NAME` | Vision model for OCR/image processing (defaults to `MODEL_NAME`) |
| `RESPONSES_MODEL_NAME` | Model used for response generation (separate from primary) |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) |
| `ANTHROPIC_API_BASE` | Custom Anthropic base URL |
| `GOOGLE_API_KEY` | Google AI API key |
| `GOOGLE_API_BASE` | Custom Google AI base URL |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_API_BASE` | Custom Groq base URL |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_API_BASE` | Custom DeepSeek base URL |
| `MISTRAL_API_KEY` | Mistral AI API key (used for OCR) |

### Required — Auth & User Management

| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` | Clerk authentication secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (client-side) |
| `ENABLE_USER_MANAGEMENT` | Toggle for user management features |
| `UNKEY_ROOT_KEY` | Unkey root key for API key management |
| `UNKEY_API_ID` | Unkey API identifier |

### Required — Storage (R2)

| Variable | Description |
|---|---|
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 endpoint URL |
| `R2_BUCKET` | R2 bucket name |
| `R2_REGION` | R2 region |
| `R2_PUBLIC_URL` | Public URL for R2 assets |
| `UPLOAD_DIR` | Local upload directory path |

### Optional — Analytics & Other

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public application URL |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL |
| `LOOPS_API_KEY` | Loops API key for newsletter/contact management |
| `CRON_SECRET` | Secret for authenticating cron job requests |
| `VERCEL_PROJECT_PRODUCTION_URL` | Auto-set by Vercel deployment |

---

*Generated from code analysis of the `cleanup/settings-purge` branch.*
