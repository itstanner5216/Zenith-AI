### Task 5.2 — Remove `apiKey` prop from container and view

**File:** `packages/plugin/views/assistant/ai-chat/container.tsx`

**Changes:**
1. Remove `apiKey` from `AIChatSidebarProps` (line 20)
2. Remove `apiKey` from destructuring (line 27)
3. Remove `apiKey={apiKey}` from `<ChatComponent>` (line 219)

**File:** `packages/plugin/views/assistant/view.tsx`

**Changes:**
1. Remove `apiKey={plugin.settings.API_KEY}` from both `<AIChatSidebar>` usages (lines 110 and 122)

---

### Task 5.3 — Update index.ts with migration and AIService

**File:** `packages/plugin/index.ts`

**Changes:**

1. **Add imports:**
   ```typescript
   import { migrateSettings } from "./services/settings-migration";
   import { AIService } from "./services/ai/ai-service";
   ```

2. **Remove `getApiKey()` method** (lines 77-79)

3. **Update `loadSettings()` to run migration** (lines 48-50):
   ```typescript
   async loadSettings() {
     const rawData = await this.loadData();
     this.settings = Object.assign({}, DEFAULT_SETTINGS, rawData);

     // Run migration from legacy API_KEY + selectedModel format
     if (migrateSettings(this.settings, rawData || {})) {
       await this.saveSettings();
     }
   }
   ```

4. **Add `aiService` property** to the class:
   ```typescript
   export default class ZenithAI extends Plugin {
     settings: ZenithAISettings;
     backgroundScribe: BackgroundScribe | null = null;
     aiService: AIService | null = null;
   ```

5. **Initialize AIService in onload** (after loadSettings):
   ```typescript
   async onload() {
     await this.initializePlugin();
     logger.configure(this.settings.debugMode);
     await this.saveSettings();

     this.aiService = new AIService(this.settings);

     initializeOrganizer(this);
     // ... rest unchanged
   }
   ```
---


