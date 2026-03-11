# Codex Task: Implement Regression-Prevention Test Suite

Branch from `master`. This project has 26 existing tests but critical modules are untested. Two parallel implementation plans are about to modify the plugin and gateway heavily — these tests lock in current behavior so regressions are caught immediately.

**Do NOT modify any non-test source files.** Only create/modify test files, test config, mocks, and CI workflow.

---

## Scope

### Package 1: Plugin (`packages/plugin/`)

**Existing infrastructure:** Jest 29.7.0, ts-jest, `__mocks__/obsidian.ts`, `__mocks__/services/logger.ts`, `jest.config.ts` already configured. 4 existing tests.

**Existing mock pattern** (follow this exactly — see `apiUtils.test.ts`):
```typescript
// Mock dependencies FIRST, before imports
jest.mock('./services/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  Notice: jest.fn(),
}));
// Then import
import { MyThing } from './my-module';
```

---

#### Test File 1: `packages/plugin/services/vertex-brain-client.test.ts`

Test the `VertexBrainClient` class and `withTimeout` helper. This is the most critical file — it's the bridge between the plugin and the AI backend.

**Mock setup:**
```typescript
jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
}));
```

**Tests to write:**

**`withTimeout` (the helper function):**
- Returns the resolved value when the promise resolves before timeout
- Rejects with `"Request timed out"` when the promise takes longer than `ms`
- Does not swallow errors — if the inner promise rejects, that rejection propagates

**`constructor`:**
- Stores `baseUrl` as-is when no trailing slash
- Strips trailing slash from `baseUrl` (e.g., `"http://localhost:8085/"` → `"http://localhost:8085"`)

**`health()`:**
- Returns `true` when `requestUrl` resolves with status 200
- Returns `false` when `requestUrl` rejects (network error)
- Returns `false` when `requestUrl` resolves with non-200 status
- Uses 5000ms timeout (verify by making requestUrl hang and checking rejection message)
- Calls `GET {baseUrl}/health`

**`embed(text)`:**
- Sends POST to `{baseUrl}/v1/embed` with `{ text }` body
- Returns the `embedding` array from the response JSON
- Truncates text to 8000 characters before sending
- Uses 30000ms timeout
- Sends `Content-Type: application/json` header

**`vectorUpsert(params)`:**
- Sends POST to `{baseUrl}/v1/vector-upsert` with `{ id, content, folder_path, tags }` body
- Returns parsed JSON response
- Uses 30000ms timeout

**`vectorSearch(query, limit)`:**
- Sends POST to `{baseUrl}/v1/vector-search` with `{ query, limit }` body
- Returns the `results` array from response JSON
- Truncates query to 4000 characters
- Default limit is 20 when not specified

**`rank(query, records)`:**
- Sends POST to `{baseUrl}/v1/rank` with `{ query, records }` body
- Maps response: each record's `grounding_support` score → `{ title, score }` objects
- Falls back to `0` score when `grounding_support` is missing

**`answer(query, sessionId?)`:**
- Sends POST to `{baseUrl}/v1/answer` with `{ query, mode: "vault", session_id }` body
- Returns `{ answer, session_id, citations }` from response
- Omits `session_id` from request body when not provided

---

#### Test File 2: `packages/plugin/settings.test.ts`

Snapshot test that locks the `DEFAULT_SETTINGS` shape. If any plan accidentally changes a default value, this catches it.

**Tests to write:**
- `DEFAULT_SETTINGS` is an instance of `ZenithAISettings`
- `DEFAULT_SETTINGS` snapshot matches (use `toMatchSnapshot()` — Jest will auto-create the snapshot file)
- Key defaults are correct:
  - `vertexBrainUrl` === `"http://localhost:8085"`
  - `enableVectorAutoSort` === `true`
  - `autoSortConfidenceThreshold` === `0.75`
  - `API_KEY` === `""`
  - `pathToWatch` === `"_ZenithAI/Inbox"`
  - `defaultDestinationPath` === `"_ZenithAI/Processed"`
  - `backgroundScribeEnabled` === `false`
  - `pinnedTag` === `"pinned"`
  - `selectedModel` === `"gpt-4o-mini"`
  - `debugMode` === `false`

---

#### Test File 3: `packages/plugin/inbox/services/inbox-queue.test.ts`

Test the `Inbox` singleton and queue management. Create this file (the directory `inbox/services/` already exists).

**Mock setup:**
```typescript
jest.mock('../../services/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('obsidian');
```

You'll need to mock the `ZenithAI` plugin object. Create a minimal mock:
```typescript
const mockPlugin = {
  settings: { ...require('../../settings').DEFAULT_SETTINGS },
  app: {
    vault: {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read: jest.fn().mockResolvedValue(''),
      getAbstractFileByPath: jest.fn().mockReturnValue(null),
    },
    metadataCache: { getFileCache: jest.fn().mockReturnValue(null) },
  },
  shouldCreateMarkdownContainer: jest.fn().mockReturnValue(false),
} as any;
```

**Tests to write:**
- `Inbox.initialize(plugin)` returns an Inbox instance
- `Inbox.getInstance()` returns the same instance after initialize
- `Inbox.cleanup()` resets the instance (getInstance after cleanup should throw or return null)
- `getQueueStats()` returns `{ queueSize: 0, isProcessing: false }` on fresh inbox
- `getAllFiles()` returns empty array on fresh inbox
- `getAnalytics()` returns an object with expected shape (queue stats, processing status)
- `enqueueFile()` increases queue size by 1

**Note:** If the Inbox constructor has complex dependencies that make it hard to instantiate, test what you can and skip what requires full plugin initialization with `it.todo()`.

---

### Package 2: Gateway (`Zeniths-Vectors/`)

**Current state:** Zero tests. Python FastAPI app using pytest would be standard.

**Setup required:**
1. Create `Zeniths-Vectors/requirements-test.txt`:
   ```
   pytest>=8.0.0
   pytest-asyncio>=0.23.0
   httpx>=0.27.0
   ```
2. Create `Zeniths-Vectors/pytest.ini`:
   ```ini
   [pytest]
   asyncio_mode = auto
   testpaths = tests
   python_files = test_*.py
   python_functions = test_*
   ```
3. Create `Zeniths-Vectors/tests/` directory

---

#### Test File 4: `Zeniths-Vectors/tests/test_gateway_routes.py`

Use `httpx.ASGITransport` + `httpx.AsyncClient` to test the FastAPI app without a running server.

**Important:** The gateway requires environment variables and external services (Google Cloud, PostgreSQL). Mock these:

```python
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import os

# Set required env vars BEFORE importing the app
os.environ.setdefault("GOOGLE_PROJECT_ID", "test-project")
os.environ.setdefault("GOOGLE_PROJECT_NUMBER", "123456")
os.environ.setdefault("GOOGLE_DATASTORE_ID", "test-datastore")
os.environ.setdefault("GOOGLE_ENGINE_ID", "test-engine")
os.environ.setdefault("PGVECTOR_HOST", "localhost")
os.environ.setdefault("OBSIDIAN_REST_URL", "http://localhost:27123")
os.environ.setdefault("OBSIDIAN_API_KEY", "test-key")
```

**Tests to write:**

**Health endpoint:**
- `GET /health` returns 200 with `{"status": "ok", ...}`
- Response includes `version`, `obsidian_connected`, `pgvector_ready` fields

**Embed endpoint:**
- `POST /v1/embed` with `{"text": "hello"}` returns 200 with `{"embedding": [...]}`
- Mock the `VertexSearchClient.embed()` to return a fixed vector
- Returns 400 or error when text is empty

**Vector upsert endpoint:**
- `POST /v1/vector-upsert` with valid body returns 200 with `{"indexed": true}`
- Mock the pgvector pool to capture the SQL query
- Verify the embedding is generated before upserting

**Vector search endpoint:**
- `POST /v1/vector-search` with `{"query": "test", "limit": 5}` returns results
- Mock both embed (for query vectorization) and pgvector pool (for search)
- Default limit is 20 when not specified

**Rank endpoint:**
- `POST /v1/rank` with query and records returns scored results
- Mock `VertexSearchClient.semantic_rank()`

**Answer endpoint:**
- `POST /v1/answer` with `{"query": "test", "mode": "vault"}` returns answer
- Mock `VertexSearchClient.conversational_answer()`

**Important:** If importing the FastAPI `app` object fails due to missing dependencies at import time (e.g., Google Cloud libs), use `importlib` with mocks:
```python
@pytest.fixture
def app():
    with patch.dict(os.environ, {...}):
        with patch('gateway.AuthManager'), patch('gateway.get_pg_pool'):
            import importlib
            import gateway
            importlib.reload(gateway)
            return gateway.app
```

If the gateway is too tightly coupled to external services for unit testing, create **contract tests** instead that validate request/response schemas using Pydantic models directly (import the model classes and test `.model_validate()` with valid and invalid data).

---

#### Test File 5: `Zeniths-Vectors/tests/test_models.py`

Test the Pydantic request/response models in isolation (no mocking needed):

**Tests to write:**
- `SearchRequest` validates with required fields (`query`)
- `SearchRequest` rejects missing `query`
- `EmbedRequest` validates with `text` field
- `VectorUpsertRequest` validates with `id`, `content`, `folder_path`, `tags`
- `VectorSearchRequest` validates with `query` and optional `limit` (default 20)
- `RankRequest` validates with `query` and `records`
- `AnswerRequest` validates with `query` and `mode`
- `HealthResponse` includes `status`, `version`, `obsidian_connected`, `pgvector_ready`

---

### Package 3: CI/CD Integration

#### Modify: `.github/workflows/build.yml`

Add a test step that runs **before** the build step. Tests should NOT block the build if gateway tests fail (gateway needs Python + postgres), but plugin/web tests should be required.

Find the existing build step and add a test step before it:

```yaml
    - name: Run tests
      run: pnpm test
      continue-on-error: false
```

This runs `turbo test` (already configured in root `package.json` and `turbo.json`) which executes `jest` in both `packages/plugin` and `packages/web`.

**Do NOT add Python/gateway tests to CI** — they need a PostgreSQL service container and Google Cloud mocks that are out of scope. The gateway tests are for local development regression checking.

---

## Verification

After all changes:

1. `cd packages/plugin && npx jest --verbose 2>&1 | tail -30` — all tests pass
2. `cd packages/web && npx jest --verbose 2>&1 | tail -30` — all existing + any new tests pass
3. `cd Zeniths-Vectors && python -m pytest tests/ -v 2>&1 | tail -30` — gateway tests pass (or skip gracefully if deps missing)
4. Verify no source files were modified: `git diff --name-only HEAD | grep -v -E '(\.test\.|jest\.|__mocks__|__snapshots__|pytest|requirements-test|\.github/workflows|tests/test_)'` should show nothing

## Line count expectations

- `vertex-brain-client.test.ts`: ~200-300 lines (most critical, most tests)
- `settings.test.ts`: ~60-80 lines (snapshot + key defaults)
- `inbox-queue.test.ts`: ~100-150 lines (or shorter with `.todo()` stubs)
- `test_gateway_routes.py`: ~150-250 lines (or contract tests if mocking is too complex)
- `test_models.py`: ~80-120 lines (pure Pydantic validation)
- `build.yml` change: ~3-5 lines added

Commit message: `test: add regression-prevention test suite for plugin services, gateway, and CI integration`
