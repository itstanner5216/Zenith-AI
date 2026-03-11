# Codex Task: Phase 0 Hardening

Branch from `phase0-complete`. All Phase 0 features are implemented. This task hardens them for production reliability. Make surgical, minimal edits only.

---

## Fix 1: Lazy schema init with retry (CRITICAL)

**File:** `Vertex_AI_Brain_2/gateway.py`

`init_pgvector_schema()` in lifespan can silently fail if pgvector is slow to start. Add lazy-init so vector endpoints retry on first use.

**Add** a module-level flag near the other pgvector globals (after `_pg_pool = None`):

```python
_pgvector_ready = False

async def ensure_pgvector_ready():
    global _pgvector_ready
    if not _pgvector_ready:
        await init_pgvector_schema()
        _pgvector_ready = True
```

**Modify** the lifespan startup's existing `init_pgvector_schema()` try/except to set the flag on success:

```python
    try:
        await init_pgvector_schema()
        _pgvector_ready = True
    except Exception as e:
        logger.warning(f"pgvector init deferred (will retry on first request): {e}")
```

**Add** `await ensure_pgvector_ready()` as the first line inside both `v1_vector_upsert()` and `v1_vector_search()` route handler functions, before `pool = await get_pg_pool()`.

---

## Fix 2: HNSW index instead of IVFFlat (CRITICAL)

**File:** `Vertex_AI_Brain_2/gateway.py`

IVFFlat with `lists=100` requires ~100 rows to work. HNSW works with any row count including zero.

In `init_pgvector_schema()`, change the index creation from:

```sql
CREATE INDEX IF NOT EXISTS vault_embeddings_embedding_idx
ON vault_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
```

To:

```sql
CREATE INDEX IF NOT EXISTS vault_embeddings_embedding_idx
ON vault_embeddings USING hnsw (embedding vector_cosine_ops)
```

Remove the `WITH (lists = 100)` clause entirely.

---

## Fix 3: Pool cleanup in lifespan shutdown (HIGH)

**File:** `Vertex_AI_Brain_2/gateway.py`

Verify the lifespan shutdown section (after `yield`) properly cleans up `_pg_pool`. It must include:

```python
    if _pg_pool:
        await _pg_pool.close()
        _pg_pool = None
```

The `global _pg_pool` declaration must be present at the top of the lifespan function. If cleanup is already present, leave it. If missing, add it after the other client `.close()` calls.

---

## Fix 4: Request timeouts in vertex-brain-client.ts (HIGH)

**File:** `packages/plugin/services/vertex-brain-client.ts`

Obsidian's `requestUrl` can hang indefinitely. Add a timeout wrapper.

**Add** this helper at the top of the file, after existing imports:

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}
```

**Wrap** every `requestUrl()` call in the file with `withTimeout()`:
- `5000` ms for `health()`
- `30000` ms for `embed`, `vectorUpsert`, `vectorSearch`, `rank`, `answer`

Example:
```typescript
// Before:
const resp = await requestUrl({ url: ... });
// After:
const resp = await withTimeout(requestUrl({ url: ... }), 30000);
```

Update `health()` to also catch timeout errors:
```typescript
async health(): Promise<boolean> {
    try {
      const resp = await withTimeout(requestUrl({ url: `${this.baseUrl}/health` }), 5000);
      return resp.json?.status !== "unhealthy";
    } catch {
      return false;
    }
  }
```

---

## Verification

1. `python -m py_compile Vertex_AI_Brain_2/gateway.py` — must exit 0
2. `grep -c "ensure_pgvector_ready" Vertex_AI_Brain_2/gateway.py` — ≥ 3
3. `grep "hnsw" Vertex_AI_Brain_2/gateway.py` — must have output
4. `grep "ivfflat" Vertex_AI_Brain_2/gateway.py` — must have NO output
5. `grep "withTimeout" packages/plugin/services/vertex-brain-client.ts` — must have output

Commit message: `fix: harden Phase 0 — lazy schema init, HNSW index, request timeouts, pool cleanup`
