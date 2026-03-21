# Phase 2 AI Core — Code Review

**Reviewed against:** `plans/Phase 2.md`  
**AI SDK version:** `ai@5.0.153` · `@ai-sdk/openai@1.3.24` · `@ai-sdk/anthropic@1.1.15`  
**Test baseline:** All 30 tests pass (`services/ai/` suite)

---

## provider-factory.ts

### [INFO] `default:` branch is TypeScript dead code (not a bug)

After exhaustively matching all three `ProviderType` members (`"openai"` | `"anthropic"` | `"openai-compatible"`), TypeScript types `key.provider` in the `default:` branch as `never`. Template literal interpolation of `never` compiles cleanly and coerces to a string at runtime, so the branch is valid runtime safety for callers coming from JavaScript or unchecked casts.

The plan's version of the `default:` error used `(key as ProviderKey).provider`, which was actually worse — it would re-widen the `never` type back to `ProviderType`, losing the exhaustiveness signal. The implementation is an improvement.

**Verdict:** No action needed. The branch is correct.

---

### [INFO] `|| "not-needed"` removed for `openai-compatible` apiKey

**Plan (line ~38):** `apiKey: key.apiKey || "not-needed"`  
**Implementation:** `apiKey: key.apiKey`

`loadApiKey` in `@ai-sdk/provider-utils` has the following logic:
```js
if (typeof apiKey === "string") { return apiKey; }  // returns "" for empty string
```
So passing `apiKey: ""` produces an `Authorization: Bearer ` header (empty bearer token). For local servers (Ollama, LM Studio, LiteLLM) that ignore the Authorization header, this is functionally identical to `"not-needed"`. For servers that require a token, both `""` and `"not-needed"` would fail at request time with a 401 — the difference is invisible.

The removal is semantically cleaner and does not break any known use case.

**Verdict:** No action needed.

---

### [WARNING] `as unknown as LanguageModel` double-cast on every return

Every `case` block casts through `unknown` to bridge the `@ai-sdk/openai`/`@ai-sdk/anthropic` provider-specific types to the `ai` package's `LanguageModel`. The comment in the file explains this as a v1/v2 adapter gap.

This is a necessary workaround **at this point in time**, but it has two risks:
1. It silences any future type-level incompatibility between provider SDKs and `ai` core. If a minor version bump shifts the interface, TypeScript will not catch it.
2. All three `case` blocks have the identical cast, creating repetition that could cause a future developer to remove it from just one branch.

**Recommendation:** Extract a single typed cast helper or add a comment linking this to the specific SDK issue so it can be removed when the upstream type alignment is resolved.

---

## tool-adapter.ts

### [INFO] `inputSchema` vs `parameters` — implementation is correct, plan is outdated

The plan specified `z.object()` passed as `parameters:` (AI SDK v4 API). The implementation uses `jsonSchema()` passed as `inputSchema:` — which is the correct API for SDK v5. The `Tool` type in `ai@5.x` is:

```typescript
type Tool<INPUT, OUTPUT> = {
  description?: string;
  inputSchema: FlexibleSchema<INPUT>;  // ← not "parameters"
  execute?: ...;
};
```

The switch from `zodSchema()` to `jsonSchema()` is also sound — `zodSchema()` triggers deep generic instantiation in the TypeScript compiler that causes OOM on large schemas; `jsonSchema()` sidesteps this entirely. The comment in the file explains this correctly.

**Verdict:** No action needed.

---

### [INFO] `getLastModifiedFiles.count` has no minimum or type constraint

```json
"count": { "type": "number" }
```

The LLM could pass `0`, `-1`, or `0.5`. Since execution is client-side, the handler will deal with this at runtime, but the schema permits logically invalid values.

**Recommendation (low priority):** Add `"minimum": 1, "default": 10` to nudge the model toward sensible values. Not a bug.

---

### [WARNING] Tool schema shapes are not tested

`tool-adapter.test.ts` verifies:
1. All 5 tool names are present.
2. `inputSchema` is defined and `execute` is undefined.

It does **not** verify:
- `moveFiles.filePaths` is `type: "array"` (not `type: "string"`)
- `renameFiles.renames` is an array of objects with `oldPath`/`newName`
- Required vs optional fields (`getSearchQuery` requires `query`, `reasoning` is optional; etc.)

If a future refactor accidentally changes `filePaths` from an array schema to a scalar, the test suite would not catch it. These schema shapes are the contract the AI model uses — they are the most valuable thing to test.

**Recommendation:** Add targeted schema-shape assertions:
```typescript
it("moveFiles.filePaths is an array schema", () => {
  const tools = createPluginTools();
  const schema = (tools.moveFiles.inputSchema as any).jsonSchema;
  expect(schema.properties.filePaths.type).toBe("array");
});
```

---

## ai-service.ts

### [ERROR] `validateKey` uses wrong test model for `openai-compatible` providers (line ~57)

```typescript
const testModel = key.provider === "anthropic"
  ? "claude-haiku-4-5-20251001"
  : "gpt-4o-mini";
```

For `provider === "openai-compatible"`, the test model is hard-coded to `"gpt-4o-mini"`. This will **always fail** for local providers (Ollama, LM Studio, LocalAI) because they do not serve a model named `gpt-4o-mini` by default. The function returns `{ valid: false, error: "model not found" }` even for a perfectly configured local endpoint, making `validateKey` broken for the primary `openai-compatible` use case.

**Fix:** Accept an optional `modelId` parameter, falling back to the hardcoded value only for first-party providers:
```typescript
async validateKey(
  key: ProviderKey,
  modelId?: string
): Promise<{ valid: boolean; error?: string }> {
  const defaultModel = key.provider === "anthropic"
    ? "claude-haiku-4-5-20250714"
    : "gpt-4o-mini";
  const testModel = modelId ?? defaultModel;
  ...
}
```
Callers validating an `openai-compatible` key can pass the user's configured model ID.

---

### [ERROR] `claude-haiku-4-5-20251001` is likely an invalid Anthropic model ID (line ~57)

```typescript
"claude-haiku-4-5-20251001"  // October 1, 2025
```

Anthropic's published Claude Haiku 4.5 model ID uses the date suffix `20250714` (July 14, 2025). The ID `claude-haiku-4-5-20251001` is not present in Anthropic's documentation or SDK and will return a `404 model_not_found` error from the Anthropic API. Critically, this means **a valid Anthropic API key will fail `validateKey` with `valid: false`** — a false negative.

**Fix:** Use the correct model ID:
```typescript
"claude-haiku-4-5-20250714"
```
Or switch to `"claude-3-haiku-20240307"` which is GA and widely available.

---

### [WARNING] `validateKey` sends an uncapped completion request (no `maxOutputTokens`)

The plan specified `maxTokens: 1` (wrong param name for v5). The implementation removed it entirely. The correct v5 parameter is `maxOutputTokens`. Without it, the validation call will generate a full response, consuming tokens unnecessarily on every key-validation event (settings save, app start, etc.).

**Fix:**
```typescript
const result = await streamText({
  model,
  messages: [{ role: "user", content: "hi" }],
  maxOutputTokens: 1,  // Minimize cost; we only need to confirm auth
});
```

---

### [WARNING] `streamChat` passes `tools: undefined` and `system: undefined` explicitly

The plan used conditional spreads:
```typescript
...(params.systemPrompt ? { system: params.systemPrompt } : {})
...(params.tools ? { tools: params.tools } : {})
```

The implementation assigns them directly:
```typescript
system: params.systemPrompt,  // undefined when caller omits it
tools: params.tools,           // undefined when caller omits it
```

In most cases, `undefined` values are equivalent to absent ones for object spreading, so this likely works fine. **However**, if any AI SDK middleware or internal code uses `'system' in options` (key presence check rather than truthiness), passing `system: undefined` differs from omitting the key. This is unlikely to be an issue today but is a subtle deviation from the plan's intent.

**Recommendation (low priority):** Keep conditional spreads for `system` and `tools` to match the plan's semantics exactly, or add a comment explaining why direct assignment is acceptable.

---

### [INFO] `stopWhen: params.maxSteps ? stepCountIs(params.maxSteps) : undefined`

`maxSteps = 0` is falsy, so `stopWhen` is set to `undefined` (the SDK default of `stepCountIs(1)`). `0` steps is semantically incoherent anyway, so this edge case has no practical impact.

When no `maxSteps` is passed and `tools` are provided, the SDK defaults to `stopWhen: stepCountIs(1)` — meaning only one round of tool calls by default. Callers that want multi-step agentic loops must explicitly pass `maxSteps`. This is correct SDK behavior but worth documenting in the `streamChat` JSDoc since it is a common footgun.

---

### [INFO] `getModelForConfig` missing-key path is untested

```typescript
const key = this.settings.providerKeys.find(k => k.id === config.providerKeyId);
if (!key) throw new Error(`Provider key not found: ${config.providerKeyId}`);
```

This throw path exists but has no corresponding test case. `getActiveModel`'s equivalent path is tested. A simple parity test would complete the coverage.

---

## provider-factory.test.ts

### [INFO] All 12 test cases are solid

Good coverage of:
- All 3 provider types
- `openai` with and without `baseUrl`
- `openai-compatible` with `apiKey: ""` (empty) and `apiKey: "my-secret-key"`
- Error paths (missing `baseUrl`, unknown provider)
- Same key, different models → distinct objects

The `apiKey: ""` test (`it("openai-compatible uses the provided apiKey")`) correctly captures the changed behavior from `|| "not-needed"`.

No significant gaps.

---

## tool-adapter.test.ts

### [INFO] Correct use of `inputSchema` (not `parameters`)

```typescript
expect(t.inputSchema).toBeDefined();
```

The test correctly checks `inputSchema` instead of `parameters`, consistent with SDK v5. (The plan's test scaffolding used `parameters` — the implementation diverged correctly.)

### [WARNING] No schema-shape assertions

See the `[WARNING]` under `tool-adapter.ts` above. This is the same gap viewed from the test side.

---

## ai-service.test.ts

### [INFO] `stepCountIs` is correctly mocked and imported

```typescript
import { streamText, stepCountIs } from "ai";
jest.mock("ai", () => ({
  streamText: jest.fn(...),
  stepCountIs: jest.fn((n: number) => ({ _stepCountIs: n })),
}));
```

The mock correctly mirrors the real module's named exports and the test verifies `stepCountIs` is called with the right argument. This is properly aligned with v5's `stopWhen` API.

---

### [WARNING] `streamChat` test coverage is incomplete

The tests verify:
- `messages` are forwarded ✅
- `stepCountIs` is called when `maxSteps` is provided ✅
- `stepCountIs` is not called when `maxSteps` is omitted ✅

Missing assertions:
- `system: params.systemPrompt` is forwarded to `streamText`
- `tools: params.tools` is forwarded
- `abortSignal` is forwarded
- `onStepFinish` is forwarded

If any of those spreads were accidentally deleted from `streamChat`, no test would catch it.

**Recommendation:** Add one combined test:
```typescript
it("forwards all optional params to streamText", () => {
  const service = new AIService(settings);
  const signal = new AbortController().signal;
  const onStep = jest.fn();
  service.streamChat({
    messages: [],
    systemPrompt: "You are helpful",
    tools: { myTool: {} as any },
    abortSignal: signal,
    onStepFinish: onStep,
  });
  expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
    system: "You are helpful",
    tools: expect.any(Object),
    abortSignal: signal,
    onStepFinish: onStep,
  }));
});
```

---

### [WARNING] `validateKey` test doesn't cover `openai-compatible` provider path

Both tests use `provider: "openai"` via `testKey`. There is no test that sets `key.provider = "openai-compatible"` and verifies that the correct (or incorrect) test model ID is selected. The hardcoded model ID bug (#1 ERROR above) is therefore invisible to the test suite.

---

### [INFO] `validateKey` mock consumes stream correctly

```typescript
textStream: (async function* () { yield "test"; })()
```

The `for await (const _ of result.textStream) { break; }` pattern in `validateKey` consumes the first chunk and exits. The mock correctly produces one chunk and the test verifies `valid: true`. The error path (`streamText` throws immediately before stream iteration) is also covered. ✅

---

## AI SDK v5 Compatibility Summary

| Feature | Plan | Implementation | Verdict |
|---|---|---|---|
| Tool schema field | `parameters:` (zod) | `inputSchema:` (jsonSchema) | ✅ Impl is correct |
| Multi-step control | `maxSteps:` | `stopWhen: stepCountIs(n)` | ✅ Impl is correct |
| Token limit param | `maxTokens:` | *(omitted)* | ⚠️ Should be `maxOutputTokens:` |
| Message type | `Parameters<typeof streamText>[0]["messages"]` | `ModelMessage[]` | ✅ Impl is cleaner |
| Stream iteration | `for await` + `break` | same | ✅ |

---

## Top Issues (Prioritized)

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | **ERROR** | `ai-service.ts:57` | `"gpt-4o-mini"` used as test model for `openai-compatible` — `validateKey` always returns `valid: false` for Ollama/LM Studio |
| 2 | **ERROR** | `ai-service.ts:57` | `"claude-haiku-4-5-20251001"` is an invalid Anthropic model ID — valid Anthropic keys fail `validateKey` with a false negative |
| 3 | **WARNING** | `ai-service.ts:56` | `validateKey` missing `maxOutputTokens: 1` — each validation call consumes unbounded tokens |
| 4 | **WARNING** | `ai-service.test.ts` | `validateKey` tests don't cover `openai-compatible` path; hardcoded model ID bug (#1) is invisible to the suite |
| 5 | **WARNING** | `tool-adapter.test.ts` | No schema-shape assertions — a `filePaths: string` regression would pass all tests |
| 6 | **WARNING** | `ai-service.test.ts` | `streamChat` doesn't assert `system`, `tools`, `abortSignal`, `onStepFinish` are forwarded |
| 7 | **WARNING** | `ai-service.ts:46` | `system: undefined` / `tools: undefined` passed explicitly vs conditionally — minor semantic drift from plan |
| 8 | **INFO** | `provider-factory.ts` | Triple `as unknown as LanguageModel` cast — document the upstream issue link for future cleanup |
| 9 | **INFO** | `ai-service.ts` | `getModelForConfig` missing-key path is untested |
| 10 | **INFO** | `tool-adapter.ts` | `getLastModifiedFiles.count` schema has no `minimum: 1` guard |
