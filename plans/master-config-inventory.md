# Master Configuration Inventory

> Generated from 5-agent audit across all packages, plans, and pipeline.
> Source of truth for all configuration options before implementation begins.

---

## Critical Bugs to Fix First

These block building or cause runtime failures. Fix before anything else.

| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | **Build broken** — `autoprefixer` missing hacks module | `postcss.config.js` | Downgrade: `autoprefixer@10.4.14` |
| 2 | **`offref` doesn't exist** — 5x memory leaks, event listeners never removed | `chat.tsx:97`, `use-editor-selection.ts` (3x), `hooks/use-current-file.ts:98`, `shared/markdown-renderer.tsx` | Replace `app.workspace.offref(ref)` → `app.workspace.off(ref)` |
| 3 | **Duplicate pgvector schema** — two conflicting `vault_embeddings` table definitions (768-dim vs 1536-dim) | `gateway.py` lines 315 vs 898–917 | Delete lines 875–917 (second definition) |
| 4 | **PGVECTOR env vars missing from .env.example** — DB credentials not documented | `Zeniths-Vectors/.env.example` | Add all 6 PGVECTOR_* vars (see Gateway section below) |

---

## Plugin Settings — Current State

**File:** `packages/plugin/settings.ts`

| Field | Type | Default | Used Where | UI Exposed |
|-------|------|---------|-----------|------------|
| `API_KEY` | string | `""` | Auth header on all requests | ✅ General Tab |
| `selfHostingURL` | string | `"http://localhost:3010"` | Base URL for backend calls | ✅ Advanced Tab |
| `selectedModel` | string | `""` | Model name sent to backend | ✅ Model selector in chat |
| `customModelName` | string | `""` | **Dead — only written, never read** | ❌ |
| `debugMode` | boolean | `false` | Logging verbosity | ✅ Advanced Tab |

**Dead setting to remove:** `customModelName` — mirrors `selectedModel`, never read anywhere.

---

## Plugin Settings — Required Additions

All new settings from the three feature plans + hardcoded values that should be settings:

### Background Scribe
| Field | Type | Default | UI/JSON | Notes |
|-------|------|---------|---------|-------|
| `scribeOutputPath` | string | `"TODO.md"` | UI (Advanced) | Where plan writer outputs |
| `scribeExtractionInterval` | number | `10` | JSON-only | Turns between rolling extraction calls |
| `scribeExtractionModel` | string | `""` | UI | Small/fast model for decision extraction |
| `scribeEmbeddingsModel` | string | `""` | UI | Model for `searchLogs` semantic search |

### Cosmic Context
| Field | Type | Default | UI/JSON | Notes |
|-------|------|---------|---------|-------|
| `cosmicContextThreshold` | number | unset | UI (Advanced) | Similarity threshold; if unset blocks tab with prompt |
| `cosmicContextTurnFrequency` | number | `2` | JSON-only | Turns between vault search queries |

### Hardcoded values to promote to settings
| Field | Type | Current Hardcoded Value | File | Notes |
|-------|------|------------------------|------|-------|
| `chatExportFolder` | string | `"Chat exports"` | `export-chat-as-markdown.ts:8` | Export destination |
| `chatHistoryPath` | string | `"_NoteCompanion/.chat-history.json"` | `chat-history-manager.ts:31` | Legacy NoteCompanion branding — rename |
| `projectsFolderName` | string | `"Projects"` | `background-scribe.ts:116` | Scribe project scope detection |
| `maxContextSize` | number | `80000` | `chat.tsx:1299` | Context window limit |
| `toolResultMaxChars` | number | `200` | `export-chat-as-markdown.ts:9` | Tool result truncation |

### Items to delete outright (vestigial)
| Item | File | Reason |
|------|------|--------|
| `constants.ts` | `packages/plugin/constants.ts` | Contains `FREE_TIER_TOKEN_LIMIT = 100000` — legacy free tier logic, no longer relevant |
| `customModelName` setting | `settings.ts` | Dead code, mirrors `selectedModel` |

---

## Web Package — Environment Variables

**File:** `packages/web/.env.example`

### Currently documented
| Var | Default | Purpose |
|-----|---------|---------|
| `OPENAI_API_KEY` | `sk-xxxx` | OpenAI auth |
| `OPENAI_API_BASE` | `""` | Custom OpenAI-compatible endpoint |
| `GROQ_API_KEY` | `gsk-xxxx` | Groq auth |
| `ANTHROPIC_API_KEY` | `sk-xxxx` | Anthropic auth |
| `GOOGLE_API_KEY` | `sk-xxxx` | Google/Gemini auth |
| `DEEPSEEK_API_KEY` | `sk-xxxx` | DeepSeek auth |
| `MISTRAL_API_KEY` | `sk-xxxx` | Mistral auth |
| `MODEL_PROVIDER` | `openai` | Provider selection |
| `MODEL_NAME` | *(required)* | Model name — throws if missing |
| `VISION_MODEL_NAME` | defaults to MODEL_NAME | Vision/OCR model |
| `SOLO_API_KEY` | `""` | Auth key for self-hosted (optional) |
| `POSTGRES_URL` | `""` | DB connection string |
| `UPLOAD_DIR` | `./uploads` | File upload path |

### Missing — must add
| Var | Default | Purpose | Required By |
|-----|---------|---------|-------------|
| `ZENITH_GATEWAY_URL` | `""` | Zeniths-Vectors gateway base URL | Cosmic Context, Vault Auto-Sort |
| `RESPONSES_MODEL_NAME` | defaults to MODEL_NAME | OpenAI Responses API model | Web search feature |
| `PORT` | `3000` | Server port | Documentation only |

### Hardcoded security issues to address
| Issue | File | Current Value | Fix |
|-------|------|--------------|-----|
| CORS wildcard | `middleware.ts:27,42`, `next.config.js:16` | `*` | Add `CORS_ORIGIN` env var |
| No request timeout | `streamText()` | none | Add `REQUEST_TIMEOUT_MS` (suggest `30000`) |

---

## Zeniths-Vectors Gateway — Environment Variables

**File:** `Zeniths-Vectors/.env.example`

### Currently documented (partial list — key ones)
| Var | Default | Purpose |
|-----|---------|---------|
| `GOOGLE_PROJECT_ID` | `your-project-id` | GCP project for Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | path | Service account JSON path |
| `VERTEX_EMBEDDING_MODEL` | `text-embedding-004` | Embedding model |
| `VERTEX_EMBEDDING_DIMENSIONS` | `768` | Embedding vector dimensions |
| `VERTEX_EMBEDDING_LOCATION` | `us-central1` | Vertex API region |
| `OBSIDIAN_API_URL` | `http://host.docker.internal:27124` | Obsidian Local REST API |
| `OBSIDIAN_API_KEY` | `""` | Obsidian REST API key |
| `GATEWAY_URL` | `http://gateway:8085` | Self-reference (used by OpenWebUI filter) |
| `SERVICE_PORT` | `8085` | Gateway port |
| `REDIS_URL` | `redis://redis:6379` | Redis session storage |

### Missing from .env.example — must add
| Var | Default | Purpose |
|-----|---------|---------|
| `PGVECTOR_HOST` | `pgvector` | PostgreSQL host |
| `PGVECTOR_PORT_INTERNAL` | `5432` | PostgreSQL port |
| `PGVECTOR_DB` | `vault_embeddings` | Database name |
| `PGVECTOR_USER` | `vault` | Database user |
| `PGVECTOR_PASSWORD` | *(no default — require explicit)* | Database password |

### Hardcoded values to promote to env vars (high priority)
| Var Name | Current Hardcoded Value | Location | Purpose |
|----------|------------------------|----------|---------|
| `VECTOR_TABLE_NAME` | `"vault_embeddings"` | gateway.py:320,904 | pgvector table name |
| `VECTOR_MAX_CONTENT_LENGTH` | `8000` | gateway.py:1102 | Max chars per document |
| `VECTOR_MAX_QUERY_LENGTH` | `4000` | gateway.py:1136 | Max chars per search query |
| `VECTOR_SEARCH_DEFAULT_LIMIT` | `10` | gateway.py:177 | Default result count |
| `VECTOR_SEARCH_MAX_LIMIT` | `100` | gateway.py:177 | Max result count |
| `GROUNDING_CONFIDENCE_THRESHOLD` | `0.6` | gateway.py:459 | Min confidence for grounding |
| `VECTOR_INDEX_TYPE` | `ivfflat` | gateway.py:332 | pgvector index type |
| `VECTOR_INDEX_LISTS` | `100` | gateway.py:332 | IVFFlat list count |

---

## Vault Auto-Sort — vault-sort.json

**File:** `.obsidian/plugins/Zenith-AI/vault-sort.json` (created on first run)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `project_indicator` | enum | `"[]"` | Options: `"[]"`, `"()"`, `"_name_"`, `"+name"` |
| `projects_drop_zone` | string | `"Projects"` | Root drop zone directory name |
| `pin_tag` | string | `"pinned"` | Tag to prevent file from being moved |
| `project_match_threshold` | number | `0.72` | Cosine similarity required to match a project |
| `min_cluster_size_override` | number | `null` | Override HDBSCAN auto-sizing |
| `sort_on_save` | boolean | `true` | Sort on every file create/modify |
| `sort_interval_minutes` | number | `null` | Re-sort full vault every N minutes (null = off) |
| `centroids` | object | `{}` | Computed — general category centroid embeddings |
| `project_centroids` | object | `{}` | Computed — project centroid embeddings |

---

## Settings UI — What Needs to Exist

Currently: 2 tabs (General, Advanced) exposing 4 fields total.

### Required settings tabs after full build

**General tab** (exists, extend)
- `API_KEY` ✅ exists
- `selectedModel` → move here from inline chat selector

**Models tab** (new)
- Main chat model (`selectedModel`)
- Extraction model (`scribeExtractionModel`)
- Embeddings model (`scribeEmbeddingsModel`)

**Advanced tab** (exists, extend)
- `selfHostingURL` ✅ exists
- `debugMode` ✅ exists
- `ZENITH_GATEWAY_URL` (gateway URL)
- `cosmicContextThreshold`
- `scribeOutputPath`

**Storage & Paths tab** (new, optional power-user)
- `chatExportFolder`
- `chatHistoryPath`
- `projectsFolderName`

---

## Summary Counts

| Scope | Current Settings | Settings to Add | Dead to Remove |
|-------|-----------------|-----------------|----------------|
| Plugin (`settings.ts`) | 5 | 11 | 2 (`customModelName`, free tier constant) |
| Web (`.env.example`) | 13 | 3 | 0 |
| Gateway (`.env.example`) | ~27 | 5 (PGVECTOR) + 8 (hardcoded→env) | 0 |
| `vault-sort.json` | 0 (new file) | 9 | 0 |
| **Total** | **~45** | **~36** | **2** |
