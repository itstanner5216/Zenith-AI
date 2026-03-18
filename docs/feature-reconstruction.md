# Zenith-AI Obsidian Plugin: Reverse Feature Reconstruction

**Analysis Date:** 2026-03-18  
**Methodology:** Backward analysis from settings, UI, state, outputs, and commands

---

## 1. RECONSTRUCTED FEATURES

### Feature: Inbox File Processing Pipeline
**Status:** IMPLEMENTED  
**Inputs:**
- `pathToWatch` setting (default: `_ZenithAI/Inbox`)
- Files created/renamed in inbox folder
- `useInbox` toggle
- `enableProcessingNotifications` toggle

**Outputs:**
- Processed files moved to `defaultDestinationPath`
- Attachments moved to `attachmentsPath`
- Error files moved to `errorFilePath`
- Processing logs in `logFolderPath`

**Behavior:**
Multi-step file processing pipeline that monitors inbox folder for new files. When files appear:
1. Validates file type and creates markdown container for media
2. Extracts content (text from MD, PDF text extraction via pdfjs)
3. Recommends and applies folder organization
4. Recommends and applies tags
5. Optionally renames based on content
6. Formats content using templates
7. Moves to final destination

**Evidence:**
- `packages/plugin/inbox/index.ts` - `Inbox` class, `processInboxFile()`, step functions
- `packages/plugin/inbox/services/record-manager.ts` - Action enum, FileRecord tracking
- `packages/plugin/handlers/eventHandlers.ts` - Vault create/rename event handlers
- `packages/plugin/settings.ts` - `pathToWatch`, `defaultDestinationPath`, etc.

---

### Feature: AI-Powered Tag Recommendation
**Status:** IMPLEMENTED  
**Inputs:**
- File content (truncated to `contentCutoffChars`)
- Existing vault tags
- `customTagInstructions` setting
- `useSimilarTags` toggle
- `useSimilarTagsInFrontmatter` toggle
- `tagScoreThreshold` setting

**Outputs:**
- Suggested tags with scores and reasons
- Tags appended to files (frontmatter or inline)

**Behavior:**
Analyzes document content to suggest relevant tags. Uses both:
1. Vector search via Vertex Brain to find tags from similar notes
2. AI model API (`/api/tags/v2`) for content-based recommendations
Tags are scored and filtered by threshold, then merged and deduplicated.

**Evidence:**
- `packages/plugin/index.ts` - `recommendTags()`, `appendTags()`, `appendTag()`
- `packages/plugin/inbox/index.ts` - `recommendTagsStep()`, `findSimilarTagsFromEmbeddings()`
- `packages/plugin/views/assistant/organizer/tags.tsx` - `SimilarTags` component
- `packages/web/app/api/(newai)/tags/v2/route.ts` - Tag generation endpoint

---

### Feature: Folder Organization Recommendations
**Status:** IMPLEMENTED  
**Inputs:**
- File content
- `customFolderInstructions` setting
- `useFolderEmbeddings` setting (forced false)
- `enableVectorAutoSort` toggle
- `autoSortConfidenceThreshold` setting
- `pinnedTag` setting (locks files from auto-sort)
- `organizationRulesPath` setting

**Outputs:**
- Folder suggestions with scores and reasons
- Files moved to recommended folders

**Behavior:**
Two-tier recommendation system:
1. **Embeddings-first:** Uses Vertex Brain vector search to find similar notes and their folders
2. **Model fallback:** If embeddings unavailable or low confidence, falls back to AI model
Respects `#pinned` tag to prevent auto-sorting. Reads organization rules from configured vault file.

**Evidence:**
- `packages/plugin/index.ts` - `recommendFolders()`
- `packages/plugin/inbox/index.ts` - `recommendFolderWithEmbeddingsStep()`, `recommendFolderStep()`
- `packages/plugin/views/assistant/organizer/folders/box.tsx` - `SimilarFolderBox`
- `packages/plugin/services/vertex-brain-client.ts` - `vectorSearch()`

---

### Feature: AI Chat Assistant
**Status:** IMPLEMENTED  
**Inputs:**
- User messages
- Context items (files, folders, tags, selections)
- `maxChatTokens` setting
- `selectedModel` setting
- `enableSearchGrounding` toggle
- `enableDeepSearch` toggle
- API key

**Outputs:**
- Streaming AI responses
- Tool invocations (local execution)
- Chat history persistence
- Markdown export

**Behavior:**
Full-featured chat interface using Vercel AI SDK. Features:
- Multi-turn conversations with streaming responses
- Context injection via @ mentions
- Tool calling architecture with client-side execution
- Chat history management and persistence
- Export conversations to markdown
- Model selection (gpt-4o-mini, llama3.2)
- Web search grounding (optional)

**Evidence:**
- `packages/plugin/views/assistant/ai-chat/chat.tsx` - Main chat component
- `packages/plugin/views/assistant/ai-chat/container.tsx` - `AIChatSidebar`
- `packages/web/app/api/(newai)/chat/route.ts` - Chat API endpoint
- `packages/web/app/api/(newai)/chat/tools.ts` - Tool definitions
- `packages/plugin/views/assistant/ai-chat/tool-handlers/` - Tool handler components

---

### Feature: Local Tool Execution System
**Status:** IMPLEMENTED  
**Inputs:**
- AI tool call decisions
- Obsidian App API
- Tool-specific parameters

**Outputs:**
- Vault modifications (create, rename, move, modify files)
- Search results
- Metadata extraction
- Settings updates

**Behavior:**
Server-defined, client-executed tool pattern. Tools are defined on server (for AI visibility) but execute on client (for vault access). Supports 30+ tools including:
- Search (semantic, by name, tagged files)
- File operations (move, rename, create, delete, merge)
- Content manipulation (append, modify, extract highlights)
- Metadata operations (frontmatter, tags, backlinks)
- Vault analysis and organization

**Evidence:**
- `packages/web/app/api/(newai)/chat/tools.ts` - Tool definitions with Zod schemas
- `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx` - Router
- `packages/plugin/views/assistant/ai-chat/tool-handlers/*.tsx` - Individual handlers

---

### Feature: Document Classification & Templating
**Status:** IMPLEMENTED  
**Inputs:**
- File content
- `templatePaths` setting
- Available templates (meeting_note, research_paper, enhance, flash_cards)
- `enableDocumentClassification` toggle

**Outputs:**
- Document type classification
- Formatted content based on template
- Template-specific structure

**Behavior:**
AI-powered document classification matches content to available templates. Supports:
- Meeting notes (action items, decisions, metadata)
- Research papers (structured academic format)
- Flash cards (interactive HTML details/summary)
- Custom enhance templates

**Evidence:**
- `packages/plugin/views/assistant/organizer/ai-format/templates.tsx` - ClassificationContainer
- `packages/plugin/fileUtils.ts` - Template content functions, `checkAndCreateTemplates()`
- `packages/web/app/api/(newai)/aiService.ts` - `classifyDocument()`, `formatDocumentContent()`

---

### Feature: Content Formatting & Streaming
**Status:** IMPLEMENTED  
**Inputs:**
- File content
- Formatting instructions
- `formatBehavior` setting ("override" | "newFile" | "append")
- `maxFormattingTokens` setting

**Outputs:**
- Formatted content streamed to note
- New files (when formatBehavior="newFile")
- Split view display

**Behavior:**
Streams AI-formatted content directly into notes. Supports multiple modes:
- Override: Replace existing content
- Append: Add to end of file
- New File: Create formatted copy in split view
Line-by-line streaming for real-time feedback.

**Evidence:**
- `packages/plugin/index.ts` - `formatStream()`, `streamFormatInCurrentNoteLineByLine()`, `streamFormatAppendInCurrentNote()`, `streamFormatInSplitView()`
- `packages/web/app/api/(newai)/format-stream/route.ts` - Streaming format endpoint

---

### Feature: Title/Rename Suggestions
**Status:** IMPLEMENTED (Experimental)  
**Inputs:**
- File content
- `enableTitleSuggestions` toggle
- `renameInstructions` setting
- `enableFileRenaming` toggle

**Outputs:**
- Suggested titles with scores and reasons
- Renamed files

**Behavior:**
AI suggests human-readable file names based on content. Uses custom instructions for naming strategy. Marked as experimental/transitional in UI.

**Evidence:**
- `packages/plugin/views/assistant/organizer/titles/box.tsx` - `RenameSuggestion`
- `packages/plugin/index.ts` - `recommendName()`
- `packages/plugin/settings.ts` - `enableTitleSuggestions`, `renameInstructions`

---

### Feature: Vertex Brain Integration (Vault Intelligence)
**Status:** IMPLEMENTED  
**Inputs:**
- `vertexBrainUrl` setting
- `enableVectorAutoSort` toggle
- `autoSortConfidenceThreshold` setting
- File content and metadata

**Outputs:**
- Vector embeddings
- Similarity search results
- Semantic ranking
- Question answering

**Behavior:**
Integration with external Vertex Brain service for:
- Vector upsert (indexing files)
- Vector search (finding similar content)
- Semantic ranking
- Conversational answers
Health check validates connection on load.

**Evidence:**
- `packages/plugin/services/vertex-brain-client.ts` - `VertexBrainClient` class
- `packages/plugin/services/vault-indexer.ts` - `VaultIndexer` for background indexing
- `packages/plugin/index.ts` - Client initialization
- `Zeniths-Vectors/gateway.py` - Backend service

---

### Feature: PDF Text Extraction
**Status:** IMPLEMENTED  
**Inputs:**
- PDF files
- `pdfPageLimit` setting

**Outputs:**
- Extracted text content

**Behavior:**
Uses Obsidian's built-in pdfjs to extract text from PDF files, respecting page limit setting. Creates markdown container for processed PDFs.

**Evidence:**
- `packages/plugin/index.ts` - `extractTextFromPDF()`, `shouldCreateMarkdownContainer()`
- `packages/plugin/settings.ts` - `pdfPageLimit`

---

### Feature: Mobile Sync
**Status:** IMPLEMENTED  
**Inputs:**
- `syncFolderPath` setting
- API key for authentication
- Remote files from web/mobile upload

**Outputs:**
- Downloaded files to vault
- Date-organized folder structure
- Markdown wrappers for media

**Behavior:**
Downloads files uploaded via mobile app or web dashboard. Creates date-based subfolders, handles images/PDFs as binary with markdown reference files.

**Evidence:**
- `packages/plugin/views/assistant/synchronizer/sync-tab.tsx` - `SyncTab` component
- `packages/mobile/utils/file-handler.ts` - Upload handling
- `packages/plugin/settings.ts` - `syncFolderPath`

---

### Feature: Onboarding Wizard
**Status:** IMPLEMENTED  
**Inputs:**
- `hasRunOnboarding` setting
- User email/password (optional signup)

**Outputs:**
- Created folder structure
- API key configuration
- Onboarding completion flag

**Behavior:**
First-run setup wizard that:
1. Introduces features
2. Offers account signup/signin
3. Creates required folders
4. Marks setup complete

**Evidence:**
- `packages/plugin/views/assistant/dashboard/onboarding-wizard.tsx` - `OnboardingWizard`
- `packages/plugin/views/assistant/dashboard/main-dashboard.tsx` - Conditional rendering
- `packages/plugin/settings.ts` - `hasRunOnboarding`

---

### Feature: Background Scribe
**Status:** PARTIAL  
**Inputs:**
- `backgroundScribeEnabled` toggle
- `backgroundScribeOutputFile` setting
- Chat conversation turns
- `projectsPath` setting

**Outputs:**
- TODO.md file (or configured output)
- Synthesized action items

**Behavior:**
Listens to chat turns in background, buffers content, then synthesizes TODO items based on conversation. Uses Vertex Brain for project context detection.

**What Exists:**
- Service class with arm/disarm
- Chat turn buffering
- Debounced synthesis
- Project detection

**What's Missing:**
- Full mode runtime integration
- Scratchpad artifact flow
- Narrow scribe prompt

**Evidence:**
- `packages/plugin/services/background-scribe.ts` - `BackgroundScribe` class
- `packages/plugin/settings.ts` - `backgroundScribeEnabled`, `backgroundScribeOutputFile`
- `docs/plans/background-scribe-implementation.md` - Implementation plan

---

### Feature: Cosmic Context (Project Context)
**Status:** IMPLEMENTED  
**Inputs:**
- Active file path
- Conversation summary
- `projectsPath` setting

**Outputs:**
- Related files display
- Project context detection

**Behavior:**
Tab in assistant view showing files related to current conversation/project. Uses vector search to find semantically similar notes within project scope.

**Evidence:**
- `packages/plugin/views/assistant/context/index.tsx` - `ProjectContextTab`
- `packages/plugin/settings.ts` - `projectsPath`, `autoDetectProjectContext`

---

### Feature: Atomic Notes (Chunking)
**Status:** PARTIAL (Experimental)  
**Inputs:**
- `enableAtomicNotes` toggle
- File content

**Outputs:**
- Concept identification
- Chunked content extraction

**Behavior:**
Decomposes documents into atomic concepts/chunks. Experimental feature for note splitting.

**Evidence:**
- `packages/plugin/views/assistant/organizer/chunks.tsx` - `AtomicNotes`
- `packages/web/app/api/(newai)/aiService.ts` - `identifyConcepts()`, `fetchChunksForConcept()`
- `packages/plugin/settings.ts` - `enableAtomicNotes`

---

### Feature: Self-Hosting Support
**Status:** IMPLEMENTED  
**Inputs:**
- `enableSelfHosting` toggle
- `selfHostingURL` setting

**Outputs:**
- API requests routed to custom server

**Behavior:**
Allows using self-hosted backend instead of default cloud service. All API calls respect this setting.

**Evidence:**
- `packages/plugin/index.ts` - `getServerUrl()`
- `packages/plugin/settings.ts` - `enableSelfHosting`, `selfHostingURL`

---

### Feature: Inbox Processing Logs
**Status:** IMPLEMENTED  
**Inputs:**
- Processing records from RecordManager
- File status (queued, processing, completed, error, bypassed)

**Outputs:**
- Visual log display
- Processing step timeline

**Behavior:**
UI component showing status of all files processed through inbox. Displays each processing step (extract, classify, tag, format, move) with timestamps.

**Evidence:**
- `packages/plugin/views/assistant/inbox-logs.tsx` - `InboxLogs`
- `packages/plugin/inbox/services/record-manager.ts` - `RecordManager`, `Action` enum

---

### Feature: Processing Status Bar
**Status:** IMPLEMENTED  
**Inputs:**
- Queue status
- Processing progress

**Outputs:**
- Status bar item in Obsidian

**Behavior:**
Shows real-time processing status in Obsidian's status bar.

**Evidence:**
- `packages/plugin/components/processing-status-bar.tsx` - `ProcessingStatusBar`
- `packages/plugin/index.ts` - Status bar initialization

---

## 2. PARTIAL / IMPLIED FEATURES

### Feature: YouTube Transcript Import
**What Exists:**
- Landing page mentions feature
- Demo shows YouTube URL handling
- `getYoutubeVideoId` tool referenced

**What's Missing:**
- No clear implementation in plugin code
- May have been deprecated as part of planned feature removal to focus on core development-vault workflow

**Evidence:**
- `packages/landing/app/(landing)/page.tsx` - Feature description
- `packages/landing/app/(landing)/demo/demo.tsx` - Demo conversation
- `docs/plans/aggressive-removal-implementation-resolved-VERIFY.md` - Deprecation plan

---

### Feature: Audio/Image Transcription
**What Exists:**
- Constants define valid audio/image extensions
- Inbox logs check for audio/image processing
- Web API has transcription endpoints

**What's Missing:**
- Direct audio transcription in plugin unclear
- May route through mobile upload flow

**Evidence:**
- `packages/plugin/constants.ts` - `VALID_AUDIO_EXTENSIONS`, `VALID_IMAGE_EXTENSIONS`
- `packages/plugin/views/assistant/inbox-logs.tsx` - Transcription detection
- `packages/web/app/api/(newai)/transcribe/route.ts` - Transcription API

---

### Feature: Organization Rules/Preferences
**What Exists:**
- `organizationRulesPath` setting
- `OrganizationPreferencesService` imported
- Rules read during folder recommendation

**What's Missing:**
- No UI for editing rules
- Service implementation details unclear

**Evidence:**
- `packages/plugin/settings.ts` - `organizationRulesPath`
- `packages/plugin/index.ts` - `getOrganizationRulesContext()`
- `packages/plugin/services/organization-preferences.ts` - Service file

---

## 3. MERGED FEATURE GROUPS

### Combined Feature: File Organization System
**Original Fragments:**
- Folder recommendations
- Tag recommendations
- File renaming
- Document classification
- Inbox processing
- Vector-based sorting

**Reason for Merge:**
All fragments contribute to the same core behavior: intelligently organizing files in the vault. They share:
- Common triggers (inbox file creation)
- Shared context (file content, vault structure)
- Coordinated execution (processing pipeline)
- Common output (organized, tagged, renamed files)

**Evidence:**
- `packages/plugin/inbox/index.ts` - Orchestrates all steps
- Settings control individual aspects of unified behavior

---

### Combined Feature: Context-Aware AI
**Original Fragments:**
- Chat context items
- Cosmic context tab
- Vector search integration
- Active file tracking
- Selection context

**Reason for Merge:**
All provide context to AI interactions:
- Context items store active file, folders, tags
- Cosmic context shows related files
- Vector search finds similar content
- All feed into chat and recommendations

**Evidence:**
- `packages/plugin/views/assistant/ai-chat/use-context-items.ts` - Context store
- `packages/plugin/views/assistant/context/index.tsx` - Context tab
- `packages/plugin/services/vertex-brain-client.ts` - Vector search

---

## 4. FEATURE → SETTINGS MAP

| Feature | Settings | Status | Notes |
|---------|----------|--------|-------|
| Inbox Processing | `pathToWatch`, `defaultDestinationPath`, `useInbox`, `enableProcessingNotifications`, `attachmentsPath`, `logFolderPath`, `backupFolderPath`, `errorFilePath` | Complete | Core feature with full settings coverage |
| Tag Recommendations | `useSimilarTags`, `useSimilarTagsInFrontmatter`, `customTagInstructions`, `tagScoreThreshold` | Complete | All aspects configurable |
| Folder Organization | `useFolderEmbeddings`, `customFolderInstructions`, `enableVectorAutoSort`, `autoSortConfidenceThreshold`, `pinnedTag`, `organizationRulesPath` | Complete | `useFolderEmbeddings` forced false |
| AI Chat | `selectedModel`, `maxChatTokens`, `enableSearchGrounding`, `enableDeepSearch`, `API_KEY` | Complete | Model selection works |
| Title Suggestions | `enableTitleSuggestions`, `renameInstructions`, `enableFileRenaming` | Complete | Marked experimental |
| Document Classification | `enableDocumentClassification`, `templatePaths` | Partial | Toggle exists but may not be fully wired |
| Formatting | `formatBehavior`, `maxFormattingTokens` | Complete | Multiple modes supported |
| PDF Extraction | `pdfPageLimit` | Complete | Simple limit control |
| Mobile Sync | `syncFolderPath` | Complete | Single path setting |
| Vertex Brain | `vertexBrainUrl`, `enableVectorAutoSort`, `autoSortConfidenceThreshold` | Complete | Integration settings |
| Background Scribe | `backgroundScribeEnabled`, `backgroundScribeOutputFile`, `projectsPath` | Partial | Feature incomplete |
| Atomic Notes | `enableAtomicNotes` | Partial | Experimental toggle only |
| Self-Hosting | `enableSelfHosting`, `selfHostingURL` | Complete | Simple toggle + URL |
| Onboarding | `hasRunOnboarding` | Complete | Boolean flag |
| Debug | `debugMode`, `useLogs` | Complete | Development aids |
| Content Limits | `contentCutoffChars`, `maxFormattingTokens`, `maxChatTokens` | Complete | Performance controls |

---

## 5. INCONSISTENCIES

### Settings Without Clear Behavior
1. **`enableDocumentClassification`** - Toggle exists but classification always runs in inbox
2. **`useFolderEmbeddings`** - Forced to false in CustomizationTab useEffect (deprecated in favor of Vertex Brain vector integration; legacy setting preserved for backward compatibility)
3. **`stagingFolder`** - Defined but usage unclear
4. **`bypassedFilePath`** - Defined but bypassing logic unclear
5. **`referencePath`** - Defined but not obviously used

### Behavior Without Clear Feature Boundary
1. **Template creation** - Runs on startup but no UI to manage
2. **Vault indexing** - Background process without progress UI
3. **Health checks** - Vertex Brain health check on load, no recovery UI

### Conflicting or Redundant Flows
1. **Two folder recommendation paths** - Embeddings step AND model step both exist
2. **Multiple tag sources** - Embeddings tags AND model tags merged
3. **Duplicate command registration** - Commands registered in view.tsx AND index.ts

### Fragmented Systems
1. **Error handling** - Files can go to error folder, backup folder, or stay in place
2. **Media processing** - Separate queue limits, unclear transcription flow
3. **Context management** - Multiple stores and tracking mechanisms

---

## 6. EMERGENT FEATURES

### Feature: Progressive Processing Pipeline
**Evidence:**
- Inbox uses step-by-step processing with rollback capability
- Each step logs independently
- Failure at any step triggers error handling

**Why It Qualifies:**
Not explicitly designed as a feature but functions as one. Users can see exactly which step failed and retry processing. The step granularity enables partial recovery and debugging.

---

### Feature: Hybrid AI Routing
**Evidence:**
- Embeddings tried first, model used as fallback
- Confidence thresholds control routing
- Multiple AI sources merged for results

**Why It Qualifies:**
Emergent pattern where system automatically chooses best AI approach. User doesn't configure this directly but benefits from optimized routing.

---

### Feature: Vault Health Monitoring
**Evidence:**
- Broken link detection tool
- Backlink analysis
- Heading structure extraction
- File metadata aggregation

**Why It Qualifies:**
Collection of tools that together enable vault health assessment. Not a single feature but emergent capability from tool composition.

---

## SUMMARY

### Core Feature Count
- **Fully Implemented:** 16 features
- **Partial/Incomplete:** 4 features
- **Emergent:** 3 patterns

### Key Architectural Findings
1. **Strong inbox pipeline** - Most file organization flows through single processing queue
2. **Hybrid AI approach** - Embeddings + model fallback pattern used throughout
3. **Local tool execution** - Server-defined, client-executed tools preserve privacy
4. **Experimental isolation** - Unstable features clearly marked and toggleable

### Settings Utilization
- **Total settings:** ~45 distinct settings
- **Actively used:** ~35 settings
- **Unclear/unused:** ~10 settings
- **Forced values:** 1 (`useFolderEmbeddings = false`)

### Areas Needing Reconciliation
1. YouTube transcript feature (documented but possibly removed)
2. Document classification toggle (may not be respected)
3. Background scribe (partial implementation)
4. Template management (no user-facing controls)
