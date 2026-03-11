# Vertex AI Brain 2 — Production Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 2 remaining gaps in Vertex_AI_Brain_2 before Note Companion integration begins.

**Architecture:** Brain 2 (version 3.1.0) is the production target. It already has: groundingMetadata fix, async credential refresh, correct port defaults (Redis 6381, OpenWebUI 3001), and fastapi-mcp mounted at `/mcp`. Only CORS and correlation ID remain.

**Note:** `/v1/embed`, `/v1/vector-upsert`, `/v1/vector-search`, and pgvector are NOT in this plan — those are new features that belong in the Note Companion integration plan (Phase 1).

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2

**Hard Constraints:**
- NEVER hardcode model names — always `os.environ.get("VAR", "default")`
- NEVER hardcode generation params (temperature, top_k, top_p, max_tokens)

**Work directory:** `/home/tanner/Projects/Vertex_AI_Brain_2/`

---

### Task 1: Make CORS origins env-configurable

**Files:**
- Modify: `gateway.py`
- Modify: `docker-compose.yml`

**Step 1: Find the CORS config block in gateway.py**

```bash
grep -n "CORS_ORIGINS\|allow_origins\|CORSMiddleware" gateway.py
```

**Step 2: Add CORS_ORIGINS env var to the service config block**

Find the service configuration constants (near `SERVICE_PORT`, `REQUEST_TIMEOUT`, etc.). Add:

```python
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")]
```

**Step 3: Replace hardcoded allow_origins**

Replace:
```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
```
with:
```python
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
```

**Step 4: Add CORS_ORIGINS to docker-compose.yml gateway environment**

Find the gateway service environment block. Add:
```yaml
      - CORS_ORIGINS=${CORS_ORIGINS:-*}
```

**Step 5: Verify syntax**

```bash
python -m py_compile gateway.py && echo "OK"
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" && echo "YAML OK"
```
Expected: `OK` and `YAML OK`

**Step 6: Commit**

```bash
git add gateway.py docker-compose.yml
git commit -m "feat: make CORS origins configurable via CORS_ORIGINS env var"
```

---

### Task 2: Add X-Request-ID correlation middleware

**Files:**
- Modify: `gateway.py`

**Step 1: Check uuid import**

```bash
grep -n "^import uuid" gateway.py
```
If not present, add `import uuid` to the imports block at the top.

**Step 2: Add middleware after CORS middleware**

After the `app.add_middleware(CORSMiddleware, ...)` line, add:

```python
from starlette.middleware.base import BaseHTTPMiddleware

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(CorrelationIDMiddleware)
```

**Step 3: Verify syntax**

```bash
python -m py_compile gateway.py && echo "OK"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add gateway.py
git commit -m "feat: add X-Request-ID correlation middleware for distributed tracing"
```

---

## Verification

```bash
cd /home/tanner/Projects/Vertex_AI_Brain_2

python -m py_compile gateway.py && echo "COMPILE OK"
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" && echo "YAML OK"
python -c "
src = open('gateway.py').read()
assert 'CORS_ORIGINS' in src and 'os.environ' in src, 'CORS not env-driven'
assert 'CorrelationIDMiddleware' in src, 'Correlation ID missing'
print('All checks passed')
"
```
