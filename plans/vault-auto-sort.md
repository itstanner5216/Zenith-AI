# Vault Auto-Sort — Design Plan

## What It Is

A fully autonomous vault organization system that runs independently of Zenith.
Uses embeddings, BERTopic/HDBSCAN clustering, and wikilink graph analysis to
sort vault files into semantically correct directories — without an LLM in the
loop. User intervention is limited to one initial config file and optional
per-file pin tags. Everything else is self-managing.

---

## Guiding Principles

- No LLM in the sort pipeline. Embeddings + classical algorithms only.
- Pipeline reads the vault's existing structure to bootstrap itself — no manual
  category seeding.
- Project directories are walled off. A file only ever lands in a project
  directory if the user explicitly dropped it in the `Projects/` drop zone.
- Users retain final authority via the `#pinned` tag. Pinned files never move.
- Configurable where needed. Opinionated defaults everywhere else.

---

## Architecture

### Two Separate Pipelines

**Pipeline A — Projects**
- Triggered only when a file is dropped into the `Projects/` drop zone
- Classifies the file against known project directory centroids
- High confidence match → move to that project subdirectory
- No match above threshold → move to `Projects/_Inbox/`, notify user
- File dropped with a cluster of related files → auto-detect new project,
  create `[project-name]/` subdirectory

**Pipeline B — General**
- Triggered on all other vault file changes (create/modify)
- Runs BERTopic/HDBSCAN against the target top-level category
- Creates or extends subdirectory clusters organically
- Never touches project directories

Both pipelines skip pinned files before doing anything else.

---

## Project Directory Detection

Projects directories are identified by a configurable naming indicator.
Options exposed in `vault-sort.json`:

| Indicator | Example | Detection |
|-----------|---------|-----------|
| `[]` (default) | `[multi-mcp]` | `startsWith('[') && endsWith(']')` |
| `()` | `(multi-mcp)` | `startsWith('(') && endsWith(')')` |
| `_name_` | `_multi-mcp_` | `startsWith('_') && endsWith('_')` |
| `+name` | `+multi-mcp` | `startsWith('+')` |

Config key: `"project_indicator"` in `vault-sort.json`.

```python
def is_project_dir(folder_name: str, indicator: str) -> bool:
    if indicator == "[]":
        return folder_name.startswith('[') and folder_name.endswith(']')
    elif indicator == "()":
        return folder_name.startswith('(') and folder_name.endswith(')')
    elif indicator == "_name_":
        return folder_name.startswith('_') and folder_name.endswith('_')
    elif indicator == "+name":
        return folder_name.startswith('+')
    return False

def get_project_name(folder_name: str, indicator: str) -> str:
    if indicator in ("[]", "()", "_name_"):
        return folder_name[1:-1]
    elif indicator == "+name":
        return folder_name[1:]
```

---

## Pin Tag (User Override)

Before any sort operation, the pipeline checks for a pin tag.
If present, the file is skipped unconditionally.

**Tag:** `#pinned` (configurable in `vault-sort.json` as `"pin_tag"`)

Checked via Obsidian `metadataCache` — both inline tags and frontmatter tags:

```typescript
function isPinned(app: App, file: TFile, pinTag: string): boolean {
  const cache = app.metadataCache.getFileCache(file);
  const inline = cache?.tags?.map(t => t.tag.replace('#', '')) ?? [];
  const fm = cache?.frontmatter?.tags ?? [];
  const all = [...inline, ...(Array.isArray(fm) ? fm : [fm])];
  return all.includes(pinTag);
}
```

---

## Bootstrap — Vault Teaches Itself

On first run (or when `vault-sort.json` has no centroids stored), the pipeline
reads the existing vault structure to seed itself:

1. For each top-level directory in the vault:
   - Collect all markdown notes already living in it
   - Embed each note (header-weighted input — see below)
   - Average the embeddings → this is the category centroid
   - Store centroid in `vault-sort.json` under `"centroids"`

2. For each project directory detected by naming indicator:
   - Find the anchor note (highest inbound-link count within the dir)
   - Embed the anchor note → project centroid
   - Store under `"project_centroids"`

3. If vault is completely flat (no subdirectories):
   - Run BERTopic discovery on all notes
   - Discovered topics become the initial top-level categories
   - Directories are created automatically

Zero user input during bootstrap.

---

## Embedding Input — Header Weighting

Don't embed raw note content. Structure the embedding input to weight headers:

```python
def build_embedding_input(note: ParsedNote) -> str:
    parts = []
    if note.h1:
        parts += [note.h1] * 4          # H1 repeated 4x
    if note.h2s:
        parts += note.h2s * 3           # H2s repeated 3x
    if note.h3s:
        parts += note.h3s * 2           # H3s repeated 2x
    parts.append(note.body[:4000])      # Body truncated to 4000 chars
    return "\n".join(parts)
```

Sent to Vertex `text-embedding-004` via existing gateway `/v1/embed` endpoint.
Embedding dimension: 768. Already configured in gateway via `VERTEX_EMBEDDING_MODEL`.

---

## General Pipeline — BERTopic/HDBSCAN

For general (non-project) directories, clustering runs per top-level category:

### Step 1: UMAP Dimensionality Reduction
Raw 768-dim embeddings → UMAP reduces to 5 dims.
Required for HDBSCAN to work well (curse of dimensionality at 768-dim).

```python
from umap import UMAP
reducer = UMAP(n_components=5, metric='cosine', random_state=42)
reduced = reducer.fit_transform(embeddings)
```

### Step 2: HDBSCAN Clustering
Auto-scales `min_cluster_size` based on vault size:

```python
from hdbscan import HDBSCAN
min_size = max(3, int(len(notes) ** 0.5))
clusterer = HDBSCAN(min_cluster_size=min_size, metric='euclidean')
labels = clusterer.fit_predict(reduced)
# labels[i] == -1 means outlier → stays in root of category
```

### Step 3: Subdirectory Naming (c-TF-IDF)
For each cluster, extract the most discriminative terms vs. other clusters.
Use BM25 index (already built in `/home/tanner/MCPServer`) as the term scorer,
or fallback to simple TF-IDF on cluster header tokens:

```python
def name_cluster(cluster_notes: list[ParsedNote], all_notes: list[ParsedNote]) -> str:
    # Extract all H1/H2 headers from cluster notes
    cluster_terms = extract_header_terms(cluster_notes)
    # Score against all notes to find discriminative terms
    scores = tfidf_score(cluster_terms, all_notes)
    # Top 1-2 terms become directory name
    top = sorted(scores, key=lambda x: x[1], reverse=True)[:2]
    return "-".join(t[0].lower() for t in top)
```

### Step 4: Move Files
`fileManager.renameFile()` handles moves and automatically updates all
`[[wikilinks]]` that reference the moved file.

---

## Project Pipeline — Centroid Classification

For files dropped into `Projects/`:

```python
def classify_to_project(
    note_embedding: list[float],
    project_centroids: dict[str, list[float]],
    threshold: float
) -> str | None:
    scores = {
        name: cosine_similarity(note_embedding, centroid)
        for name, centroid in project_centroids.items()
    }
    best = max(scores, key=lambda k: scores[k])
    if scores[best] >= threshold:
        return best
    return None  # → Projects/_Inbox/
```

Default threshold: `0.72`. Configurable in `vault-sort.json` as
`"project_match_threshold"`.

---

## Wikilink Graph — Project Cluster Detection

On first scan, graph density distinguishes project directories from general ones.
Used during bootstrap to auto-detect which existing directories behave like projects
(even if they don't yet use the naming indicator):

```python
def compute_intra_link_density(notes: list[ParsedNote]) -> float:
    note_paths = {n.path for n in notes}
    total_links = sum(len(n.outbound_links) for n in notes)
    intra_links = sum(
        1 for n in notes
        for link in n.outbound_links
        if link in note_paths
    )
    return intra_links / max(total_links, 1)

# density > 0.4 → behaves like a project directory
# density < 0.2 → behaves like a general category
```

This is used only during bootstrap for pre-existing vaults.
Going forward, naming indicator is the authority.

---

## Incremental Learning

When a user manually moves a file (detected via `vault.on('rename')`):
- Extract the destination directory
- Re-embed the moved file
- Update the destination centroid with exponential moving average:
  ```python
  new_centroid = (0.9 * old_centroid) + (0.1 * file_embedding)
  ```
- Persist updated centroid to `vault-sort.json`

The system drifts toward the user's actual preferences over time.
Manual moves are training signals, not conflicts.

---

## Config File — `vault-sort.json`

Lives at vault root (`.obsidian/plugins/Zenith-AI/vault-sort.json`).
Written on first run, never requires manual editing.

```json
{
  "project_indicator": "[]",
  "projects_drop_zone": "Projects",
  "pin_tag": "pinned",
  "project_match_threshold": 0.72,
  "min_cluster_size_override": null,
  "sort_on_save": true,
  "sort_interval_minutes": null,
  "centroids": {
    "Research": [...],
    "Prompts": [...],
    "Plans": [...]
  },
  "project_centroids": {
    "multi-mcp": [...],
    "Zenith-AI": [...]
  }
}
```

All keys have defaults. User can override in JSON — no UI needed.

---

## File Watcher Integration (Plugin Side)

```typescript
// In ZenithAI.onload()
this.registerEvent(
  this.app.vault.on('create', async (file) => {
    if (!(file instanceof TFile) || file.extension !== 'md') return;
    if (isPinned(this.app, file, this.sortConfig.pin_tag)) return;
    await this.vaultSorter.classifyAndMove(file);
  })
);

this.registerEvent(
  this.app.vault.on('rename', async (file, oldPath) => {
    if (!(file instanceof TFile)) return;
    // User manually moved — treat as training signal
    await this.vaultSorter.recordManualMove(file, oldPath);
  })
);
```

Rate limited: max 1 sort operation per 500ms to avoid hammering the gateway
on bulk imports.

---

## New Dependencies

**Python (add to `Zeniths-Vectors/requirements.txt`):**
```
bertopic==0.16.4
hdbscan==0.8.40
umap-learn==0.5.7
scikit-learn==1.6.1
```

**TypeScript (already available):**
- `wink-bm25-text-search` — already in pnpm lockfile
- Vertex gateway endpoints — already implemented

---

## New Gateway Endpoints

Add to `Zeniths-Vectors/gateway.py`:

### `POST /v1/cluster`
Runs UMAP + HDBSCAN on a set of embeddings. Returns cluster labels + suggested
directory names.

Input:
```json
{
  "embeddings": [[...], [...]],
  "note_ids": ["path/a.md", "path/b.md"],
  "header_terms": [["term1", "term2"], ["term3"]],
  "min_cluster_size": null
}
```
Output:
```json
{
  "clusters": [
    { "label": 0, "name": "bm25-retrieval", "note_ids": ["path/a.md"] },
    { "label": -1, "name": null, "note_ids": ["path/b.md"] }
  ]
}
```

### `POST /v1/classify`
Cosine similarity of a single embedding against a set of named centroids.
Returns best match name and score.

Input:
```json
{
  "embedding": [...],
  "centroids": { "multi-mcp": [...], "Zenith-AI": [...] },
  "threshold": 0.72
}
```
Output:
```json
{ "match": "multi-mcp", "score": 0.89 }
// or
{ "match": null, "score": 0.41 }
```

---

## New Plugin Service — `VaultSorter`

`packages/plugin/services/vault-sorter.ts`

Responsibilities:
- Load and persist `vault-sort.json`
- Expose `classifyAndMove(file: TFile)` — full sort pipeline for one file
- Expose `bulkSort()` — initial scan of entire vault on first run
- Expose `recordManualMove(file, oldPath)` — centroid update on user move
- Expose `pinFile(file)` / `unpinFile(file)` — add/remove `#pinned` tag

Calls:
- Plugin's `getServerUrl()` for gateway requests
- Obsidian `fileManager.renameFile()` for moves
- `metadataCache` for tag and link reads

---

## New Gateway Service — `VaultIndexer`

`packages/plugin/services/vault-indexer.ts`

Responsibilities:
- On plugin load: scan all vault markdown files, embed each, upsert to
  `/v1/vector-upsert` (skips files with unchanged content hash)
- On `vault.on('modify')`: re-embed and re-upsert changed file
- On `vault.on('delete')`: call `/v1/vector-delete` (new endpoint) to remove
  embedding from pgvector
- Rate limited: 200ms delay between upsert calls during bulk index
- Progress reported via Obsidian `Notice` during first-run bulk index

This is also the prerequisite for Cosmic Context — same index, same gateway.

---

## Sort Decision Log

Every move gets logged to a lightweight append-only file in the vault:
`.obsidian/plugins/Zenith-AI/sort-log.jsonl`

```json
{"ts": 1234567890, "file": "note.md", "from": "root", "to": "Research/bm25-retrieval", "score": 0.87, "pipeline": "general"}
{"ts": 1234567891, "file": "plan.md", "from": "Projects", "to": "Projects/_Inbox", "score": 0.41, "pipeline": "projects"}
```

Used for debugging and future centroid tuning. Never shown in UI by default.

---

## File Structure

```
Zeniths-Vectors/
  gateway.py                         ← add /v1/cluster, /v1/classify, /v1/vector-delete
  requirements.txt                   ← add bertopic, hdbscan, umap-learn, scikit-learn

packages/plugin/
  services/
    vault-sorter.ts                  ← new: main sort orchestrator
    vault-indexer.ts                 ← new: vault → pgvector index sync
  index.ts                           ← wire vault-sorter + vault-indexer on load
```

---

## Sort Trigger Modes

Configurable in `vault-sort.json` via `"sort_on_save"` and `"sort_interval_minutes"`:

| Mode | Config | Behavior |
|------|--------|----------|
| On save (default) | `sort_on_save: true` | Sort fires on every file create/save |
| Manual only | `sort_on_save: false, sort_interval_minutes: null` | User triggers via command |
| Scheduled | `sort_interval_minutes: 60` | Re-sort full vault every N minutes |
| Both | `sort_on_save: true, sort_interval_minutes: 60` | Both |

Obsidian command registered: `Vault: Sort now` — triggers `bulkSort()` manually
regardless of config.

---

## Design Decisions

1. **Standalone** — Entirely independent of Zenith chat. No LLM. No web package
   involvement. Plugin + gateway only.

2. **Projects are walled** — Nothing enters a project directory unless it came
   through the `Projects/` drop zone. General pipeline never touches project dirs.

3. **`#pinned` is absolute** — Checked before any operation. No exceptions.

4. **Vault teaches itself** — Bootstrap reads existing structure. No manual
   category seeding required.

5. **BERTopic as primary discovery** — UMAP → HDBSCAN → c-TF-IDF. LDA available
   as offline fallback if gateway is unreachable.

6. **`fileManager.renameFile()` for all moves** — Obsidian's API handles wikilink
   updates automatically. Never use `vault.rename()` directly.

7. **Shared index with Cosmic Context** — `VaultIndexer` feeds pgvector, which
   Cosmic Context queries. Build once, used by both features.

8. **Sort log** — Append-only JSONL for auditability. Never surfaced in UI
   unless user opens it manually.
