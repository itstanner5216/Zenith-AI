# Zenith-AI Plugin Configurability Audit

**Date:** 2026-03-18  
**Auditor:** Automated Audit System  
**Scope:** packages/plugin - Obsidian Plugin Settings System

---

## Executive Summary

This audit traces all user-configurable settings in the Zenith-AI Obsidian plugin to determine which settings actually affect runtime behavior. The audit reveals several categories of settings:

- **Fully Configurable:** 27 settings with complete end-to-end functionality
- **Partially Configurable:** 3 settings with incomplete or weak effects
- **UI-Only / Fake:** 2 settings that appear in UI but have no meaningful runtime effect
- **Hardcoded Override:** 1 setting that is forcibly overridden in code
- **Dead Settings:** 5 settings defined but never used at runtime

---

## 1. FULLY CONFIGURABLE SETTINGS

These settings have complete functionality: defined → persisted → read → affects behavior.

### 1.1 API & Authentication

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `API_KEY` | Used for all API calls to server | `settings.ts:3` → `index.ts:554-556` → All API fetch calls with `Authorization` header |

### 1.2 Path Configuration (File Config Tab)

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `pathToWatch` | Inbox folder for file monitoring | `settings.ts:8` → `file-config-tab.tsx:12` → `eventHandlers.ts:17,28,39` → `index.ts:800-806` |
| `defaultDestinationPath` | Output folder for processed files | `settings.ts:5` → `file-config-tab.tsx:19-20` → `index.ts:749,764` |
| `attachmentsPath` | Storage for original attachments | `settings.ts:7` → `file-config-tab.tsx:13-14` → `inbox/index.ts:423` |
| `logFolderPath` | Folder for organization logs | `settings.ts:9` → `file-config-tab.tsx:16-17` → `index.ts:1080` |
| `backupFolderPath` | Folder for file backups | `settings.ts:10` → `file-config-tab.tsx:25-26` → `index.ts:1260,1273` |
| `templatePaths` | Folder for document templates | `settings.ts:11` → `file-config-tab.tsx:28-29` → `index.ts:251,1284,1314` |
| `bypassedFilePath` | Folder for bypassed files | `settings.ts:12` → `file-config-tab.tsx:31-32` → `inbox/index.ts:734` |
| `errorFilePath` | Folder for error files | `settings.ts:13` → `file-config-tab.tsx:34-35` → `inbox/index.ts:937,948,979` |
| `ignoreFolders` | Folders to exclude from organization | `settings.ts:27` → `file-config-tab.tsx:22-23` → `index.ts:763,784` |

### 1.3 Inbox Processing (Customization Tab)

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `enableFileRenaming` | Controls automatic file renaming in inbox | `settings.ts:20` → `customization-tab.tsx:9,57-58` → `inbox/index.ts:1004` |
| `enableDocumentClassification` | Controls auto-formatting based on templates | `settings.ts:18` → `customization-tab.tsx:15,63-64` → `inbox/index.ts:1000,1002` |
| `useSimilarTags` | Controls automatic tag suggestion in inbox | `settings.ts:17` → `customization-tab.tsx:11,78-79` → `inbox/index.ts:1006` |
| `useSimilarTagsInFrontmatter` | Tags in frontmatter vs inline | `settings.ts:25` → `customization-tab.tsx:12,121-122` → `index.ts:999,1033` |

### 1.4 AI Processing Instructions (Customization Tab)

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `renameInstructions` | Custom instructions for file naming | `settings.ts:22-23` → `customization-tab.tsx:10,102-103` → `index.ts:1343` |
| `customTagInstructions` | Custom instructions for tag generation | `settings.ts:50-51` → `customization-tab.tsx:16,127-128` → `index.ts:859` |
| `customFolderInstructions` | Custom instructions for folder placement | `settings.ts:36` → `customization-tab.tsx:14,140-141` → `index.ts:911` |

### 1.5 Advanced Settings

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `enableSelfHosting` | Use self-hosted server | `settings.ts:29` → `advanced-tab.tsx:11-12` → `index.ts:137` |
| `selfHostingURL` | Self-hosted server URL | `settings.ts:30` → `advanced-tab.tsx:14-15` → `index.ts:138` |
| `debugMode` | Enable detailed logging | `settings.ts:42` → `advanced-tab.tsx:18` → `index.ts:1077` via `logger.configure()` |
| `contentCutoffChars` | Character limit for AI analysis | `settings.ts:45` → `advanced-tab.tsx:20-21` → `index.ts:622,846,912,1341` |
| `maxFormattingTokens` | Token limit for formatting | `settings.ts:47` → `advanced-tab.tsx:23-24` → `inbox/index.ts:789,792` |
| `pdfPageLimit` | Max PDF pages to analyze | `settings.ts:53` → `advanced-tab.tsx:26-27` → `index.ts:542` |

### 1.6 Vault Intelligence (Customization Tab)

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `vertexBrainUrl` | URL for Vertex AI Brain | `settings.ts:56` → `customization-tab.tsx:17` → `index.ts:1088-1089` |
| `enableVectorAutoSort` | Enable semantic auto-sorting | `settings.ts:57` → `customization-tab.tsx:18` → `index.ts:1088`, `vault-indexer.ts:17` |
| `autoSortConfidenceThreshold` | Confidence threshold for auto-sort | `settings.ts:58` → `customization-tab.tsx:19` → `inbox/index.ts:553` |
| `organizationRulesPath` | Path to Cosmic Vault Structure | `settings.ts:59` → `customization-tab.tsx:20` → `organization-preferences.ts:15` |
| `generalMergeThreshold` | Threshold for General→Project sort | `settings.ts:60` → (no UI) → `inbox/index.ts:555` |
| `globalMergeThreshold` | Threshold for non-General sort | `settings.ts:61` → (no UI) → `inbox/index.ts:557` |
| `pinnedTag` | Tag to lock files from auto-sort | `settings.ts:62` → (no UI) → `inbox/index.ts:601`, `organization-preferences.ts:69` |
| `projectsPath` | Root signal directory | `settings.ts:63` → (no UI) → `inbox/index.ts:550`, `context/index.tsx:16` |

### 1.7 Experimental Features

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `enableAtomicNotes` | Enable plan decomposition | `settings.ts:26` → `experiment-tab.tsx:10-11` → `organizer.tsx:417` |
| `enableSearchGrounding` | Enable web search for AI | `settings.ts:34` → `experiment-tab.tsx:16-17` → `chat.tsx:248-249,456-457` |
| `enableDeepSearch` | Use larger search context | `settings.ts:35` → `experiment-tab.tsx:19-20` → `chat.tsx:252,460` |
| `enableTitleSuggestions` | Show title suggestions | `settings.ts:43` → `experiment-tab.tsx:13-14` → `organizer.tsx:390` |

### 1.8 Chat & Model Settings

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `selectedModel` | AI model selection | `settings.ts:37` → `model-selector.tsx` → `chat.tsx:217-218,247,455,506` |
| `customModelName` | Custom model name for local LLM | `settings.ts:38` → `model-selector.tsx:28,44-45` → `chat.tsx:512` |
| `formatBehavior` | How formatting applies (override/newFile/append) | `settings.ts:40` → `templates.tsx:25-27,45-57,111` |

### 1.9 Other Functional Settings

| Setting | Behavior | Code Path |
|---------|----------|-----------|
| `hasRunOnboarding` | Tracks if onboarding completed | `settings.ts:52` → `main-dashboard.tsx:26,97`, `onboarding-wizard.tsx:81` |
| `enableProcessingNotifications` | Show toast notifications | `settings.ts:54` → (no UI) → `inbox/index.ts:736,954,1096` |
| `backgroundScribeEnabled` | Enable background scribe | `settings.ts:65` → (no UI) → used by `background-scribe.ts` |
| `backgroundScribeOutputFile` | Output file for scribe | `settings.ts:66` → (no UI) → `background-scribe.ts:83` |

---

## 2. PARTIALLY CONFIGURABLE SETTINGS

### 2.1 `useVaultTitles`

- **What works:** Setting is saved and loaded, UI toggle functions
- **What doesn't:** No evidence of runtime usage in actual title recommendation calls
- **Evidence:** Setting defined at `settings.ts:33`, UI at `customization-tab.tsx:13,108-109`, but no runtime read found in `recommendName()` at `index.ts:1337-1373`

### 2.2 `syncFolderPath`

- **What works:** Setting is saved and loaded, folder is created on startup
- **What doesn't:** Only used in UI display (`sync-tab.tsx:312`), no actual sync functionality implemented
- **Evidence:** Folder created at `index.ts:1411`, but no sync operations use this path

### 2.3 `referencePath`

- **What works:** Folder is created on plugin load
- **What doesn't:** No runtime functionality uses this path for organizing references
- **Evidence:** Only found in folder creation at `index.ts:1404`

---

## 3. UI-ONLY / FAKE SETTINGS

### 3.1 `useLogs`

- **Where shown:** Advanced Tab toggle "Zenith-AI File Logs" at `advanced-tab.tsx:59-68`
- **Proof no runtime effect exists:** 
  - Setting only controls visibility of logs section in settings UI (`advanced-tab.tsx:135`)
  - No file logging actually occurs - only in-memory logging via `logger.ts`
  - The `logger` service is controlled by `debugMode`, not `useLogs`
  - `logFolderPath` folder is created but never written to by the plugin

### 3.2 `usePro`

- **Where shown:** Not shown in any UI (defined but hidden)
- **Proof no runtime effect exists:**
  - Defined at `settings.ts:24` with default `true`
  - **Zero** runtime reads found in entire codebase
  - No feature gating or behavior changes based on this setting

---

## 4. HARDCODED / IGNORED SETTINGS

### 4.1 `useFolderEmbeddings`

- **Where overridden:** `customization-tab.tsx:23-27`
- **Hardcoded value used instead:** `false`
- **Evidence:**
  ```typescript
  // force set user embeddings to false
  useEffect(() => {
    if (plugin.settings.useFolderEmbeddings !== false) {
      plugin.settings.useFolderEmbeddings = false;
      plugin.saveSettings();
    }
  }, []);
  ```
- **Impact:** Setting exists but is forcibly set to `false` on every settings tab load. User cannot enable this feature regardless of UI state.

---

## 5. DEAD SETTINGS

These settings are defined in `settings.ts` but have no meaningful runtime usage:

| Setting | Defined At | Issue |
|---------|-----------|-------|
| `tagScoreThreshold` | `settings.ts:39` | Never read at runtime |
| `stagingFolder` | `settings.ts:28` | Only used for folder creation, no files staged there |
| `useInbox` | `settings.ts:41` | Never read at runtime |
| `maxChatTokens` | `settings.ts:49` | Never read at runtime |
| `showLocalLLMInChat` | **NOT DEFINED** | Used in `chat.tsx:492,496` and `model-selector.tsx` but not defined in settings class! |

---

## 6. MISSING CONFIGURABILITY

### 6.1 Features Without User Control

| Feature/Value | Where Hardcoded | Recommendation |
|---------------|-----------------|----------------|
| `MAX_CONCURRENT_TASKS = 5` | `inbox/index.ts:36` | Should be user-configurable for different system capabilities |
| `MAX_CONCURRENT_MEDIA_TASKS = 2` | `inbox/index.ts:37` | Should be user-configurable |
| `maxLogs = 100` | `services/logger.ts:80` | Should be user-configurable |
| `showLocalLLMInChat` | Used but not defined | Should be added to settings class |

### 6.2 Missing UI for Existing Settings

These settings exist and function but have no UI controls:

| Setting | Current Default | Recommendation |
|---------|-----------------|----------------|
| `enableProcessingNotifications` | `true` | Add toggle to Advanced tab |
| `generalMergeThreshold` | `0.50` | Add to Vault Intelligence section |
| `globalMergeThreshold` | `0.70` | Add to Vault Intelligence section |
| `pinnedTag` | `"pinned"` | Add to Vault Intelligence section |
| `projectsPath` | `"Projects"` | Add to Vault Intelligence section |
| `backgroundScribeEnabled` | `false` | Add to Experiment tab |
| `backgroundScribeOutputFile` | `"TODO.md"` | Add to Experiment tab |

---

## 7. CONFIGURABILITY SUMMARY TABLE

| Setting | Status | Runtime Effect | Evidence |
|---------|--------|----------------|----------|
| `API_KEY` | ✅ FULLY | Yes | All API calls |
| `pathToWatch` | ✅ FULLY | Yes | File monitoring |
| `defaultDestinationPath` | ✅ FULLY | Yes | File organization |
| `attachmentsPath` | ✅ FULLY | Yes | Attachment storage |
| `logFolderPath` | ⚠️ PARTIAL | Folder created only | No logging to folder |
| `backupFolderPath` | ✅ FULLY | Yes | Backup creation |
| `templatePaths` | ✅ FULLY | Yes | Template loading |
| `bypassedFilePath` | ✅ FULLY | Yes | Bypassed file routing |
| `errorFilePath` | ✅ FULLY | Yes | Error file routing |
| `ignoreFolders` | ✅ FULLY | Yes | Folder exclusion |
| `enableFileRenaming` | ✅ FULLY | Yes | Inbox rename control |
| `enableDocumentClassification` | ✅ FULLY | Yes | Inbox format control |
| `useSimilarTags` | ✅ FULLY | Yes | Inbox tagging control |
| `useSimilarTagsInFrontmatter` | ✅ FULLY | Yes | Tag placement |
| `renameInstructions` | ✅ FULLY | Yes | AI rename prompt |
| `customTagInstructions` | ✅ FULLY | Yes | AI tag prompt |
| `customFolderInstructions` | ✅ FULLY | Yes | AI folder prompt |
| `enableSelfHosting` | ✅ FULLY | Yes | Server URL switch |
| `selfHostingURL` | ✅ FULLY | Yes | Server endpoint |
| `debugMode` | ✅ FULLY | Yes | Logger config |
| `contentCutoffChars` | ✅ FULLY | Yes | Content trimming |
| `maxFormattingTokens` | ✅ FULLY | Yes | Token limit |
| `pdfPageLimit` | ✅ FULLY | Yes | PDF extraction |
| `vertexBrainUrl` | ✅ FULLY | Yes | Vertex client init |
| `enableVectorAutoSort` | ✅ FULLY | Yes | Vector sorting |
| `autoSortConfidenceThreshold` | ✅ FULLY | Yes | Sort threshold |
| `organizationRulesPath` | ✅ FULLY | Yes | Rules loading |
| `enableAtomicNotes` | ✅ FULLY | Yes | UI visibility |
| `enableSearchGrounding` | ✅ FULLY | Yes | Chat behavior |
| `enableDeepSearch` | ✅ FULLY | Yes | Search context |
| `enableTitleSuggestions` | ✅ FULLY | Yes | UI visibility |
| `selectedModel` | ✅ FULLY | Yes | Model selection |
| `customModelName` | ✅ FULLY | Yes | Custom model |
| `formatBehavior` | ✅ FULLY | Yes | Format action |
| `hasRunOnboarding` | ✅ FULLY | Yes | Onboarding state |
| `enableProcessingNotifications` | ✅ FULLY | Yes | Toast control (no UI) |
| `generalMergeThreshold` | ✅ FULLY | Yes | Sort threshold (no UI) |
| `globalMergeThreshold` | ✅ FULLY | Yes | Sort threshold (no UI) |
| `pinnedTag` | ✅ FULLY | Yes | Pin detection (no UI) |
| `projectsPath` | ✅ FULLY | Yes | Project detection (no UI) |
| `backgroundScribeEnabled` | ✅ FULLY | Yes | Scribe control (no UI) |
| `backgroundScribeOutputFile` | ✅ FULLY | Yes | Scribe output (no UI) |
| `useVaultTitles` | ⚠️ PARTIAL | Uncertain | No runtime read found |
| `syncFolderPath` | ⚠️ PARTIAL | Folder only | No sync functionality |
| `referencePath` | ⚠️ PARTIAL | Folder only | No reference handling |
| `useLogs` | ❌ UI-ONLY | No | Only controls settings UI |
| `usePro` | ❌ DEAD | No | Never read |
| `useFolderEmbeddings` | ❌ OVERRIDE | Forced false | Hardcoded override |
| `tagScoreThreshold` | ❌ DEAD | No | Never read |
| `stagingFolder` | ❌ DEAD | Folder only | No staging operations |
| `useInbox` | ❌ DEAD | No | Never read |
| `maxChatTokens` | ❌ DEAD | No | Never read |
| `showLocalLLMInChat` | ❌ MISSING | Used but undefined | Not in settings class |

---

## 8. RECOMMENDATIONS

### 8.1 Immediate Actions

1. **Remove dead settings** from `settings.ts`:
   - `usePro`
   - `useInbox`
   - `tagScoreThreshold`
   - `maxChatTokens`

2. **Add missing setting definition**:
   - `showLocalLLMInChat` must be added to `ZenithAISettings` class

3. **Fix hardcoded override**:
   - Either remove `useFolderEmbeddings` entirely, or implement the feature properly

4. **Clarify or remove misleading settings**:
   - `useLogs` - either implement file logging or remove/rename this setting

### 8.2 UI Improvements

1. Add UI controls for functional settings that lack them:
   - `enableProcessingNotifications` → Advanced tab
   - `generalMergeThreshold`, `globalMergeThreshold`, `pinnedTag`, `projectsPath` → Vault Intelligence section
   - `backgroundScribeEnabled`, `backgroundScribeOutputFile` → Experiment tab

### 8.3 Code Cleanup

1. Remove unused folder path settings that only create empty folders:
   - `stagingFolder` (if not implementing staging)
   - `referencePath` (if not implementing references)
   - Consider if `logFolderPath` should implement actual logging

---

## 9. AUDIT METHODOLOGY

This audit was conducted by:

1. **Definition Analysis**: Reviewing `packages/plugin/settings.ts` for all setting definitions
2. **UI Trace**: Examining all settings tab components to identify exposed controls
3. **Runtime Trace**: Using grep/search to find all runtime reads of each setting
4. **Behavior Verification**: Tracing each runtime read to verify it affects actual behavior
5. **Gap Analysis**: Identifying settings without proper end-to-end paths

### Files Examined

- `packages/plugin/settings.ts` - Setting definitions
- `packages/plugin/index.ts` - Main plugin runtime
- `packages/plugin/views/settings/*.tsx` - Settings UI components
- `packages/plugin/inbox/index.ts` - Inbox processing
- `packages/plugin/services/*.ts` - Service implementations
- `packages/plugin/views/assistant/**/*.tsx` - Assistant view components

---

*End of Audit Report*
