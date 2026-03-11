# Phase 0: Backend + Shared Foundation (Sequential Pre-Step)

# Files created/modified:
#   Vertex_AI_Brain_2/docker-compose.yml
#   Vertex_AI_Brain_2/requirements.txt
#   Vertex_AI_Brain_2/gateway.py
#   /home/tanner/litellm-deployment/litellm-config.yaml
#   packages/plugin/services/vertex-brain-client.ts
#   packages/plugin/settings.ts
#
# Run this FIRST. Merge to base branch before starting Plan A and Plan B.

# **Vault Intelligence — Implementation Plan**

**Goal:** Integrate pgvector embeddings + Vertex AI ranker into Note Companion for project-aware auto-sorting, with the model shifting from routing to generation and user dialogue.

**Architecture:** pgvector in Vertex Brain Docker → new gateway embedding endpoints → TypeScript VertexBrainClient in plugin → pipeline overhaul → LiteLLM MCP bridge. See `docs/2026-03-08-vault-intelligence-design.md` for full design.

**Tech Stack:** Python/FastAPI (Vertex Brain extensions), TypeScript/React (plugin), asyncpg, pgvector, Vertex AI text-embedding-004, PostgreSQL 16

**Hard Constraints (never violate):**

- NEVER hardcode model names — always `os.environ.get("VAR", "default")`
- Do NOT hardcode generation params (temperature, top_k, top_p, max_tokens, candidateCount) — none belong here
- Brain URL always comes from plugin settings, never hardcoded
- All thresholds user-configurable via settings
- Graceful fallback if Brain unavailable — existing model pipeline must continue to work

**Assumption:** Vertex Brain 2 production fixes (`docs/plans/2026-03-08-production-fixes.md` in Vertex_AI_Brain_2) are complete and the gateway is running at [http://localhost:8085](http://localhost:8085/). All work targets `/home/tanner/Projects/Vertex_AI_Brain_2/` — NOT Vertex_AI_Brain (the older v3.0.0 origin).

---

---

## **Phase 1: pgvector Integration and Embedding Endpoints**

**Work directory:** `/home/tanner/Projects/Vertex_AI_Brain_2/`


### **Task 1: Add pgvector service to docker-compose.yml**

**Files:**

- Modify: `docker-compose.yml`
- Modify: `requirements.txt`

**Step 1: Add pgvector service to docker-compose.yml**

Add after the redis service block (before `gateway:`):

```yaml
  pgvector:
    image: pgvector/pgvector:pg16
    container_name: vertex-pgvector
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${PGVECTOR_DB:-vault_embeddings}
      - POSTGRES_USER=${PGVECTOR_USER:-vault}
      - POSTGRES_PASSWORD=${PGVECTOR_PASSWORD:-vault-secure-pass}
    ports:
      - "${PGVECTOR_PORT:-5433}:5432"
    volumes:
      - pgvector-data:/var/lib/postgresql/data
    networks:
      - api-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PGVECTOR_USER:-vault} -d ${PGVECTOR_DB:-vault_embeddings}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

Add `pgvector-data:` under the `volumes:` section alongside `redis-data:` and `openwebui-data:`.

Add gateway dependency on pgvector in the gateway service `depends_on` (or add it if not present):

```yaml
    depends_on:
      pgvector:
        condition: service_healthy
```

Add pgvector env vars to the gateway service environment block:

```yaml
      # pgvector
      - PGVECTOR_HOST=${PGVECTOR_HOST:-pgvector}
      - PGVECTOR_PORT_INTERNAL=${PGVECTOR_PORT_INTERNAL:-5432}
      - PGVECTOR_DB=${PGVECTOR_DB:-vault_embeddings}
      - PGVECTOR_USER=${PGVECTOR_USER:-vault}
      - PGVECTOR_PASSWORD=${PGVECTOR_PASSWORD:-vault-secure-pass}
      # Embedding config
      - VERTEX_EMBEDDING_MODEL=${VERTEX_EMBEDDING_MODEL:-text-embedding-004}
      - VERTEX_EMBEDDING_DIMENSIONS=${VERTEX_EMBEDDING_DIMENSIONS:-768}
      - VERTEX_EMBEDDING_LOCATION=${VERTEX_EMBEDDING_LOCATION:-us-central1}
```

**Step 2: Add asyncpg to requirements.txt**

Add after `redis==5.2.1`:

```txt
# PostgreSQL async client for pgvector
asyncpg==0.30.0
```

**Step 3: Verify YAML**

```bash
cd /home/tanner/Projects/Vertex_AI_Brain_2/
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" && echo "YAML OK"
```

**Expected:** `YAML OK`

**Step 4: Commit**

```bash
git add docker-compose.yml requirements.txt
git commit -m "feat: add pgvector service and asyncpg dependency for vault embeddings"
```

---

### **Task 2: Add pgvector connection and schema init to gateway.py**

**Files:** Modify: `gateway.py`

**Step 1: Add env config constants after existing config block (after line ~75)**

```python
# =============================================================================
# PGVECTOR CONFIGURATION
# =============================================================================

PGVECTOR_HOST = os.environ.get("PGVECTOR_HOST", "pgvector")
PGVECTOR_PORT_INTERNAL = int(os.environ.get("PGVECTOR_PORT_INTERNAL", "5432"))
PGVECTOR_DB = os.environ.get("PGVECTOR_DB", "vault_embeddings")
PGVECTOR_USER = os.environ.get("PGVECTOR_USER", "vault")
PGVECTOR_PASSWORD = os.environ.get("PGVECTOR_PASSWORD", "vault-secure-pass")
VERTEX_EMBEDDING_MODEL = os.environ.get("VERTEX_EMBEDDING_MODEL", "text-embedding-004")
VERTEX_EMBEDDING_DIMENSIONS = int(os.environ.get("VERTEX_EMBEDDING_DIMENSIONS", "768"))
VERTEX_EMBEDDING_LOCATION = os.environ.get("VERTEX_EMBEDDING_LOCATION", "us-central1")
```

**Step 2: Add pgvector connection pool and init function**

Add after the `auth_manager = AuthManager()` line:

```python
# =============================================================================
# PGVECTOR CONNECTION POOL
# =============================================================================

_pg_pool = None

async def get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
        import asyncpg
        _pg_pool = await asyncpg.create_pool(
            host=PGVECTOR_HOST,
            port=PGVECTOR_PORT_INTERNAL,
            database=PGVECTOR_DB,
            user=PGVECTOR_USER,
            password=PGVECTOR_PASSWORD,
            min_size=2,
            max_size=10,
        )
    return _pg_pool

async def init_pgvector_schema():
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS vault_embeddings (
                id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL,
                embedding vector({VERTEX_EMBEDDING_DIMENSIONS}),
                folder_path TEXT DEFAULT '',
                tags TEXT[] DEFAULT '{{}}',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute(f"""
            CREATE INDEX IF NOT EXISTS vault_embeddings_embedding_idx
            ON vault_embeddings USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        """)
    logger.info("pgvector schema initialized")
```

**Step 3: Call init_pgvector_schema in lifespan**

Find the lifespan async context manager in `gateway.py`. Inside the startup section (before `yield`), add:

```python
    try:
        await init_pgvector_schema()
    except Exception as e:
        logger.warning(f"pgvector init failed (non-fatal): {e}")
```

**Step 4: Verify syntax**

```bash
python -m py_compile gateway.py && echo "OK"
```

**Expected:** `OK`

**Step 5: Commit**

```bash
git add gateway.py
git commit -m "feat: add pgvector connection pool and schema init to gateway"
```

---

### **Task 3: Add /v1/embed endpoint to gateway.py**

**Files:** Modify: `gateway.py`

**Step 1: Add EmbedRequest and EmbedResponse Pydantic models**

Add after the existing request model definitions (near SearchRequest, AnswerRequest etc.):

```python
class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)
    task_type: str = Field(default="RETRIEVAL_DOCUMENT")

class EmbedResponse(BaseModel):
    embedding: List[float]
    token_count: int
```

**Step 2: Add embed helper method to VertexSearchClient**

Find the VertexSearchClient class. Add this method to it:

```python
    async def embed(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> dict:
        token = await auth_manager.get_access_token()
        url = (
            f"https://{VERTEX_EMBEDDING_LOCATION}-aiplatform.googleapis.com/v1"
            f"/projects/{GOOGLE_PROJECT_NUMBER}/locations/{VERTEX_EMBEDDING_LOCATION}"
            f"/publishers/google/models/{VERTEX_EMBEDDING_MODEL}:predict"
        )
        payload = {"instances": [{"content": text, "task_type": task_type}]}
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = await self._client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        values = data["predictions"][0]["embeddings"]["values"]
        token_count = data["predictions"][0]["embeddings"].get("statistics", {}).get("token_count", 0)
        return {"embedding": values, "token_count": token_count}
```

**Step 3: Add /v1/embed route**

Add near the other `/v1/` routes:

```python
@app.post("/v1/embed")
async def v1_embed(req: EmbedRequest):
    try:
        client = _req_vertex()
        result = await client.embed(req.text, req.task_type)
        return {"success": True, "embedding": result["embedding"], "token_count": result["token_count"]}
    except Exception as e:
        logger.error(f"Embed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 4: Verify syntax and run**

```bash
python -m py_compile gateway.py && echo "OK"
```

**Expected:** `OK`

**Step 5: Commit**

```bash
git add gateway.py
git commit -m "feat: add POST /v1/embed endpoint for Vertex AI text embeddings"
```

---

### **Task 4: Add /v1/vector-upsert and /v1/vector-search endpoints**

**Files:** Modify: `gateway.py`

**Step 1: Add request/response models**

```python
class VectorUpsertRequest(BaseModel):
    id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    folder_path: str = Field(default="")
    tags: List[str] = Field(default_factory=list)

class VectorSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=100)

class VectorSearchResult(BaseModel):
    id: str
    folder_path: str
    tags: List[str]
    similarity: float
```

**Step 2: Add /v1/vector-upsert route**

```python
@app.post("/v1/vector-upsert")
async def v1_vector_upsert(req: VectorUpsertRequest):
    import hashlib
    content_hash = hashlib.sha256(req.content.encode()).hexdigest()
    try:
        client = _req_vertex()
        pool = await get_pg_pool()
        # Check if already indexed with same content
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT content_hash FROM vault_embeddings WHERE id = $1", req.id
            )
            if existing and existing["content_hash"] == content_hash:
                return {"success": True, "indexed": False, "reason": "unchanged"}
        # Generate embedding
        result = await client.embed(req.content[:8000], "RETRIEVAL_DOCUMENT")
        embedding = result["embedding"]
        # Upsert
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO vault_embeddings (id, content_hash, embedding, folder_path, tags, updated_at)
                VALUES ($1, $2, $3::vector, $4, $5, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    content_hash = EXCLUDED.content_hash,
                    embedding = EXCLUDED.embedding,
                    folder_path = EXCLUDED.folder_path,
                    tags = EXCLUDED.tags,
                    updated_at = NOW()
            """, req.id, content_hash, str(embedding), req.folder_path, req.tags)
        return {"success": True, "indexed": True}
    except Exception as e:
        logger.error(f"Vector upsert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 3: Add /v1/vector-search route**

```python
@app.post("/v1/vector-search")
async def v1_vector_search(req: VectorSearchRequest):
    try:
        client = _req_vertex()
        pool = await get_pg_pool()
        # Embed the query
        result = await client.embed(req.query[:4000], "RETRIEVAL_QUERY")
        embedding = result["embedding"]
        # Search pgvector
        async with pool.acquire() as conn:
            rows = await conn.fetch(f"""
                SELECT id, folder_path, tags,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM vault_embeddings
                ORDER BY embedding <=> $1::vector
                LIMIT $2
            """, str(embedding), req.limit)
        results = [
            {"id": r["id"], "folder_path": r["folder_path"],
             "tags": list(r["tags"] or []), "similarity": float(r["similarity"])}
            for r in rows
        ]
        return {"success": True, "results": results}
    except Exception as e:
        logger.error(f"Vector search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 4: Verify syntax**

```bash
python -m py_compile gateway.py && echo "OK"
```

**Expected:** `OK`

**Step 5: Test pgvector schema creates cleanly (with docker running)**

```bash
docker compose up pgvector -d
sleep 5
docker compose up gateway -d
curl -s http://localhost:8085/health | python -m json.tool | grep -E '"status"|"pgvector"'
```

**Expected:** `"status": "healthy"` (pgvector degraded is OK if vertex isn't configured yet)

**Step 6: Commit**

```bash
git add gateway.py
git commit -m "feat: add POST /v1/vector-upsert and /v1/vector-search endpoints"
```

---

### **Task 5: Add vault-search MCP to LiteLLM config**

**Files:** Modify: `/home/tanner/litellm-deployment/litellm-config.yaml` **Work directory:** `/home/tanner/litellm-deployment/`

**Step 1: Check LiteLLM MCP config format**

```bash
cd /home/tanner/litellm-deployment
docker exec litellm litellm --version 2>/dev/null || grep "litellm" docker-compose.yml | head -3
```

**Step 2: Add MCP server config**

In `litellm-config.yaml`, add at the top level (alongside general_settings, model_list, etc.):

```yaml
mcp_servers:
  - server_name: "vault-search"
    server_url: "http://host.docker.internal:8085/mcp"
```

**Step 3: Restart LiteLLM**

```bash
docker compose restart litellm
sleep 5
curl -s http://localhost:4000/health | python -m json.tool | grep status
```

**Expected:** status healthy

**Step 4: Verify MCP tools visible (if LiteLLM exposes them)**

```bash
curl -s -H "Authorization: Bearer $(grep LITELLM_MASTER_KEY litellm-config.yaml | head -1 | awk -F: '{print $2}' | tr -d ' \"')" \
  http://localhost:4000/mcp/tools 2>/dev/null | python -m json.tool | head -30
```

**Step 5: Commit**

```bash
cd /home/tanner/litellm-deployment
git add litellm-config.yaml
git commit -m "feat: add vault-search MCP server to LiteLLM config"
```

## **Phase 2: Plugin Infrastructure**

**Work directory:** `/home/tanner/Projects/.note-companion/packages/plugin`


### **Task 7: Create VertexBrainClient service**

**Files:** Create: `packages/plugin/services/vertex-brain-client.ts`

**Step 1: Create services directory if needed**

```bash
mkdir -p packages/plugin/services
```

**Step 2: Create vertex-brain-client.ts**

```typescript
import { requestUrl } from "obsidian";

export interface VaultSearchResult {
  id: string;
  folder_path: string;
  tags: string[];
  similarity: number;
}

export interface RankRecord {
  id: string;
  title: string;
  content: string;
}

export class VertexBrainClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async health(): Promise<boolean> {
    try {
      const resp = await requestUrl({ url: `${this.baseUrl}/health` });
      return resp.json?.status !== "unhealthy";
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const resp = await requestUrl({
      url: `${this.baseUrl}/v1/embed`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 8000) }),
    });
    return resp.json.embedding;
  }

  async vectorUpsert(params: {
    id: string;
    content: string;
    folder_path: string;
    tags: string[];
  }): Promise<{ indexed: boolean }> {
    const resp = await requestUrl({
      url: `${this.baseUrl}/v1/vector-upsert`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return resp.json;
  }

  async vectorSearch(
    query: string,
    limit = 20
  ): Promise<VaultSearchResult[]> {
    const resp = await requestUrl({
      url: `${this.baseUrl}/v1/vector-search`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.slice(0, 4000), limit }),
    });
    return resp.json.results ?? [];
  }

  async rank(
    query: string,
    records: RankRecord[]
  ): Promise<Array<{ title: string; score: number }>> {
    const resp = await requestUrl({
      url: `${this.baseUrl}/v1/rank`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, records }),
    });
    return (resp.json.grounding_support ?? []).map((s: any) => ({
      title: s.segment,
      score: s.score,
    }));
  }

  async answer(
    query: string,
    sessionId?: string
  ): Promise<{ answer: string; session_id?: string; citations: any[] }> {
    const resp = await requestUrl({
      url: `${this.baseUrl}/v1/answer`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, session_id: sessionId, mode: "vault" }),
    });
    return resp.json;
  }
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd /home/tanner/Projects/.note-companion
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20
```

**Expected:** no errors

**Step 4: Commit**

```bash
git add packages/plugin/services/vertex-brain-client.ts
git commit -m "feat: add VertexBrainClient TypeScript service"
```

---

---


---

## **Phase 2: Plugin Infrastructure**

**Work directory:** `/home/tanner/Projects/.note-companion/packages/plugin`


### **Task 6: Add Vault Intelligence settings**

**Files:**

- Modify: `settings.ts`
- Modify: `views/assistant/customization-tab.tsx` (or wherever the settings UI lives)

**Step 1: Add settings to FileOrganizerSettings class (settings.ts)**

After line 65 (`screenpipeTimeRange = 4;`), before closing `}`:

```typescript
  // Vault Intelligence (Vertex Brain integration)
  vertexBrainUrl = "http://localhost:8085";
  enableVectorAutoSort = true;
  autoSortConfidenceThreshold = 0.75;
  organizationRulesPath = "System/Cosmic Vault Structure.md";
  generalMergeThreshold = 0.50;  // General directory → Project threshold
  globalMergeThreshold = 0.70;   // Non-General → Project threshold
  pinnedTag = "pinned";          // Tag that locks files from auto-sort
  projectsPath = "Projects";     // Root signal directory
  autoDetectProjectContext = true;
  backgroundScribeEnabled = false;
  backgroundScribeOutputFile = "TODO.md";
```

**Step 2: Verify TypeScript compiles**

```bash
cd /home/tanner/Projects/.note-companion
npx tsc --noEmit -p packages/plugin/tsconfig.json 2>&1 | head -20
```

**Expected:** no errors on settings.ts

**Step 3: Commit**

```bash
git add packages/plugin/settings.ts
git commit -m "feat: add Vault Intelligence settings (vertexBrainUrl, autoSortConfidenceThreshold, etc.)"
```

---

