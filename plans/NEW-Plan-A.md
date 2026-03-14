## 🚨 WORKTREE SAFETY — READ THIS FIRST

**YOU MUST VERIFY YOUR WORKTREE BEFORE EVERY COMMIT.**

Parallel agents are running simultaneously in separate worktrees. Crossing into another agent's worktree WILL contaminate branches and cause hours of cleanup. **This MUST NOT happen.**

**Your worktree:** `/home/tanner/Projects/Zenith-AI-plan-a`
**Your branch:** `plan-a-implementation`

You are the **orchestrator** coordinating parallel subagent execution between yourself and Claude Code. Both agents implement and review their respective plans concurrently. Once **all implementations are verified and reviewed on both sides**, you are in charge of implementing the the final step: ensure a **clean, conflict-free merge and push to remote**. 

- **Prioritize parallel execution**: Launch multiple subagents concurrently. Maintain **at least 5 active implementing subagents** at all times throughout plan execution.
- **Implementation phase**: Work through the plan by dispatching parallel batches of implementation tasks. As subagents complete, immediately backfill to keep ≥5 active.
- **Review phase**: Once all tasks are implemented, launch a **separate wave of review subagents** — again in batches of at least 5 — to verify each task's implementation.
- **Concurrency limits**: **Never exceed 20 active subagents** at once. Prefer to stay **at or below 15** concurrent subagents. Do not allow subagents to sub-launch additional agents that would push the total beyond these limits.
Parallel agents are running simultaneously in separate worktrees. Crossing into another agent's worktree WILL contaminate branches and cause hours of cleanup. **This MUST NOT happen.**

---

## 🚨 OWNERSHIP RULE — READ THIS FIRST

**You own ONLY these files/directories**:
- `packages/plugin/services/organization-preferences.ts` (NEW)
- `packages/plugin/services/vault-indexer.ts` (NEW)
- `packages/plugin/services/background-scribe.ts` (NEW)
- `packages/plugin/services/vertex-brain-client.ts` (MODIFY)
- `packages/plugin/index.ts` (MODIFY — wiring only)
- `packages/plugin/inbox/index.ts` (MODIFY — pipeline integration)
- `packages/plugin/settings.ts` (MODIFY — add new settings fields)

Do NOT edit any file outside of your scope. If you find a bug there, note it in your commit message so the human can address it.

**You may READ any file** in the codebase for context, but only **edit files in your scope**.

---

## Required Skill Activations

### At Session Start — activate ALL THREE immediately:
1. **`subagent-driven-development`** — Use subagents to parallelize independent tasks
2. **`using-git-worktrees`** — Ensures all work stays isolated in your assigned worktree
3. **`executing-plans`** — For structured plan execution with review checkpoints

### When Investigating Potential Bugs:
4. **`systematic-debugging`** — Follow diagnostic workflow to confirm bugs before fixing.

### Before Claiming Completion (MANDATORY — do NOT skip):
5. **`verification-before-completion`** — Verify every file exists, every change is correct. Only THEN report complete.

---


# Plan A: Plugin Services + Pipeline + Core Wiring

# Files created/modified:
#   packages/plugin/services/organization-preferences.ts (CREATE)
#   packages/plugin/services/vault-indexer.ts (CREATE)
#   packages/plugin/services/background-scribe.ts (CREATE)
#   packages/plugin/index.ts (MODIFY)
#   packages/plugin/inbox/index.ts (MODIFY)
#
# PRE-EXISTING DEPENDENCIES (from Phase 0, already merged):
#   packages/plugin/services/vertex-brain-client.ts
#   packages/plugin/settings.ts
#
# This plan runs IN PARALLEL with Plan B. No file overlap.
# Defer tsc --noEmit to post-merge.

# **Vault Intelligence — Implementation Plan**

**Goal:** Integrate pgvector embeddings + Vertex AI ranker into Zenith-AI for project-aware auto-sorting, with the model shifting from routing to generation and user dialogue.

**Architecture:** pgvector in Vertex Brain Docker → new gateway embedding endpoints → TypeScript VertexBrainClient in plugin → pipeline overhaul → LiteLLM MCP bridge. See `docs/2026-03-08-vault-intelligence-design.md` for full design.

**Tech Stack:** Python/FastAPI (Vertex Brain extensions), TypeScript/React (plugin), asyncpg, pgvector, Vertex AI text-embedding-004, PostgreSQL 16

**Hard Constraints (never violate):**

- NEVER hardcode model names — always `os.environ.get("VAR", "default")`
- Do NOT hardcode generation params (temperature, top_k, top_p, max_tokens, candidateCount) — none belong here
- Brain URL always comes from plugin settings, never hardcoded
- All thresholds user-configurable via settings
- Graceful fallback if Brain unavailable — existing model pipeline must continue to work

**Assumption:** Zeniths-Vectors production fixes (`docs/plans/2026-03-08-production-fixes.md` in Zeniths-Vectors) are complete and the gateway is running at [http://localhost:8085](http://localhost:8085/). All work targets `Zeniths-Vectors/` — NOT Vertex_AI_Brain (the older v3.0.0 origin).

---

## Phase 2: Plugin Infrastructure

Work directory: /home/tanner/Projects/Zenith-AI/packages/plugin

### Task 8: Create OrganizationPreferencesService

Files: Create: packages/plugin/services/organization-preferences.ts

Step 1: Create organization-preferences.ts

TypeScript

import { TFile } from "obsidian"; import type ZenithAIPlugin from "../index"; export class OrganizationPreferencesService { private plugin: ZenithAIPlugin; private cache: string | null = null; private cacheTimestamp = 0; private readonly CACHE_TTL_MS = 30_000; constructor(plugin: ZenithAIPlugin) { this.plugin = plugin; } get rulesPath(): string { return this.plugin.settings.organizationRulesPath; } invalidate(): void { this.cache = null; } async getRules(): Promise<string> { if (this.cache !== null && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) { return this.cache; } const file = this.plugin.app.vault.getAbstractFileByPath(this.rulesPath); if (!file || !(file instanceof TFile)) { this.cache = ""; this.cacheTimestamp = Date.now(); return ""; } this.cache = await this.plugin.app.vault.read(file as TFile); this.cacheTimestamp = Date.now(); return this.cache; } async updateRules(newContent: string): Promise<void> { const file = this.plugin.app.vault.getAbstractFileByPath(this.rulesPath); if (file instanceof TFile) { await this.plugin.app.vault.modify(file, newContent); } else { // Create parent directories if needed const parts = this.rulesPath.split("/"); if (parts.length > 1) { const dir = parts.slice(0, -1).join("/"); if (!this.plugin.app.vault.getAbstractFileByPath(dir)) { await this.plugin.app.vault.createFolder(dir); } } await this.plugin.app.vault.create(this.rulesPath, newContent); } this.cache = newContent; this.cacheTimestamp = Date.now(); } async ensureExists(): Promise<void> { const existing = await this.getRules(); if (existing) return; const template = `# Cosmic Vault Structure ## Active Rules - Group notes by project rather than by type - Files tagged with #${this.plugin.settings.pinnedTag} will not be auto-sorted ## Project Registry <!-- Add your projects here as: ProjectName → /FolderPath/ --> --- This document is live-updated by the AI assistant when you request organizational changes. `; await this.updateRules(template); } }

Step 2: Verify TypeScript compiles

Bash

cd /home/tanner/Projects/Zenith-AI npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20

Expected: no errors

Step 3: Commit

Bash

git add packages/plugin/services/organization-preferences.ts git commit -m "feat: add OrganizationPreferencesService for living vault rules doc"

### Task 9: Create VaultIndexer service

Files: Create: packages/plugin/services/vault-indexer.ts

Step 1: Create vault-indexer.ts

TypeScript

import { TFile } from "obsidian"; import type ZenithAIPlugin from "../index"; import type { VertexBrainClient } from "./vertex-brain-client"; const RATE_LIMIT_MS = 150; export class VaultIndexer { private plugin: ZenithAIPlugin; private queue: TFile[] = []; private running = false; constructor(plugin: ZenithAIPlugin) { this.plugin = plugin; } enqueue(file: TFile): void { if (!this.plugin.settings.enableVectorAutoSort) return; if (!this.queue.find((f) => f.path === file.path)) { this.queue.push(file); } if (!this.running) this.processQueue(); } async indexAll(): Promise<void> { const files = this.plugin.app.vault.getMarkdownFiles(); for (const file of files) this.enqueue(file); } private async processQueue(): Promise<void> { this.running = true; while (this.queue.length > 0) { const file = this.queue.shift()!; try { await this.indexFile(file); } catch (e) { // Non-fatal — log and continue console.debug(`[VaultIndexer] Failed to index ${file.path}:`, e); } await sleep(RATE_LIMIT_MS); } this.running = false; } private async indexFile(file: TFile): Promise<void> { const client: VertexBrainClient | null = this.plugin.vertexBrainClient; if (!client) return; const content = await this.plugin.app.vault.read(file); const metadata = this.plugin.app.metadataCache.getFileCache(file); const tags: string[] = metadata?.frontmatter?.tags ?? []; const folder_path = file.parent?.path ?? ""; await client.vectorUpsert({ id: file.path, content: content.slice(0, 6000), folder_path, tags, }); } } function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms ```)); }

Step 2: Verify TypeScript compiles

Plain Text

npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20

Expected: no errors

Step 3: Commit

Plain Text

git commit -m "feat: add VaultIndexer service for embedding and indexing vault files into Vertex Brain"

### Task 10: Wire services into plugin index.ts

Files: Modify: packages/plugin/index.ts

Step 1: Add imports near top of index.ts

After existing import block, add:

TypeScript

import { VertexBrainClient } from "./services/vertex-brain-client"; import { OrganizationPreferencesService } from "./services/organization-preferences"; import { VaultIndexer } from "./services/vault-indexer";

Step 2: Add service properties to the plugin class

Find the class definition for the plugin (extends Plugin). Add public properties:

TypeScript

vertexBrainClient: VertexBrainClient | null = null; organizationPreferences: OrganizationPreferencesService | null = null; vaultIndexer: VaultIndexer | null = null;

Step 3: Initialize services in onload()

Find onload(). After settings are loaded, add:

TypeScript

// Initialize Vault Intelligence services this.organizationPreferences = new OrganizationPreferencesService(this); this.vaultIndexer = new VaultIndexer(this); if (this.settings.enableVectorAutoSort && this.settings.vertexBrainUrl) { this.vertexBrainClient = new VertexBrainClient(this.settings.vertexBrainUrl); const healthy = await this.vertexBrainClient.health(); if (healthy) { await this.organizationPreferences.ensureExists(); // Background index — non-blocking this.vaultIndexer.indexAll().catch((e) => console.debug("[VaultIndexer] Initial index failed:", e) ); } else { console.warn("[ZenithAI] Vertex Brain unavailable, vector auto-sort disabled"); this.vertexBrainClient = null; } }

Step 4: Re-index on file modify via existing event handlers

Find where this.app.vault.on("modify", ...) or similar is registered. After the existing handler logic, add:

TypeScript

if (file instanceof TFile && file.extension === "md") { this.vaultIndexer?.enqueue(file); }

Step 5: Verify TypeScript compiles

Bash

cd /home/tanner/Projects/Zenith-AI npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -30

Expected: no errors

Step 6: Commit

Bash

git add packages/plugin/index.ts git commit -m "feat: initialize VertexBrainClient, OrganizationPreferences, VaultIndexer in plugin onload"


## Phase 3: Auto-sort Pipeline Overhaul

Work directory: /home/tanner/Projects/Zenith-AI/packages/plugin

### Task 11: Replace model-based folder routing with embeddings + ranker

Files: Modify: inbox/index.ts

The recommendFolderStep currently calls the AI model to suggest a folder. Replace with a vector search + ranker approach, with fallback to the existing model path if Brain is unavailable or confidence is low.

Step 1: Read current recommendFolderStep

Bash

grep -n "recommendFolder\|recommendClassification\|recommendFolder" packages/plugin/inbox/index.ts | head -20

Step 2: Add recommendFolderWithEmbeddingsStep function

Find the location of recommendFolderStep function. Add a new function BEFORE it:

TypeScript

async function recommendFolderWithEmbeddingsStep( context: ProcessingContext ): Promise<ProcessingContext> { const client = context.plugin.vertexBrainClient; if (!client) return context; // Brain not configured, let model handle it try { const contentSample = context.content?.slice(0, 3000) ?? ""; if (!contentSample.trim()) return context; // 1. Find similar notes via vector search const similar = await client.vectorSearch(contentSample, 20); if (!similar.length) return context; // 2. Tally folder frequencies from similar notes const folderCounts = new Map<string, number>(); for (const note of similar) { if (note.folder_path && note.similarity > 0.5) { folderCounts.set( note.folder_path, (folderCounts.get(note.folder_path) ?? 0) + note.similarity ); } } if (!folderCounts.size) return context; // 3. Read Cosmic Vault Structure for context const rules = (await context.plugin.organizationPreferences?.getRules()) ?? ""; // 4. Build candidates for ranker const candidates = Array.from(folderCounts.entries()) .sort((a, b) => b[1] - a[1]) .slice(0, 10) .map(([folder, score]) => ({ id: folder, title: folder, content: `Folder: ${folder} (weighted similarity: ${score.toFixed(2)}). Rules: ${rules.slice(0, 500)}`, })); // 5. Rank candidates const ranked = await client.rank(contentSample.slice(0, 1500), candidates); if (!ranked.length) return context; const best = ranked[0]; // 6. Context-aware threshold selection const isInGeneral = context.file.path.includes("/General/"); const threshold = isInGeneral ? context.plugin.settings.generalMergeThreshold : context.plugin.settings.globalMergeThreshold; if (best.score < threshold) return context; // low confidence, fall through to model // 7. Apply folder — set on context so existing pipeline steps pick it up context.newPath = best.title; context.plugin.recordManager.setFolder(context.hash, best.title); logger.info(`[Embeddings] Auto-sorted to ${best.title} (score: ${best.score.toFixed(2)})`); } catch (e) { logger.warn(`[Embeddings] Folder routing failed, falling back to model: ${e}`); } return context; }

Step 3: Wire into pipeline

Find where recommendFolderStep is called in the pipeline (inside processInboxFile). Add recommendFolderWithEmbeddingsStep BEFORE recommendFolderStep:

TypeScript

// Try embeddings first — falls through to model if unavailable or low confidence context = await safeExecuteStep( context, recommendFolderWithEmbeddingsStep, "recommendFolderEmbeddings", "recommendFolderEmbeddingsFailed" ); // Only call model if embeddings didn't resolve the folder if (!context.newPath) { context = await safeExecuteStep( context, recommendFolderStep, "recommendFolder", "recommendFolderFailed" ); }

Step 4: Verify TypeScript compiles

Bash

cd /home/tanner/Projects/Zenith-AI npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -30

Expected: no errors

Step 5: Commit

Bash

git add packages/plugin/inbox/index.ts git commit -m "feat: add embedding+ranker folder routing with model fallback in auto-sort pipeline"

### Task 12: Update tag pipeline — existing tags via similarity, new tags via model

Files: Modify: inbox/index.ts

Step 1: Add tag similarity helper function

Add before recommendTagsStep:

TypeScript

async function findSimilarTagsFromEmbeddings( context: ProcessingContext ): Promise<string[]> { const client = context.plugin.vertexBrainClient; if (!client) return []; try { const similar = await client.vectorSearch(context.content?.slice(0, 2000) ?? "", 15); const tagCounts = new Map<string, number>(); for (const note of similar) { if (note.similarity > 0.6) { for (const tag of note.tags ?? []) { tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + note.similarity); } } } return Array.from(tagCounts.entries()) .sort((a, b) => b[1] - a[1]) .slice(0, 5) .map(([tag]) => tag); } catch { return []; } }

Step 2: Update recommendTagsStep to merge embedding tags with model tags

Find recommendTagsStep. At the start of its implementation, before calling the AI model for tags, add:

TypeScript

// Pre-populate from embeddings (existing tags from similar notes) const embeddingTags = await findSimilarTagsFromEmbeddings(context); if (embeddingTags.length) { context.tags = [...new Set([...(context.tags ?? []), ...embeddingTags])]; }

Step 3: Verify TypeScript compiles

Bash

cd /home/tanner/Projects/Zenith-AI npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20

Expected: no errors

Step 4: Commit

Bash

git add packages/plugin/inbox/index.ts git commit -m "feat: pre-populate tags from similar notes via vector similarity"


## Phase 5: Signal Directory + Threshold Intelligence

### Task 16: Implement #pinned Tag Lock in Auto-Sort Pipeline

Files: Modify: packages/plugin/inbox/index.ts

Step 1: Add pinned tag check to recommendFolderStep

At the top of recommendFolderStep, add:

TypeScript

// Skip auto-sort if file is #pinned const cache = context.plugin.app.metadataCache.getFileCache(context.containerFile); const inlineTags = cache?.tags?.map(t => t.tag.replace('#', '')) || []; const frontmatterTags = cache?.frontmatter?.tags || []; const allTags = [...inlineTags, ...(Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags])]; if (allTags.includes(context.plugin.settings.pinnedTag)) { logger.info("Skipping folder recommendation: file has #pinned tag"); return context; }

### Task 17: Context-Aware Threshold Routing

Step 2: Modify embedding-based folder decision logic

In recommendFolderWithEmbeddingsStep, replace the static threshold with dynamic logic:

TypeScript

// After ranking, before applying folder const isInGeneral = context.file.path.includes("/General/"); const isInProjects = context.file.path.includes(`/${context.plugin.settings.projectsPath}/`); // Use different thresholds based on location let threshold = context.plugin.settings.autoSortConfidenceThreshold; if (isInGeneral) { threshold = context.plugin.settings.generalMergeThreshold; } else if (!isInProjects) { threshold = context.plugin.settings.globalMergeThreshold; } if (best.score < threshold) return context; // low confidence, fall through to model


## Phase 4: Cosmic Vault Structure — Prompt Injection (index.ts)

Files: Modify: packages/plugin/index.ts (wherever system prompts are constructed)

Step 1: Find where system/assistant prompts are built

Bash

grep -n "systemPrompt\|system_prompt\|getSystemPrompt\|customFolderInstructions" packages/plugin/index.ts | head -20

Step 2: Add Cosmic Vault Structure injection helper

Add a method to the plugin class:

TypeScript

async getOrganizationRulesContext(): Promise<string> { if (!this.organizationPreferences) return ""; const rules = await this.organizationPreferences.getRules(); if (!rules.trim()) return ""; return `\n\n## Cosmic Vault Structure\nThe user has defined this structure for how their vault is organized. Follow it strictly:\n\n${rules}`; }

Step 3: Inject into folder recommendation prompt

Find recommendFolders or customFolderInstructions usage. Append the rules context to the prompt sent to the model:

TypeScript

const rulesContext = await this.getOrganizationRulesContext(); const prompt = `${this.settings.customFolderInstructions}${rulesContext}`;

Step 4: Verify TypeScript compiles

Bash

cd /home/tanner/Projects/Zenith-AI npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20

Expected: no errors

Step 5: Commit

Bash

git add packages/plugin/index.ts git commit -m "feat: inject Cosmic Vault Structure into model folder recommendation prompts"


## **Phase 5: Background Scribe (Autonomous TODO Writer)**


### **Task 21: Create BackgroundScribe Service**

**Files:** Create: `packages/plugin/services/background-scribe.ts`

**Step 1: Create the service with strict activation contract**

```typescript
import { TFile } from "obsidian";
import type ZenithAIPlugin from "../index";
import type { VertexBrainClient } from "./vertex-brain-client";

export class BackgroundScribe {
  private plugin: ZenithAIPlugin;
  private client: VertexBrainClient;
  private buffer: Array<{timestamp: number, content: string}> = [];
  private isActive = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 30000;

  constructor(plugin: ZenithAIPlugin, client: VertexBrainClient) {
    this.plugin = plugin;
    this.client = client;
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.plugin.app.workspace.on("vault-intelligence:chat-turn", this.handleChatTurn);
    console.log("[BackgroundScribe] Activated - will buffer chat turns");
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.plugin.app.workspace.off("vault-intelligence:chat-turn", this.handleChatTurn);
    this.buffer = []; // Clear buffer immediately
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    console.log("[BackgroundScribe] Deactivated - buffer cleared");
  }

  private handleChatTurn = async (data: any) => {
    if (!this.isActive) return; // Strict contract: no processing when inactive
    
    this.buffer.push({
      timestamp: Date.now(),
      content: data.conversationSummary
    });
    
    // Debounce synthesis
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.synthesizeTODO(), this.DEBOUNCE_MS);
  }

  private async synthesizeTODO(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const combinedContent = this.buffer.map(b => b.content).join("\n\n");
    this.buffer = []; // Clear buffer after reading
    
    // Detect project context
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const project = activeFile ? this.detectProject(activeFile.path) : null;
    
    // Use embeddings to find project scope
    const similarNotes = await this.client.vectorSearch(combinedContent, 10);
    const projectFiles = similarNotes.filter(n => 
      project ? n.folder_path.includes(project) : true
    );
    
    // Generate TODO content
    const todoContent = await this.generateTODO(
      combinedContent, 
      projectFiles,
      project
    );
    
    // Write to configured output file
    const outputPath = this.plugin.settings.backgroundScribeOutputFile;
    await this.writeOrUpdateTODO(outputPath, todoContent);
  }

  private detectProject(filePath: string): string | null {
    const projectsPath = this.plugin.settings.projectsPath;
    const match = filePath.match(new RegExp(`${projectsPath}/([^/]+)`));
    return match ? match[1] : null;
  }

  private async generateTODO(
    conversation: string, 
    contextFiles: VaultSearchResult[],
    project: string | null
  ): Promise<string> {
    const context = `Based on this conversation and related files, generate actionable TODO items:\n\n${conversation}`;
    const response = await this.client.answer(context);
    return response.answer;
  }

  private async writeOrUpdateTODO(path: string, content: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.plugin.app.vault.modify(file, content);
    } else {
      await this.plugin.app.vault.create(path, content);
    }
  }

  get isActiveState(): boolean {
    return this.isActive;
  }
}
```

**🔒 Background Scribe Activation Contract (Strict UI Control)**

```typescript
// Background Scribe MUST be activated exclusively via an explicit UI toggle button.
// NO automatic activation. NO intent inference. NO background buffering unless scribeActive === true.
// Buffering begins at moment of activation (no retroactive synthesis).
// Buffer is cleared on deactivation. When deactivated, service does NOT listen to chat-turn events.
```


## Phase 5: Background Scribe — Plugin Initialization

### Task 23: Plugin Initialization

Files: Modify: packages/plugin/index.ts

Step 1: Initialize BackgroundScribe after VertexBrainClient

TypeScript

// In onload(), after vertexBrainClient initialization: if (this.vertexBrainClient) { this.backgroundScribe = new BackgroundScribe(this.app, this.vertexBrainClient); }

---

## 🏁 COMPLETION DIRECTIVE: Brand & Theme Alignment Verification

**Before claiming this plan is complete, verify ALL of the following.** No user-facing text, model-facing text, or developer-facing text should reference old branding ("File Organizer", "Note Companion", "notecompanion", "organization rules"). Everything must reflect the Zenith-AI / Cosmic Vault theme.

### A. User-Facing Strings (what the user sees in Obsidian)

Check every file you touched or created. None of these old strings should appear:
- [ ] No `"File Organizer"` in any Notice(), UI label, description, or placeholder
- [ ] No `"Note Companion"` in any error message, tooltip, or status text
- [ ] No `"organization rules"` — must be `"Cosmic Vault Structure"` everywhere user-visible
- [ ] Console warnings use `[ZenithAI]` prefix, not `[NoteCompanion]` or `[FileOrganizer]`

### B. Model-Facing Strings (what the AI model sees)

If you create or modify any prompt, system message, tool description, or context string:
- [ ] System prompts reference "Zenith-AI", not old names
- [ ] Tool descriptions use new terminology
- [ ] Context strings assembled from settings use `Cosmic Vault Structure` path, not `organization rules`
- [ ] Any logging/debug strings injected into model context use new naming

### C. Settings Defaults (new services you create)

For every new setting field added to `settings.ts`:
- [ ] Default paths use `_ZenithAI/` prefix (not `_FileOrganizer/`)
- [ ] Setting names/descriptions in the UI use "Zenith-AI" and "Cosmic Vault Structure"
- [ ] No setting defaults reference `.notecompanion/` — use `_ZenithAI/` instead

### D. Code Identifiers

- [ ] New classes use `ZenithAI` prefix where appropriate (not `FileOrganizer`)
- [ ] New type imports reference `ZenithAIPlugin` (not `FileOrganizerPlugin`)
- [ ] New service constructors accept `ZenithAIPlugin` (the renamed type)

### E. Known Pre-Existing Issues (DO NOT fix — out of scope, noted for awareness)

These exist in files you do NOT own. Do not touch them, but be aware:
- `AGENTS.MD` lines 1, 5, 12, 1366 — still says "Note Companion" (developer docs, not user-facing)
- `settings.ts:30` — `stagingFolder = ".notecompanion/staging"` (migration risk, separate task)
- `index.ts:148,177` — `https://app.notecompanion.ai` backend URLs (domain migration, separate task)
- `general-tab.tsx:415`, `catalyst-gate.tsx:64` — `notecompanion.ai` links (domain dependent)
- `apiUtils.ts:59` — `'File Organizer error:'` in Notice (Plan B scope or separate fix)
- `dashboard/view.tsx:23` — `"File Organizer Dashboard"` (not in either plan's scope)
- `general-tab.tsx:216,353` — old branding in license key placeholder and token error

### F. Verification Command

Run this from the worktree root after completing all tasks:
```bash
grep -rn "File Organizer\|Note Companion\|NoteCompanion\|organization.rules\|\.notecompanion\|FileOrganizer" packages/plugin/services/ packages/plugin/inbox/index.ts --include="*.ts" | grep -v node_modules | grep -v ".test."
```
**Expected output: empty** (zero matches in files you own)
