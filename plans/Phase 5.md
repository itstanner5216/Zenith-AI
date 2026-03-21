## Layer 5: Integration

### Task 5.1 — Swap useChat → useZenithChat in chat.tsx

This is the largest single change. The `ChatComponent` in `chat.tsx` (1742 lines) needs its core hook swapped.

**File:** `packages/plugin/views/assistant/ai-chat/chat.tsx`

**Changes summary:**

1. **Remove imports** (lines 10, 25-26):
   - Remove: `import { useChat, UseChatOptions } from "@ai-sdk/react";`
   - Remove: `import { UIMessage } from "@ai-sdk/ui-utils";`
   - Keep: `import { convertToCoreMessages, UIMessage as AIUIMessage, isToolUIPart, ToolUIPart } from "ai";`

2. **Add imports:**
   ```typescript
   import { useZenithChat } from "./hooks/use-zenith-chat";
   import { AIService } from "../../../services/ai/ai-service";
   import { createPluginTools } from "../../../services/ai/tool-adapter";
   import type { UIMessage } from "ai";
   ```

3. **Remove `apiKey` from ChatComponentProps** (line 62):
   ```typescript
   // BEFORE
   interface ChatComponentProps {
     plugin: ZenithAI;
     apiKey: string;          // REMOVE THIS
     inputRef: ...
   }

   // AFTER
   interface ChatComponentProps {
     plugin: ZenithAI;
     inputRef: React.RefObject<HTMLDivElement | null>;
     onTokenLimitError?: (error: string) => void;
     activeChatId: string | null;
     onSessionUpdate?: (session: ChatSession) => void;
     chatSessions?: ChatSession[];
     onSelectChat?: (id: string) => void;
     onDeleteChat?: (id: string) => void;
     isChatTabActive?: boolean;
   }
   ```

4. **Remove `apiKey` from destructuring** (line 74):
   ```typescript
   // Remove: apiKey,
   ```

5. **Remove `selectedModel` state** (line 180-182) and replace with `activeModelConfigId`:
   ```typescript
   const [activeModelConfigId, setActiveModelConfigId] = useState(
     plugin.settings.activeModelConfigId
   );
   ```

6. **Remove `ModelType` import** (line 30):
   Remove: `import { ModelType } from "./types";`

7. **Add AIService + useZenithChat** — replace the entire `useChat(...)` block (lines 223-419+) with:
   ```typescript
   const aiService = useMemo(() => new AIService(plugin.settings), [plugin.settings]);
   const pluginTools = useMemo(() => createPluginTools(), []);

   const {
     status,
     messages,
     sendMessage,
     addToolResult,
     stop,
     error,
     reload,
     setMessages,
   } = useZenithChat({
     aiService,
     tools: pluginTools,
     maxSteps: 5,
     onError: error => {
       logger.error("Chat error:", error);
       setErrorMessage(error.message || "An error occurred");
     },
     onFinish: message => {
       // Context snapshot storage
       const contextUsed = lastContextSentRef.current;
       if (message.id) {
         contextByAssistantIdRef.current[message.id] = contextUsed;
       }
       clearEphemeralContext();

       // Session saving
       if (activeChatId) {
         chatHistoryManager.updateSession(activeChatId, {
           messages: messages.concat(message),
         });
         onSessionUpdate?.({
           ...chatHistoryManager.getSession(activeChatId)!,
           messages: messages.concat(message),
         });
       }

       // Vault intelligence event dispatch (for BackgroundScribe)
       plugin.app.workspace.trigger("vault-intelligence:chat-turn" as any, {
         sessionId: activeChatId,
         message,
         context: contextUsed,
       });
     },
   });
   ```

8. **Remove** the `chatBody`, `fullContext`, `contextString` memos (lines 175-218) — context will be built at send time.

9. **Remove** `input`, `handleInputChange`, `handleSubmit` from the hook output (they no longer exist).

10. **Rewrite `handleSendMessage`** (lines 1195-1259):
    ```typescript
    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (status !== "ready") {
        stop();
        return;
      }

      const editor = tiptapEditorRef.current;
      const editorContent = editor?.getText() || "";
      if (!editorContent.trim()) return;

      // Validate that a model is configured
      if (!plugin.settings.activeModelConfigId) {
        new Notice("No model configured. Go to Settings → Providers to set up a model.", 5000);
        return;
      }

      // Build context from Zustand store (same logic as old prepareRequestBody)
      const store = useContextItems.getState();
      const freshContextItems = {
        files: store.files || {},
        folders: store.folders || {},
        tags: store.tags || {},
        currentFile: store.currentFile || null,
        searchResults: store.searchResults || {},
        textSelections: store.textSelections || {},
      };
      const contextJson = JSON.stringify(freshContextItems);

      const contextFilePaths = [
        ...Object.values(freshContextItems.files).map((f: { path: string }) => f.path),
        ...(freshContextItems.currentFile &&
        !Object.values(freshContextItems.files).some(
          (f: { path: string }) => f.path === freshContextItems.currentFile?.path
        )
          ? [freshContextItems.currentFile.path]
          : []),
      ];
      const filePathsBlock =
        contextFilePaths.length > 0
          ? `Attached file paths — use these exact strings for mergeFiles sourceFiles, deleteFiles filePaths (do not modify):\n${contextFilePaths.join("\n")}\n\n`
          : "";
      const freshContextString = filePathsBlock + contextJson;

      // Get fresh editor context
      let freshEditorContext = "";
      try {
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          freshEditorContext = formatEditorContextForAI({
            selectedText: view.editor.getSelection(),
            cursorPosition: view.editor.getCursor(),
            currentLine: view.editor.getLine(view.editor.getCursor().line),
            lineNumber: view.editor.getCursor().line,
            hasSelection: view.editor.getSelection().length > 0,
            filePath: view.file?.path || null,
            fileName: view.file?.basename || null,
            selection: view.editor.getSelection().length > 0
              ? { anchor: view.editor.getCursor("from"), head: view.editor.getCursor("to") }
              : null,
          });
        }
      } catch (err) {
        logger.warn("Failed to get editor context:", err);
      }

      const fullContext = freshEditorContext
        ? `${freshContextString}\n\n${freshEditorContext}`
        : freshContextString;

      // Save for onFinish snapshotting
      lastContextSentRef.current = fullContext;

      // Clear the editor
      editor?.commands.setContent("");

      await sendMessage(editorContent, { context: fullContext });

      setAttachments([]);
    };
    ```

11. **Rewrite `handleMessageRefresh`** — simplified since we use `reload`:
    ```typescript
    const handleMessageRefresh = async (messageIndex: number) => {
      // Remove messages from the index onward (including the one being refreshed)
      const trimmed = messages.slice(0, messageIndex);
      setMessages(trimmed);

      // Rebuild context for reload
      const store = useContextItems.getState();
      const contextJson = JSON.stringify({
        files: store.files || {},
        folders: store.folders || {},
        tags: store.tags || {},
        currentFile: store.currentFile || null,
        searchResults: store.searchResults || {},
        textSelections: store.textSelections || {},
      });
      lastContextSentRef.current = contextJson;

      await reload({ context: contextJson });
    };
    ```

12. **Update `ModelSelector` usage** (lines 1733-1736):
    ```typescript
    <ModelSelector
      selectedModelConfigId={activeModelConfigId}
      onModelSelect={setActiveModelConfigId}
    />
    ```

13. **Remove the `handleTiptapChange` callback** that syncs to `handleInputChange` (line 1265-1268). The Tiptap editor now manages its own state — content is read directly from the editor ref in `handleSendMessage`.

14. **Remove the `onDataChunk` handler** (lines 362-366) — grounding metadata was from the server, no longer applicable.

15. **Remove `groundingMetadata` state and `SourcesSection`** rendering — this was server-side data, not from direct provider calls.

---

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
