## 🚨 WORKTREE SAFETY — READ THIS FIRST

**YOU MUST VERIFY YOUR WORKTREE BEFORE EVERY COMMIT.**

Parallel agents are running simultaneously in separate worktrees. Crossing into another agent's worktree WILL contaminate branches and cause hours of cleanup. **This MUST NOT happen.**

**Your worktree:** `/home/tanner/Projects/Zenith-AI-plan-b`
**Your branch:** `plan-b-implementation`


**If you dispatch subagents**, you MUST include this in every subagent prompt:
> "CRITICAL: You are working in /home/tanner/Projects/Zenith-AI-plan-b on branch plan-b-implementation. Before ANY git operation, verify with `pwd` and `git branch --show-current`. Do NOT touch any other worktree or branch."

---

## 🚨 OWNERSHIP RULE — READ THIS FIRST

**You own ONLY these files/directories**:
- `packages/plugin/views/assistant/ai-chat/chat.tsx` (MODIFY)
- `packages/plugin/views/assistant/ai-chat/tool-handlers/` (NEW handlers)
- `packages/plugin/views/assistant/context/index.tsx` (NEW)
- `packages/plugin/views/assistant/view.tsx` (MODIFY)
- `packages/plugin/views/assistant/meetings/meeting-recorder.tsx` (MODIFY)
- `packages/plugin/views/assistant/meetings/recent-meetings.tsx` (MODIFY)
- `packages/plugin/views/settings/customization-tab.tsx` (MODIFY)

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

# Plan B: UI Layer + Views + Legacy Cleanup

# Files created/modified:
#   packages/plugin/views/assistant/ai-chat/tool-handlers/update-vault-structure-handler.tsx (CREATE)
#   packages/plugin/views/assistant/context/index.tsx (CREATE)
#   packages/plugin/views/assistant/view.tsx (MODIFY)
#   packages/plugin/views/assistant/customization-tab.tsx (MODIFY)
#   packages/plugin/views/assistant/ai-chat/chat.tsx (MODIFY)
#   packages/plugin/views/assistant/meetings/meeting-recorder.tsx (MODIFY)
#   packages/plugin/views/assistant/meetings/recent-meetings.tsx (MODIFY)
#   Tool handlers: screenpipe-handler.ts, xyoutube-*.ts (DELETE)
#
# PRE-EXISTING DEPENDENCIES (from Phase 0, already merged):
#   packages/plugin/services/vertex-brain-client.ts
#   packages/plugin/settings.ts
#
# RUNTIME DEPENDENCIES (resolved after merge with Plan A):
#   plugin.organizationPreferences — accessed via plugin object, not imported
#   plugin.backgroundScribe — accessed via plugin object, not imported
#
# This plan runs IN PARALLEL with Plan A. No file overlap.
# Defer tsc --noEmit to post-merge.
# Task 13b: Use 'git add packages/plugin/views/' NOT 'git add -A'

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

## **Phase 4: Cosmic Vault Structure System**


### **Task 13: Add update-vault-structure tool to agent chat**

**Files:** Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/update-vault-structure-handler.tsx`

**Step 1: Create the handler**

```typescript
import React, { useState } from "react";
import { ToolHandlerResult } from "../types";
import type ZenithAIPlugin from "../../../../index";

interface UpdateVaultStructureArgs {
  newRules: string;
  reason: string;
}

export async function handleUpdateVaultStructure(
  args: UpdateVaultStructureArgs,
  plugin: ZenithAIPlugin
): Promise<ToolHandlerResult> {
  try {
    if (!plugin.organizationPreferences) {
      return { success: false, error: "Cosmic Vault Structure service not initialized" };
    }
    await plugin.organizationPreferences.updateRules(args.newRules);
    plugin.organizationPreferences.invalidate();
    return {
      success: true,
      message: `Cosmic Vault Structure updated. Reason: ${args.reason}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
```

**Step 2: Register the tool in the agent tool definitions**

Find where other tools are registered (look for existing tool definitions like move_files, rename_files, etc. in the chat tool config). Add:

```json
{
  "name": "update_vault_structure",
  "description": "Update the Cosmic Vault Structure when the user requests changes to how files are sorted or organized. Call this when the user says things like 'I want all X to go in folder Y' or 'stop putting Z in that folder'.",
  "parameters": {
    "type": "object",
    "properties": {
      "newRules": {
        "type": "string",
        "description": "The complete new content for the Cosmic Vault Structure document in markdown format"
      },
      "reason": {
        "type": "string",
        "description": "Brief explanation of what changed and why"
      }
    },
    "required": ["newRules", "reason"]
  }
}
```

**Step 3: Wire handler into tool execution switch/dispatch**

Find where tool results are dispatched (the switch or if-chain on tool name). Add:

```typescript
case "update_vault_structure":
  result = await handleUpdateVaultStructure(toolArgs, plugin);
  break;
```

**Step 4: Verify TypeScript compiles**

```bash
cd /home/tanner/Projects/Zenith-AI
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20
```

**Expected:** no errors

**Step 5: Commit**

```bash
git add packages/plugin/views/assistant/ai-chat/tool-handlers/update-vault-structure-handler.tsx
git commit -m "feat: add update_vault_structure agent tool for Cosmic Vault Structure live updates"
```

---

### **Task 13b: Rename legacy organization-rules references across codebase**

**Scope:** Search the entire `packages/plugin/` directory for any existing references to the old tool/naming and update them to match the new Cosmic Vault Structure naming.

**Step 1: Find and replace old tool name references**

```bash
cd /home/tanner/Projects/Zenith-AI
grep -rn "update_organization_rules\|update-organization-rules\|UpdateOrganizationRules\|handleUpdateOrganizationRules\|OrganizationRulesArgs" packages/plugin/ --include="*.ts" --include="*.tsx"
```

For every match found, rename:
- `update_organization_rules` → `update_vault_structure`
- `update-organization-rules` → `update-vault-structure`
- `UpdateOrganizationRules` → `UpdateVaultStructure`
- `handleUpdateOrganizationRules` → `handleUpdateVaultStructure`
- `UpdateOrganizationRulesArgs` → `UpdateVaultStructureArgs`

**Step 2: Rename handler file if it exists**

```bash
cd /home/tanner/Projects/Zenith-AI
if [ -f packages/plugin/views/assistant/ai-chat/tool-handlers/update-organization-rules-handler.tsx ]; then
  git mv packages/plugin/views/assistant/ai-chat/tool-handlers/update-organization-rules-handler.tsx \
        packages/plugin/views/assistant/ai-chat/tool-handlers/update-vault-structure-handler.tsx
fi
```

**Step 3: Update any user-facing strings referencing old naming**

```bash
grep -rn "Vault Organization Rules\|Organization rules updated\|organization rules" packages/plugin/ --include="*.ts" --include="*.tsx"
```

For every match found, update to use "Cosmic Vault Structure" in user-facing strings. Internal service class names (e.g., `OrganizationPreferencesService`) may remain unchanged — they are not user-facing.

**Step 4: Verify TypeScript compiles**

```bash
cd /home/tanner/Projects/Zenith-AI
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20
```

**Expected:** no errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename organization-rules tool and strings to Cosmic Vault Structure"
```


---


### **Task 15: Add Vault Intelligence section to settings UI**

### **Task 15: Add Vault Intelligence section to settings UI**

**Files:** Modify: `packages/plugin/views/assistant/customization-tab.tsx` (or whichever file contains the settings tab UI)

**Step 1: Find the settings tab file**

```bash
grep -rn "customFolderInstructions\|useSimilarTags" packages/plugin/views/ --include="*.tsx" -l
```

**Step 2: Add Vault Intelligence section**

Find the last settings section in the file. Add a new section:

```typescript
{/* Vault Intelligence */}
<div className="setting-item setting-item-heading">
  <div className="setting-item-info">
    <div className="setting-item-name">Vault Intelligence</div>
    <div className="setting-item-description">
      Semantic auto-sorting powered by your Vertex AI Brain
    </div>
  </div>
</div>

<div className="setting-item">
  <div className="setting-item-info">
    <div className="setting-item-name">Vertex Brain URL</div>
    <div className="setting-item-description">
      URL of your Vertex AI Brain gateway (leave empty to disable)
    </div>
  </div>
  <div className="setting-item-control">
    <input
      type="text"
      className="setting-input"
      value={settings.vertexBrainUrl}
      placeholder="http://localhost:8085"
      onChange={(e) => updateSettings({ vertexBrainUrl: e.target.value })}
    />
  </div>
</div>

<div className="setting-item">
  <div className="setting-item-info">
    <div className="setting-item-name">Enable Vector Auto-Sort</div>
    <div className="setting-item-description">
      Automatically route General files using semantic embeddings
    </div>
  </div>
  <div className="setting-item-control">
    <input
      type="checkbox"
      checked={settings.enableVectorAutoSort}
      onChange={(e) => updateSettings({ enableVectorAutoSort: e.target.checked })}
    />
  </div>
</div>

<div className="setting-item">
  <div className="setting-item-info">
    <div className="setting-item-name">Auto-Sort Confidence Threshold</div>
    <div className="setting-item-description">
      Minimum confidence (0–1) to auto-sort without showing suggestion UI. Default: 0.75
    </div>
  </div>
  <div className="setting-item-control">
    <input
      type="number"
      min="0"
      max="1"
      step="0.05"
      className="setting-input"
      value={settings.autoSortConfidenceThreshold}
      onChange={(e) =>
        updateSettings({ autoSortConfidenceThreshold: parseFloat(e.target.value) })
      }
    />
  </div>
</div>

<div className="setting-item">
  <div className="setting-item-info">
    <div className="setting-item-name">Cosmic Vault Structure</div>
    <div className="setting-item-description">
      Path to the note that defines your Cosmic Vault Structure
    </div>
  </div>
  <div className="setting-item-control">
    <input
      type="text"
      className="setting-input"
      value={settings.organizationRulesPath}
      placeholder="System/Cosmic Vault Structure.md"
      onChange={(e) => updateSettings({ organizationRulesPath: e.target.value })}
    />
  </div>
</div>
```

**Step 3: Verify TypeScript compiles**

```bash
cd /home/tanner/Projects/Zenith-AI
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20
```

**Expected:** no errors

**Step 4: Commit**

```bash
git add packages/plugin/views/
git commit -m "feat: add Vault Intelligence settings section to settings UI"
```

---



---

## **Phase 4: Project Context Panel (Cosmic Context Tab)**


### **Task 18: Repurpose Meetings Tab → Cosmic Context**

**Files:** Modify: `packages/plugin/views/assistant/view.tsx`

**Step 1: Update tab union type**

```typescript
// Change from:
// "organizer" | "inbox" | "chat" | "sync" | "meetings"
// to:
"organizer" | "inbox" | "chat" | "sync" | "context"
```

**Step 2: Replace component references**

```typescript
// Replace:
import { MeetingsTab } from "./meetings";
// with:
import { ProjectContextTab } from "./context";

// Replace:
<MeetingsTab />
// with:
<ProjectContextTab />
```

**Step 3: Update tab label in UI**

```typescript
// Change tab display name from "Meetings" to "Cosmic Context"
```

### **Task 19: Create ProjectContextTab**

**Files:** Create: `packages/plugin/views/assistant/context/index.tsx`

**Step 1: Create the component**

```typescript
import { Component, React } from "obsidian";
import type ZenithAIPlugin from "../../index";

export class ProjectContextTab extends Component {
  private plugin: ZenithAIPlugin;
  private activeProject: string | null = null;
  private relatedFiles: VaultSearchResult[] = [];
  
  constructor(plugin: ZenithAIPlugin) {
    super();
    this.plugin = plugin;
  }

  onload() {
    // Listen for chat turn events
    this.plugin.app.workspace.on("vault-intelligence:chat-turn", async (data) => {
      await this.updateContext(data.conversationSummary, data.activeFile);
    });
  }

  async updateContext(conversationSummary: string, activeFile: TFile | null) {
    if (!this.plugin.vertexBrainClient) return;
    
    // Detect active project
    if (activeFile) {
      const projectPath = this.detectProjectFromPath(activeFile.path);
      if (projectPath) this.activeProject = projectPath;
    }

    // Search for related files
    const results = await this.plugin.vertexBrainClient.vectorSearch(
      conversationSummary.slice(0, 2000),
      15
    );
    
    this.relatedFiles = results.filter(r => r.similarity > 0.65);
    this.redraw();
  }

  detectProjectFromPath(filePath: string): string | null {
    const projectsPath = this.plugin.settings.projectsPath;
    const match = filePath.match(new RegExp(`${projectsPath}/([^/]+)`));
    return match ? match[1] : null;
  }

  render() {
    return (
      <div className="project-context-tab">
        <div className="active-project">
          <h3>Active Project: {this.activeProject || "None"}</h3>
        </div>
        
        <div className="related-files">
          <h4>Contextually Related Files</h4>
          <ul>
            {this.relatedFiles.map(file => (
              <li key={file.id}>
                <a href={file.id}>{file.id}</a>
                <span className="similarity">({(file.similarity * 100).toFixed(1)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
}
```

### **Task 20: Conversation → Context Event Bridge**

**Files:** Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Dispatch event after each assistant turn**

```typescript
// After receiving assistant response:
app.workspace.trigger("vault-intelligence:chat-turn", {
  conversationSummary: this.buildConversationSummary(),
  activeFile: this.plugin.app.workspace.getActiveFile()
});
```

---


---

### **Task 22: Chat Toggle Integration**

**Files:** Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Step 1: Add toggle state**

In the chat component, add a state variable:

```typescript
  private scribeActive = false;
```

**Step 2: Add toggle method using plugin's initialized instance**

```typescript
  toggleScribe(): void {
    if (!this.plugin.backgroundScribe) return; // Not available
    if (this.scribeActive) {
      this.plugin.backgroundScribe.deactivate();
      this.scribeActive = false;
    } else {
      this.plugin.backgroundScribe.activate();
      this.scribeActive = true;
    }
    this.redraw();
  }
```

**Step 3: Add toggle button to render**

```typescript
  <div className="chat-controls">
    <button 
      className={`scribe-toggle ${this.scribeActive ? 'active' : ''}`}
      onClick={() => this.toggleScribe()}
    >
      {this.scribeActive ? '⏸ Background Scribe: Active' : '▶ Background Scribe'}
    </button>
  </div>
```

**NOTE:** This uses `this.plugin.backgroundScribe` (initialized by Plan A, Task 23) instead of
importing BackgroundScribe directly. No cross-plan import needed.

**Step 4: Verify TypeScript compiles**

```bash
echo "Full tsc deferred to post-merge — this file references plugin.backgroundScribe which Plan A adds"
```

**Step 5: Commit**

```bash
git add packages/plugin/views/assistant/ai-chat/chat.tsx
git commit -m "feat: add Background Scribe toggle to chat UI"
```

---


## **Phase 6: Legacy Cleanup (Meetings + Dead Tools)**


### **Task 24: Remove Legacy Meeting Internals**

**Files:**

- Delete contents of: `meeting-recorder.tsx`
- Delete contents of: `recent-meetings.tsx`

**Step 1:** Keep the directory structure but remove all internal components. Replace with:

```typescript
// meeting-recorder.tsx
export const MeetingRecorder = () => null; // Legacy component removed

// recent-meetings.tsx
export const RecentMeetings = () => null; // Legacy component removed
```

### **Task 25: Remove Deprecated Tool Handlers**

**Files:**

- Delete: `screenpipe-handler.ts`
- Delete: `xyoutube-handler.ts`
- Delete: `xyoutube-transcript.ts`

**Step 1:** Remove imports and registrations from tool index

```typescript
// In tool-handlers/index.ts, remove:
// export * from "./screenpipe-handler";
// export * from "./xyoutube-handler";
// export * from "./xyoutube-transcript";

// Remove from tool registry:
// { name: "screenpipe", handler: handleScreenpipe },
// { name: "xyoutube", handler: handleXYoutube },
// { name: "xyoutube_transcript", handler: handleXYoutubeTranscript },
```

---


---


## **Final Verification Checklist**

Run from `/home/tanner/Projects/Zenith-AI`:

**Step 1: TypeScript compiles clean**

```bash
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | grep -c "error" && echo "TS errors found" || echo "TS OK"
```

**Step 2: New services exist**

```bash
ls packages/plugin/services/
```

**Expected:** `vertex-brain-client.ts organization-preferences.ts vault-indexer.ts background-scribe.ts`

**Step 3: Settings have new fields**

```bash
grep "vertexBrainUrl\|enableVectorAutoSort\|autoSortConfidenceThreshold\|pinnedTag\|projectsPath" packages/plugin/settings.ts
```

**Step 4: Pipeline has embedding step**

```bash
grep "recommendFolderWithEmbeddingsStep" packages/plugin/inbox/index.ts
```

**Step 5: Vault structure tool registered**

```bash
grep "update_vault_structure" packages/plugin/views/assistant/ai-chat/ -r
```

**Step 6: Context tab configured**

```bash
grep "\"context\"" packages/plugin/views/assistant/view.tsx
```

**Step 7: Background scribe integrated**

```bash
grep "BackgroundScribe" packages/plugin/index.ts
```

Run from `Zeniths-Vectors/`:

**Step 8: pgvector in docker-compose**

```bash
grep "pgvector:" docker-compose.yml
```

**Step 9: New endpoints exist**

```bash
grep "/v1/embed\|/v1/vector-upsert\|/v1/vector-search" gateway.py
```

**Step 10: Both files compile**

```bash
python -m py_compile gateway.py && echo "gateway OK"
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" && echo "compose OK"
```

---


## **✅ Resulting Architecture**

- **Phase 1-2:** Intelligence backend (embeddings + ranker)
- **Phase 3:** Signal directory + pinned logic + context-aware thresholds
- **Phase 4:** Context awareness UI layer (Cosmic Context Tab)
- **Phase 5:** Autonomous plan synthesis (Background Scribe with strict activation)
- **Phase 6:** Codebase cleanup

