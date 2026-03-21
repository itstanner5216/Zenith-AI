# Cosmic Context — Design Plan

## What It Is

A separate chat tab where every 2 turns, the last user message + AI response
are combined into a query and run against the vault's vector embeddings.
The top matching vault documents surface in the sidebar panel.

No LLM in the loop. Pure vector similarity. The intelligence is the embeddings —
Zenith is not involved. The user sees what their vault already knows about the
topic being discussed, and can choose whether to act on it.

---

## The Pipeline

```
User + AI exchange (turn N, N+1)
  → combine: last user message + last AI response
  → POST /api/vault-search (web package)
      → proxies to Zeniths-Vectors gateway: POST /v1/vector-search
      → gateway embeds query (Vertex text-embedding-004)
      → cosine similarity against vault_embeddings in pgvector
      → returns top N: [{id, folder_path, tags, similarity}]
  → plugin receives results
  → displays matched vault docs in Cosmic Context panel
```

---

## What Already Exists

**Zeniths-Vectors gateway (`gateway.py`)**
- `POST /v1/vector-search` — fully implemented
  - Input: `{ query: string, limit: number }`
  - Embeds query via Vertex `text-embedding-004`
  - Cosine similarity via pgvector
  - Returns: `{ success: true, results: [{ id, folder_path, tags, similarity }] }`
- `POST /v1/vector-upsert` — indexing endpoint (for future vault sync)
- pgvector schema initialized on startup (`vault_embeddings` table)

**Plugin (`vertex-brain-client.ts`)**
- `vectorSearch(query, limit)` stub — returns `[]`, wired to nothing
- `VaultSearchResult` type: `{ folder_path, file_path, content }`
- `vault-intelligence:chat-turn` event already fires from `chat.tsx` every turn

---

## What Needs To Be Built

### 1. Web package — `/api/vault-search` route
New file: `packages/web/app/api/vault-search/route.ts`

Receives:
```ts
{ query: string; limit?: number }
```

Proxies to the gateway's `/v1/vector-search`, returns the results directly.
Auth: same `handleAuthorizationV2` as the chat route.

Env var needed: `ZENITH_GATEWAY_URL` — base URL of the Zeniths-Vectors gateway
(e.g. `http://localhost:8000`). Add to `.env.example`.

---

### 2. Plugin — wire `vectorSearch()` in `vertex-brain-client.ts`
Replace the stub with a real fetch to `/api/vault-search`:
```ts
async vectorSearch(query: string, limit: number): Promise<VaultSearchResult[]> {
  const response = await fetch(`${plugin.getServerUrl()}/api/vault-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(plugin.getApiKey() ? { Authorization: `Bearer ${plugin.getApiKey()}` } : {}),
    },
    body: JSON.stringify({ query, limit }),
  });
  const data = await response.json();
  return data.results ?? [];
}
```

Note: `VaultSearchResult` currently has `file_path` and `content` fields.
The gateway only returns `id`, `folder_path`, `tags`, `similarity`.
Update the type to match what the gateway actually returns — `content` is
not returned (intentional: we display the file reference, not inline content).

---

### 3. Plugin — Cosmic Context tab

New tab in the sidebar alongside Chat and Scribe.

**Tab header:**
```
[Chat]  [Scribe]  [Cosmic]
```

**Content area — two panels:**

Top panel: standard chat UI — single thread (no multi-session tab bar)

Bottom panel: top matching vault note, updates every N turns
```
┌─────────────────────────────────────────┐
│  Vault match                      ↻     │  ← spinner when searching
├─────────────────────────────────────────┤
│                                         │
│  Projects/MetaServer/bm25.md            │  ← click opens in Obsidian
│  similarity: 0.94                       │
│                                         │
└─────────────────────────────────────────┘
```

One note displayed at a time — the single highest-scoring match above threshold.
Click → `plugin.app.workspace.openLinkText(file_path, '')` opens in main editor.
When no match exceeds threshold → "No strong match" (after first search attempt).
When threshold not configured → block with prompt to set it in settings.

---

### 4. File structure

```
packages/web/app/api/vault-search/
  route.ts                          ← new

packages/plugin/services/
  vertex-brain-client.ts            ← update vectorSearch stub + VaultSearchResult type

packages/plugin/views/assistant/
  view.tsx                          ← add Cosmic tab
  cosmic/
    cosmic-context-view.tsx         ← new: chat + matches panel
    vault-matches-panel.tsx         ← new: results display
```

---

## Design Decisions

1. **Gateway URL env var** — `GATEWAY_URL` (set in `Zeniths-Vectors/.env.example` as
   `http://gateway:8085`). Add `ZENITH_GATEWAY_URL` to web `.env.example` pointing
   to the same service. Confirm actual var name before wiring.

2. **Result count** — Top 1 matching note displayed at a time. Single note panel,
   not a list.

3. **Similarity threshold** — Configurable in plugin settings (`cosmicContextThreshold`,
   type `number`). No default set — when unset (or 0), the tab blocks with a prompt:
   "Set a similarity threshold in Settings → Advanced to use Cosmic Context."

4. **Turn frequency** — Configurable in JSON settings (not exposed in UI).
   Setting: `cosmicContextTurnFrequency` (number, default `2`).

5. **Vault indexing** — Never indexed before. The pgvector infrastructure is fully
   ready (`/v1/vector-upsert` exists). The plugin needs to push vault content to
   the gateway on first load and on file changes. This is a prerequisite for any
   search results — without indexing, all queries return empty.
   **Indexing is a required task before Cosmic Context can function.**

6. **Tab label** — "Cosmic" on top, "Context" below it, both centered. Stacked
   two-line tab label.

---

## Updated Architecture — BM25-first, gateway semantic fallback

Based on the existing plan at `docs/plans/cosmic-context-implementation.md`:
- `wink-bm25-text-search` is already in the lockfile
- BM25 runs client-side against the vault index (fast, free, no network)
- If BM25 score is below threshold → fall back to gateway `/v1/vector-search`
- This matches the prior design intent exactly
