# Vertex AI Search + Obsidian Gateway

A unified knowledge management infrastructure bridging Google Cloud Vertex AI Search (semantic retrieval + grounded generation) with Obsidian Local REST API, exposed through OpenWebUI.

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────────────┐
│   User      │────▶│  OpenWebUI   │────▶│  Gateway Service (FastAPI)          │
│  (Chat)     │◀────│  (Port 3000) │◀────│  (Port 8085)                        │
└─────────────┘     └──────────────┘     └─────────────────────────────────────┘
                                                      │
                          ┌──────────────────────────┼──────────────────────────┐
                          │                          │                          │
                          ▼                          ▼                          ▼
                ┌─────────────────┐      ┌────────────────────┐      ┌─────────────────┐
                │  Vertex AI      │      │  Vertex AI         │      │  Obsidian       │
                │  Search         │      │  Grounded Gen      │      │  Local REST API │
                │  (:search)      │      │  (:generateGrounded│      │  (Port 27124)   │
                │                 │      │   Content)         │      │                 │
                └─────────────────┘      └────────────────────┘      └─────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │  Google Search  │
                │  (Grounding)    │
                └─────────────────┘
```

## Verified API Endpoints

### Google Discovery Engine API (Verified)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1alpha/projects/{PROJECT}/locations/{LOCATION}/collections/default_collection/dataStores/{DATASTORE}/servingConfigs/default_serving_config:search` | POST | Semantic document retrieval |
| `/v1alpha/projects/{PROJECT}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE}/servingConfigs/default_serving_config:answer` | POST | Conversational answers with session persistence |
| `/v1alpha/projects/{PROJECT}/locations/{LOCATION}/rankingConfigs/default_ranking_config:rank` | POST | Semantic ranking of documents |
| `/v1/projects/{PROJECT_NUMBER}/locations/{LOCATION}:generateGroundedContent` | POST | Grounded generation with Google Search + Vault |

### Obsidian Local REST API (Verified)

The gateway proxies all 12+ Obsidian REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/vault/{filepath}` | GET, POST, PUT, PATCH, DELETE | File operations |
| `/vault-search` | GET | Simple text search |
| `/vault-search/advanced` | POST | Dataview DQL search |
| `/vault` | GET | List root files |
| `/vault/dir/{path}` | GET | List directory |
| `/active` | GET, PUT, POST, DELETE | Active file operations |
| `/commands` | GET | List commands |
| `/commands/{id}` | POST | Execute command |
| `/open/{filename}` | POST | Open file in UI |
| `/periodic/{period}` | GET | Get periodic note |

## Quick Start

### 1. Prerequisites

- Docker Desktop (for host.docker.internal support)
- Google Cloud project with Vertex AI Search enabled
- Obsidian with Local REST API plugin installed
- Service account with appropriate permissions

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

Required variables:
- `GOOGLE_PROJECT_ID` - Your GCP project ID
- `GOOGLE_PROJECT_NUMBER` - Your GCP project number
- `GOOGLE_DATASTORE_ID` - Vertex AI Search datastore ID
- `GOOGLE_ENGINE_ID` - Vertex AI Search engine ID
- `GOOGLE_SERVICE_ACCOUNT_PATH` - Path to service account JSON
- `OBSIDIAN_API_KEY` - From Obsidian plugin settings

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Access OpenWebUI

Navigate to: http://localhost:3000

## Gateway API Endpoints

### Vertex AI Search Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/search` | Semantic search across vault |
| `POST /v1/answer` | Conversational answers with sessions |
| `POST /v1/rank` | Semantic ranking |
| `POST /v1/grounded` | Grounded generation |

### Obsidian Proxy Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /vault/{filepath}` | Read note |
| `POST /vault/{filepath}` | Create/update note |
| `GET /vault-search` | Search vault |
| `GET /health` | Health check |

### Health Check

```bash
curl http://localhost:8085/health
```

## OpenWebUI Tools

The `vertex_search_tool.py` provides these tools:

### Vertex AI Search Tools

- `vertex_search_grounded` - Generate grounded answers
- `vertex_search_answer` - Conversational answers with session management
- `vertex_search_rank` - Semantic ranking
- `vertex_clear_session` - Clear conversation context

### Obsidian Tools

- `obsidian_read_note` - Read vault notes
- `obsidian_write_note` - Create/update notes
- `obsidian_search_vault` - Search across vault
- `obsidian_list_files` - Browse vault structure
- `obsidian_delete_note` - Delete notes
- `obsidian_append_note` - Append to notes
- `obsidian_patch_note` - Partial updates
- `obsidian_get_active` - Get active file
- `obsidian_update_active` - Update active file
- `obsidian_list_commands` - List Obsidian commands
- `obsidian_execute_command` - Execute commands
- `obsidian_open_file` - Open file in UI
- `obsidian_get_periodic` - Get periodic notes
- `obsidian_advanced_search` - Dataview queries

## Session Management

The Answer API maintains conversation context via sessions:

1. First query: No session_id → Gateway creates new session
2. Response includes session_id → Stored in tool
3. Follow-up queries: session_id passed automatically
4. Context preserved until session expires (30 min TTL)

## Grounding Confidence Indicators

| Emoji | Range | Level |
|-------|-------|-------|
| 🟢 | >= 90% | Very High |
| 🟡 | >= 75% | High |
| 🟠 | >= 60% | Medium |
| 🔴 | < 60% | Low |

## Constraints Adherence

### Constraint 1: Model Configurability

All model identifiers are environment variables:
```python
ANSWER_MODEL_VERSION = os.environ.get("VERTEX_ANSWER_MODEL", "gemini-1.5-flash-002/answer_gen/v2")
GROUNDING_MODEL_ID = os.environ.get("VERTEX_GROUNDING_MODEL", "gemini-2.0-flash-exp")
```

### Constraint 2: No Generation Parameters

No `max_tokens`, `temperature`, `top_p`, `top_k`, or `candidateCount` in API requests. Only query, grounding sources, and model identifier are passed.

### Constraint 3: Production Ready

- Comprehensive error handling with exponential backoff
- Structured JSON logging
- Pydantic models for validation
- Health check endpoints
- No TODO comments or placeholders
- Non-root Docker user

## Troubleshooting

### Obsidian Not Available

If Obsidian is not running, the gateway returns graceful error messages:
```json
{
  "error": "Obsidian not available. Ensure Obsidian is running with Local REST API plugin enabled on port 27124.",
  "available": false
}
```

### Google Auth Issues

Ensure your service account has these permissions:
- `discoveryengine.servingConfigs.search`
- `discoveryengine.servingConfigs.answer`
- `discoveryengine.rankingConfigs.rank`

### Network Issues

For Linux (without Docker Desktop), update `OBSIDIAN_API_URL`:
```bash
# Find your host IP
ip route | grep default

# Use host IP instead of host.docker.internal
OBSIDIAN_API_URL=http://192.168.1.100:27124
```

## File Manifest

| File | Description |
|------|-------------|
| `gateway.py` | FastAPI service (core engine) |
| `vertex_search_tool.py` | OpenWebUI tool integration |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container definition |
| `docker-compose.yml` | Service orchestration |
| `.env.example` | Configuration template |

## License

MIT License - Production use permitted.
