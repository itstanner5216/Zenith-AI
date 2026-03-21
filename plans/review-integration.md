# Integration Review — Cross-Phase Seams
> Scope: how Phase 1–4 pieces connect through the Phase 5 wiring layer.
> Per-file quality is handled by per-phase reviewers; this review covers only seams.

---

## § 1 — Settings Flow (`index.ts` + `settings-migration.ts`)

**[INFO] Migration is called correctly on load**
`loadSettings()` calls `migrateSettings(this.settings, rawData || {})` and immediately calls `saveSettings()` if migration occurred. The guard (`if (!legacyKey) return false` and `if (settings.providerKeys.length > 0) return false`) prevents double-migration. ✅

**[WARNING] Double `saveSettings` on every cold start**
`onload()` calls `initializePlugin()` (which calls `loadSettings()`, which already saves on migration), then unconditionally calls `saveSettings()` again:
```typescript
async onload() {
  await this.initializePlugin();   // loadSettings → conditional saveSettings
  logger.configure(this.settings.debugMode);
  await this.saveSettings();       // always fires again
```
If migration didn't run, this is a redundant write on every plugin load. Not a data-loss risk, but on slow vaults with large data files this adds unnecessary I/O on every startup. Consider: only call `saveSettings()` after `initializePlugin()` if `debugMode` was not already persisted with the correct value.

**[INFO] Migration hardcodes `provider: "openai"`**
`migrateSettings` always creates `provider: "openai"` for the migrated key. If a user's legacy `API_KEY` was an Anthropic or OpenAI-compatible key, the migration will create a broken config that silently fails at inference time rather than explaining why.

---

## § 2 — AIService Lifecycle (`chat.tsx` + `ai-service.ts`)

**[INFO] AIService is correctly a per-component singleton via `useMemo`**
```typescript
const aiService = useMemo(() => new AIService(plugin.settings), [plugin.settings]);
```
`plugin.settings` is a class instance — always the same object reference. `useMemo` will never recreate `AIService` across renders, which is correct: `AIService` holds a reference to `plugin.settings` and reads `activeModelConfigId`, `providerKeys`, `modelConfigs` dynamically on each call. Settings mutations in ProvidersTab flow through to `AIService.getActiveModel()` without a new instance being needed. ✅

**[WARNING] `plugin.aiService` in `index.ts` is an orphaned instance**
`onload()` creates `this.aiService = new AIService(this.settings)` and stores it on the plugin, but nothing in the component tree ever reads `plugin.aiService`. All components (`chat.tsx`, `ProvidersTab`) create their own instances. The field on the class creates the expectation that it is the canonical service, but it is silently ignored. Either remove it or actually thread it as a prop/context to the components that need it.

---

## § 3 — Active Model Propagation (`ModelSelector` → `plugin.settings` → `AIService`)

**[WARNING] `ModelSelector` has side-effects beyond its prop contract**
`ModelSelector` is passed `onModelSelect` as a callback but also writes directly to `plugin.settings`:
```typescript
onChange={e => {
  onModelSelect(e.target.value);               // updates local React state
  plugin.settings.activeModelConfigId = e.target.value; // direct mutation
  plugin.saveSettings();                       // persists
}}
```
The component breaks the controlled-component pattern by owning a side effect that belongs to the parent. If `onModelSelect` is ever wired to do more than `setActiveModelConfigId` (e.g., trigger a re-init), the direct mutation creates a hidden dual-write path. The settings mutation and save should live in the parent's `onModelSelect` handler, not inside the component.

**[WARNING] Local `activeModelConfigId` state drifts from ProvidersTab changes**
`chat.tsx` initializes `activeModelConfigId` state once:
```typescript
const [activeModelConfigId, setActiveModelConfigId] = useState(
  plugin.settings.activeModelConfigId
);
```
If the user changes the active model in the ProvidersTab (Settings panel) while the chat is open, `ProvidersTab`'s `useEffect` mutates `plugin.settings.activeModelConfigId`, but the chat component's local `activeModelConfigId` state is never updated. The `ModelSelector` dropdown will show the stale selection until the pane is remounted. The actual LLM call will use the correct value (reads `plugin.settings.activeModelConfigId` directly in `handleSendMessage`), so this is a display-only desync, but it is confusing.

---

## § 4 — Provider Keys → ModelSelector Update Path (`providers-tab.tsx` → `model-selector.tsx`)

**[ERROR] New models added in ProvidersTab do not appear in ModelSelector until remount**
`ModelSelector` reads from `plugin.settings.modelConfigs` via `usePlugin()`:
```typescript
const plugin = usePlugin();
const { modelConfigs } = plugin.settings;
```
`usePlugin()` returns a stable reference to the `plugin` object (never changes). React has no visibility into mutations of `plugin.settings.modelConfigs` — it does not trigger a re-render. When `ProvidersTab` adds a model, it:
1. Updates its own local React state (`setModelConfigs`)
2. Mutates `plugin.settings.modelConfigs` in a `useEffect`
3. Saves settings

Step 2 is invisible to `ModelSelector`. A user who adds their first model in Settings and then clicks into the chat will see "No models configured" in the ModelSelector until they close and reopen the sidebar pane. The fix is either to lift `modelConfigs` into React context/state that both components subscribe to, or to add a `forceUpdate`/version counter that re-renders the ModelSelector when settings change.

---

## § 5 — Chat History Integration (`container.tsx` + `chat.tsx` → `ChatHistoryManager`)

**[INFO] Singleton initialization is correct**
Both `container.tsx` and `chat.tsx` call `ChatHistoryManager.getInstance(plugin.app)`. The first call (container) creates the singleton; the second call (chat) returns the same instance. `app` is the Obsidian `App` instance — a singleton — so both callers get the same `ChatHistoryManager`. ✅

**[WARNING] `onFinish` closure captures stale `activeChatId` during tab switches**
In `chat.tsx`, the `onFinish` callback is an inline arrow function passed to `useZenithChat`. It captures `activeChatId` from closure:
```typescript
onFinish: message => {
  if (activeChatId) {
    chatHistoryManager.updateSession(activeChatId, { ... });
```
Because `activeChatId` is a prop, each render creates a new `onFinish` referencing the current value. `useZenithChat`'s `runStream` has `onFinish` in its `useCallback` deps, so `runStream` (and `sendMessage`) are recreated on every render. If the user switches to a different tab mid-stream (changing `activeChatId` → new `onFinish` → new `runStream`), the in-flight stream's `onFinish` is the OLD closure. Messages from that stream will be saved to the previous session ID, not the new one.

This is a low-probability race but correctness-breaking when it hits. Fix: use a stable ref pattern (`onFinishRef.current = onFinish`) inside `useZenithChat`, call `onFinishRef.current` instead of the stale `onFinish` dep.

---

## § 6 — Tool Results Flow (`use-zenith-chat.ts` → `ToolCallHandler` → `addToolResult`)

**[ERROR] Tool results never loop back to the LLM — multi-step tool use is broken**
This is the most critical integration gap between Phase 2–3 (tool system) and Phase 4 (`useZenithChat`).

Tools are defined without `execute` functions (by design — they execute client-side via `ToolCallHandler`):
```typescript
// tool-adapter.ts — comment confirms intent:
// "Tools are defined WITHOUT execute functions — execution happens client-side"
```

When `streamText` calls a tool with no `execute`, it emits the `tool-call` event and the stream ends (no next step can occur internally). By the time `ToolCallHandler` finishes and calls `addToolResult`, the stream is already closed.

`addToolResult` in `useZenithChat` only updates the UI message state (marks the part as `"output-available"`) — it does NOT re-trigger `runStream` with the tool results appended:
```typescript
const addToolResult = useCallback((result) => {
  setMessages(prev => prev.map(msg => {
    // ...marks part state to "output-available"
  }));
  // ← no runStream call here
}, []);
```

**Consequence**: The LLM calls a tool → the tool runs in the UI → the result is shown to the user — but the result is **never sent back to the LLM**. The assistant cannot continue after a tool call. All multi-step workflows (search → analyze → respond) are silently broken.

**Fix path**: `addToolResult` needs to check whether all tool calls in the last assistant message now have results, and if so, call `runStream` with the updated messages (which include the tool results converted to `tool-result` message parts for the model). Alternatively, tools could be given `execute` wrappers that call `handleAddResult` and return the result, allowing `streamText`'s built-in multi-step loop to proceed.

---

## § 7 — Error Propagation (`useZenithChat` → `chat.tsx` → UI)

**[INFO] Error propagation path is complete and correct**
Errors thrown inside `runStream` (including `AIService.getActiveModel()` throwing "No active model configured" or provider errors from `streamText`) are caught in the `catch` block, passed to `onError`, which calls `setErrorMessage` in `chat.tsx`. The error is rendered inline in the message list. ✅

`handleSendMessage` also performs a pre-flight check before calling `sendMessage`:
```typescript
if (!plugin.settings.activeModelConfigId) {
  new Notice("No model configured...", 5000);
  return;
}
```
This gives a `Notice` for the common case rather than waiting for the stream to throw. ✅

The `error` field returned from `useZenithChat` is also available but not separately consumed in `chat.tsx` — the `onError` callback is used instead to write to `errorMessage` state. This is consistent. ✅

---

## § 8 — Abort / Stop (`handleSendMessage` → `stop()`)

**[INFO] Stop wiring is correct**
```typescript
const handleSendMessage = async (e) => {
  if (status !== "ready") {
    stop();   // aborts the current AbortController
    return;
  }
  ...
```
Pressing the send button during streaming calls `stop()`, which calls `abortControllerRef.current?.abort()` in `useZenithChat`. The `AbortError` is caught in `runStream`'s catch block and treated as a non-error (user-initiated cancel). Status resets to `"ready"`. ✅

**[INFO] Submit button state uses `status` correctly**
`isGenerating = status === "streaming" || status === "submitted"` drives the submit button UI (shows stop icon during generation). The dual-use of the send button (send vs. stop) is wired correctly. ✅

---

## § 9 — Missing Wiring / Unconnected Phase Pieces

**[ERROR] (see §6)** — Tool result loop-back is built into Phase 2–3 (ToolCallHandler calls `addToolResult`) but the Phase 4 hook (`useZenithChat`) was never wired to resume the stream from tool results. This is the largest unconnected seam.

**[WARNING] `handleMessageRefresh` + `reload` has a stale-ref race**
In `chat.tsx`:
```typescript
const handleMessageRefresh = async (messageId: string) => {
  const trimmed = messages.slice(0, messageIndex);
  setMessages(trimmed);        // async state update — messagesRef not yet updated
  await reload({ context });   // reload reads messagesRef.current (stale!)
};
```
`useZenithChat`'s `reload` reads `messagesRef.current`, which is updated by a `useEffect` that runs after the render triggered by `setMessages`. Calling `reload` synchronously after `setMessages` means `reload` sees the old messages array, finds the last assistant message in the pre-trim history, removes it again, and calls `runStream` with a wrong (over-trimmed) message list. The fix is to pass the trimmed messages directly to `reload` rather than relying on the ref.

**[WARNING] Module-level `processedToolCallIds` Set in `ToolCallHandler` is never cleared**
```typescript
const processedToolCallIds = new Set<string>();  // module-level singleton
```
This Set persists for the entire plugin session. Tool call IDs that were processed once can never be reused. After a "New Chat" or session reload, if the AI SDK generates a tool call ID that collides with one from an earlier session (unlikely with UUIDs, but deterministic in tests/mocking), the tool call is silently dropped. More practically: this causes problems in development/testing when replaying conversations. It should be per-component-instance state (`useRef<Set<string>>`) rather than a module-level singleton.

---

## Top Issues — Prioritized

| Priority | Severity | Issue |
|----------|----------|-------|
| 1 | **ERROR** | **Tool result loop broken** (§6) — `addToolResult` never re-triggers the LLM stream. All multi-step tool use silently fails. |
| 2 | **ERROR** | **New models invisible to ModelSelector** (§4) — `plugin.settings.modelConfigs` mutations from ProvidersTab don't trigger re-renders in the chat sidebar. First-time users who add a model and immediately try to chat will see "No models configured". |
| 3 | **WARNING** | **`handleMessageRefresh` stale-ref race** (§9) — Refresh/reload picks up pre-trim messages from stale ref; message history fed to LLM on reload is wrong. |
| 4 | **WARNING** | **`processedToolCallIds` module-level Set** (§9) — Tool calls silently skipped in any scenario with ID reuse; never cleared across chat sessions. |
| 5 | **WARNING** | **`ModelSelector` direct settings mutation** (§3) — Component bypasses prop contract with direct `plugin.settings` writes; hidden dual-write path. |
| 6 | **WARNING** | **`activeModelConfigId` display state drifts** (§3) — ModelSelector shows stale selection after ProvidersTab changes active model while chat is open. |
| 7 | **WARNING** | **`onFinish` stale closure on tab switch** (§5) — Messages could be saved to wrong chat session if user switches tabs mid-stream. |
| 8 | **WARNING** | **`plugin.aiService` orphaned** (§2) — Created in `onload` but never consumed; misleads future developers. |
| 9 | **INFO** | **Double `saveSettings` on cold start** (§1) — Redundant I/O on every plugin load. |
| 10 | **INFO** | **Migration hardcodes `openai` provider** (§1) — Anthropic/compatible legacy keys will be mis-migrated. |
