# Vault Intelligence — Design Document

**Date:** 2026-03-08

---

## What We're Building

Project-aware vault organization powered by vector embeddings. Instead of asking the AI model "where does this file go?" on every file, the plugin uses semantic embeddings + a ranker to route files into the right project folder automatically. The model's role shifts from routing to generation and user dialogue.

---

## Architecture

```
File drops in inbox
    ↓
Embed content → vector search vault (pgvector)
    ↓
Find similar notes → get their folders
    ↓
Read Organization Preferences doc (user's rules)
    ↓
Rank folder candidates (Vertex AI Ranker)
    ↓
Confidence ≥ threshold → auto-move (silent)
Confidence < threshold → show suggestion UI (existing flow)
    ↓
Index new note's embedding in pgvector
```

```
User: "I hate this structure, move dev projects to /Dev/"
    ↓
Model understands intent
    ↓
Model updates Vault Organization Rules.md in vault
    ↓
Model uses move-files tool to reorganize existing notes
    ↓
Future auto-sorts use updated rules as context
```

---

## Components

### 1. pgvector Service (new Docker service in Vertex Brain)
- PostgreSQL 16 + pgvector extension
- Table: `vault_embeddings(id TEXT PK, content_hash TEXT, embedding vector(768), folder_path TEXT, tags TEXT[], updated_at TIMESTAMPTZ)`
- IVFFlat index for approximate nearest neighbor search
- Lives in `Vertex_AI_Brain/docker-compose.yml`

### 2. New Gateway Endpoints (Vertex_AI_Brain/gateway.py)
- `POST /v1/embed` — generate embedding via Vertex AI `text-embedding-004`
- `POST /v1/vector-upsert` — store/update a note's embedding in pgvector
- `POST /v1/vector-search` — cosine similarity search, returns notes + folders
- Embedding model configurable via `VERTEX_EMBEDDING_MODEL` env var (default: `text-embedding-004`)
- Embedding dimensions configurable via `VERTEX_EMBEDDING_DIMENSIONS` env var (default: `768`)

### 3. VertexBrainClient (TypeScript, packages/plugin/services/)
- Thin HTTP wrapper around gateway endpoints
- Methods: `embed()`, `vectorSearch()`, `vectorUpsert()`, `rank()`, `answer()`, `health()`
- Uses Obsidian's `requestUrl` — no extra deps
- Configurable base URL via plugin settings

### 4. VaultIndexer (TypeScript, packages/plugin/services/)
- Background queue that embeds and indexes all vault notes
- Runs on plugin load (skip if content_hash unchanged)
- Enqueues on file create/modify via existing event handlers
- Rate-limited to avoid hammering the gateway

### 5. OrganizationPreferencesService (TypeScript, packages/plugin/services/)
- Reads/writes `System/Vault Organization Rules.md` (path configurable)
- 30s TTL cache — fast reads during every auto-sort
- Model updates this doc when user requests structure changes

### 6. Auto-sort Pipeline Changes (inbox/index.ts)
- `recommendFolderStep` → replaced with `recommendFolderWithEmbeddingsStep`
- Falls back to existing model-based suggestion if Brain not configured or confidence too low
- `recommendTagsStep` → existing tags found via vector similarity; new tags still via model

### 7. Model Role After This
| Task | Before | After |
|------|--------|-------|
| Folder routing | Model | Embeddings + Ranker |
| Existing tag matching | Model | Vector similarity |
| New tag creation | Model | Model (unchanged) |
| Title generation | Model | Model (unchanged) |
| Content formatting | Model | Model (unchanged) |
| Image analysis | Model | Model (unchanged) |
| YouTube/audio | Model | Model (unchanged) |
| Chat assistant | Model | Model (unchanged) |
| Organization rule updates | N/A | Model (new) |

### 8. LiteLLM MCP Bridge
- Add vault-search-service MCP server to `~/litellm-deployment/litellm-config.yaml`
- All Obsidian AI plugins connected to LiteLLM automatically get semantic vault search as a tool
- No changes needed to those plugins

### 9. UI Additions
- **Settings → Vault Intelligence section**: Brain URL, confidence threshold, max folder depth, rules path, index status
- **Organizer panel**: badge showing "auto-sorted by embeddings" vs "AI suggested" vs "manual"

---

## New Plugin Settings

```typescript
vertexBrainUrl: string            // default: "http://localhost:8085"
enableVectorAutoSort: boolean     // default: true
autoSortConfidenceThreshold: number  // default: 0.75
maxFolderDepth: number            // default: 3
organizationRulesPath: string     // default: "System/Vault Organization Rules.md"
```

---

## Constraints (Hard)
- NEVER hardcode model names — all via env vars
- NEVER hardcode generation params (temperature, top_k, top_p, max_tokens)
- Brain URL user-configurable, never hardcoded
- Confidence threshold user-configurable
- Graceful fallback if Brain unavailable — existing model flow continues unchanged
