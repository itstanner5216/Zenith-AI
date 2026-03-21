#!/usr/bin/env python3
"""
Vertex AI Search + Obsidian Gateway Service
============================================
Version: 3.1.0 (Production — MCP-enabled)

Changelog (3.1.0):
  - Fix 1: groundingMetadata now read from candidates[0], not response root
  - Fix 2: fastapi-mcp exposes all endpoints as MCP tools at /mcp
  - Fix 4: generateGroundedContent deprecation note (endpoint still active)
  - Fix 5: credentials.refresh() wrapped in asyncio.to_thread()
"""

import os
import sys
import json
import logging
import asyncio
import ssl
import traceback
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Callable
from contextlib import asynccontextmanager
from functools import wraps

import httpx
import asyncpg
from fastapi import FastAPI, HTTPException, Request, status, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# =============================================================================
# CENTRALIZED MODEL CONFIGURATION
# All model identifiers in one place. Override via env vars.
# Defaults use stable GA identifiers — no preview/dated suffixes.
#
# VERTEX_ANSWER_MODEL     — model version for :answer endpoint
#                           "stable" lets the API choose its current best
# VERTEX_GROUNDING_MODEL  — model for :generateGroundedContent
# VERTEX_MODEL_REASONING  — highest-quality Gemini role
# VERTEX_MODEL_BALANCED   — balanced cost/quality role
# VERTEX_MODEL_FAST       — cheapest/fastest role
# =============================================================================

VERTEX_ANSWER_MODEL = os.environ.get("VERTEX_ANSWER_MODEL", "stable")
VERTEX_GROUNDING_MODEL = os.environ.get("VERTEX_GROUNDING_MODEL", "gemini-2.5-flash")
VERTEX_MODEL_REASONING = os.environ.get("VERTEX_MODEL_REASONING", "gemini-2.5-pro")
VERTEX_MODEL_BALANCED = os.environ.get("VERTEX_MODEL_BALANCED", "gemini-2.5-flash")
VERTEX_MODEL_FAST = os.environ.get("VERTEX_MODEL_FAST", "gemini-2.5-flash-lite")
VERTEX_EMBEDDING_MODEL = os.environ.get("VERTEX_EMBEDDING_MODEL", "text-embedding-004")
VERTEX_EMBEDDING_LOCATION = os.environ.get("VERTEX_EMBEDDING_LOCATION", "us-central1")

# =============================================================================
# GOOGLE CLOUD CONFIGURATION
# =============================================================================

GOOGLE_PROJECT_ID = os.environ.get("GOOGLE_PROJECT_ID", "")
GOOGLE_PROJECT_NUMBER = os.environ.get("GOOGLE_PROJECT_NUMBER", "")
GOOGLE_LOCATION = os.environ.get("GOOGLE_LOCATION", "global")
GOOGLE_DATASTORE_ID = os.environ.get("GOOGLE_DATASTORE_ID", "")
GOOGLE_ENGINE_ID = os.environ.get("GOOGLE_ENGINE_ID", "")
GOOGLE_SERVICE_ACCOUNT_PATH = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_PATH", "/app/creds/service-account.json")

# =============================================================================
# OBSIDIAN CONFIGURATION
# =============================================================================

OBSIDIAN_API_URL = os.environ.get("OBSIDIAN_API_URL", "https://host.docker.internal:27124")
OBSIDIAN_API_KEY = os.environ.get("OBSIDIAN_API_KEY", "")
OBSIDIAN_VERIFY_TLS = os.environ.get("OBSIDIAN_VERIFY_TLS", "false").lower() == "true"

# =============================================================================
# SERVICE CONFIGURATION
# =============================================================================

SERVICE_PORT = int(os.environ.get("SERVICE_PORT", "8085"))
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "60"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
RETRY_DELAY = float(os.environ.get("RETRY_DELAY", "1.0"))
OBSIDIAN_HEALTH_CACHE_SECONDS = int(os.environ.get("OBSIDIAN_HEALTH_CACHE_SECONDS", "30"))
OBSIDIAN_RECONNECT_INTERVAL = int(os.environ.get("OBSIDIAN_RECONNECT_INTERVAL", "10"))
SESSION_TTL_MINUTES = int(os.environ.get("SESSION_TTL_MINUTES", "30"))

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

# =============================================================================
# STRUCTURED LOGGING
# =============================================================================

class StructuredLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if hasattr(record, "extra_data"):
            entry.update(record.extra_data)
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = traceback.format_exception(*record.exc_info)[-1].strip()
        return json.dumps(entry)

logger = logging.getLogger("gateway")
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(StructuredLogFormatter())
logger.addHandler(_handler)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    page_size: int = Field(default=10, ge=1, le=100)
    filter_expr: Optional[str] = Field(default=None)
    @field_validator("query")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        return v

class AnswerRequest(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: Optional[str] = Field(default=None)
    preamble: Optional[str] = Field(default=None)
    mode: str = Field(default="vault")
    @field_validator("query")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        return v
    @field_validator("mode")
    @classmethod
    def _mode(cls, v: str) -> str:
        if v not in ("vault", "google"):
            raise ValueError("Mode must be 'vault' or 'google'")
        return v

class RankRecord(BaseModel):
    id: str; title: str; content: str

class RankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    records: List[RankRecord] = Field(..., min_length=1, max_length=100)
    top_n: Optional[int] = Field(default=None)


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

class GroundedRequest(BaseModel):
    query: str = Field(..., min_length=1)
    mode: str = Field(default="google")
    system_preamble: Optional[str] = Field(default=None)
    @field_validator("query")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        return v
    @field_validator("mode")
    @classmethod
    def _mode(cls, v: str) -> str:
        if v not in ("google", "vault"):
            raise ValueError("Mode must be 'google' or 'vault'")
        return v

class VaultWriteRequest(BaseModel):
    content: str = Field(...)

class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)
    task_type: str = Field(default="RETRIEVAL_DOCUMENT")

class EmbedResponse(BaseModel):
    embedding: List[float]
    token_count: int

class Citation(BaseModel):
    uri: str = ""; title: str = ""; index: int = 0

class GroundingSupport(BaseModel):
    segment: str = ""; score: float = Field(default=0.0, ge=0.0, le=1.0); percentage: int = Field(default=0, ge=0, le=100)

class GatewayResponse(BaseModel):
    answer: str = ""
    citations: List[Citation] = Field(default_factory=list)
    grounding_support: List[GroundingSupport] = Field(default_factory=list)
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class HealthResponse(BaseModel):
    status: str; timestamp: str; version: str = "3.1.0"; services: Dict[str, Any]

# =============================================================================
# AUTHENTICATION MANAGER
# =============================================================================

class AuthManager:
    def __init__(self):
        self.credentials = None
        self._lock = asyncio.Lock()
        self._initialized = False
        self._available = False

    async def initialize(self) -> bool:
        async with self._lock:
            if self._initialized:
                return self._available
            if not os.path.exists(GOOGLE_SERVICE_ACCOUNT_PATH):
                logger.warning("Service account not found — Vertex disabled",
                               extra={"extra_data": {"path": GOOGLE_SERVICE_ACCOUNT_PATH}})
                self._initialized, self._available = True, False
                return False
            try:
                from google.auth.transport.requests import Request as GAR
                from google.oauth2 import service_account as sa
                self.credentials = sa.Credentials.from_service_account_file(
                    GOOGLE_SERVICE_ACCOUNT_PATH,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"])
                self._initialized, self._available = True, True
                logger.info("AuthManager initialized")
                return True
            except Exception as e:
                logger.error("Credential init failed", extra={"extra_data": {"error": str(e)}})
                self._initialized, self._available = True, False
                return False

    @property
    def is_available(self) -> bool:
        return self._available

    async def get_access_token(self) -> str:
        async with self._lock:
            if not self._available or not self.credentials:
                raise RuntimeError("AuthManager not available")
            if not self.credentials.valid:
                try:
                    from google.auth.transport.requests import Request as GAR
                    # Fix 5: non-blocking credential refresh
                    await asyncio.to_thread(self.credentials.refresh, GAR())
                except Exception:
                    try:
                        from google.oauth2 import service_account as sa
                        self.credentials = sa.Credentials.from_service_account_file(
                            GOOGLE_SERVICE_ACCOUNT_PATH,
                            scopes=["https://www.googleapis.com/auth/cloud-platform"])
                        from google.auth.transport.requests import Request as GAR
                        # Fix 5: non-blocking credential refresh (fallback path)
                        await asyncio.to_thread(self.credentials.refresh, GAR())
                    except Exception as e2:
                        raise RuntimeError(f"Token refresh failed: {e2}")
            return self.credentials.token

auth_manager = AuthManager()

# =============================================================================
# PGVECTOR CONNECTION POOL
# =============================================================================

_pg_pool = None


async def get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
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
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS vault_embeddings_embedding_idx
            ON vault_embeddings USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        """)
    logger.info("pgvector schema initialized")

# =============================================================================
# RETRY DECORATOR
# =============================================================================

def with_retry(max_retries: int = MAX_RETRIES, delay: float = RETRY_DELAY):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exc: Optional[Exception] = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except httpx.HTTPStatusError as e:
                    last_exc = e
                    if 400 <= e.response.status_code < 500 and e.response.status_code not in (429, 408):
                        raise
                except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout,
                        httpx.WriteTimeout, httpx.PoolTimeout, httpx.NetworkError,
                        ConnectionError, OSError) as e:
                    last_exc = e
                if attempt < max_retries - 1:
                    await asyncio.sleep(min(delay * (2 ** attempt), 30.0))
            if last_exc:
                raise last_exc
            raise RuntimeError("Max retries exceeded")
        return wrapper
    return decorator

# =============================================================================
# VERTEX AI SEARCH CLIENT
# =============================================================================

class VertexSearchClient:
    BASE_URL = "https://discoveryengine.googleapis.com"

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(REQUEST_TIMEOUT, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            http2=True)

    async def close(self) -> None:
        try: await self.client.aclose()
        except Exception: pass

    def _headers(self, token: str) -> Dict[str, str]:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _json(self, r: httpx.Response) -> Any:
        try: return r.json()
        except (json.JSONDecodeError, ValueError):
            return {"error": "Invalid JSON", "raw_text": r.text[:200]}

    @with_retry()
    async def semantic_search(self, query: str, page_size: int = 10,
                              filter_expr: Optional[str] = None) -> Any:
        token = await auth_manager.get_access_token()
        url = (f"{self.BASE_URL}/v1alpha/projects/{GOOGLE_PROJECT_ID}/"
               f"locations/{GOOGLE_LOCATION}/collections/default_collection/"
               f"dataStores/{GOOGLE_DATASTORE_ID}/servingConfigs/default_serving_config:search")
        body: Dict[str, Any] = {"query": query, "pageSize": page_size,
            "contentSearchSpec": {"snippetSpec": {"returnSnippet": True},
                                  "summarySpec": {"summaryResultCount": 3}}}
        if filter_expr:
            body["filter"] = filter_expr
        r = await self.client.post(url, headers=self._headers(token), json=body)
        r.raise_for_status()
        return self._json(r)

    @with_retry()
    async def conversational_answer(self, query: str, session_id: Optional[str] = None,
                                    preamble: Optional[str] = None, mode: str = "vault") -> Any:
        token = await auth_manager.get_access_token()
        url = (f"{self.BASE_URL}/v1alpha/projects/{GOOGLE_PROJECT_ID}/"
               f"locations/{GOOGLE_LOCATION}/collections/default_collection/"
               f"engines/{GOOGLE_ENGINE_ID}/servingConfigs/default_serving_config:answer")
        gs: Dict[str, Any] = {}
        if mode == "google":
            gs = {"groundingSources": [{"googleSearchSource": {}}]}
        ags: Dict[str, Any] = {"includeCitations": True}
        if VERTEX_ANSWER_MODEL:
            ags["modelSpec"] = {"modelVersion": VERTEX_ANSWER_MODEL}
        body: Dict[str, Any] = {"query": {"text": query, "queryId": ""}, "answerGenerationSpec": ags}
        if gs:
            body["answerGenerationSpec"]["groundingSpec"] = gs
        if preamble:
            body["answerGenerationSpec"]["promptSpec"] = {"preamble": preamble}
        body["session"] = (
            f"projects/{GOOGLE_PROJECT_ID}/locations/{GOOGLE_LOCATION}/"
            f"collections/default_collection/engines/{GOOGLE_ENGINE_ID}/"
            f"sessions/{session_id}") if session_id else "-"
        r = await self.client.post(url, headers=self._headers(token), json=body)
        r.raise_for_status()
        return self._json(r)

    @with_retry()
    async def semantic_rank(self, query: str, records: List[RankRecord],
                            top_n: Optional[int] = None) -> Any:
        token = await auth_manager.get_access_token()
        url = (f"{self.BASE_URL}/v1alpha/projects/{GOOGLE_PROJECT_ID}/"
               f"locations/{GOOGLE_LOCATION}/rankingConfigs/default_ranking_config:rank")
        body: Dict[str, Any] = {"query": query,
            "records": [{"id": r.id, "title": r.title, "content": r.content} for r in records]}
        if top_n:
            body["topN"] = top_n
        h = self._headers(token)
        h["X-Goog-User-Project"] = GOOGLE_PROJECT_ID
        r = await self.client.post(url, headers=h, json=body)
        r.raise_for_status()
        return self._json(r)

    @with_retry()
    async def generate_grounded_content(self, query: str, mode: str = "google",
                                        system_preamble: Optional[str] = None) -> Any:
        token = await auth_manager.get_access_token()
        # Fix 4: generateGroundedContent is still the active v1 REST endpoint.
        # Google recommends migrating to Gemini generateContent with grounding tools
        # for new integrations, but the Discovery Engine endpoint remains functional.
        # See: https://docs.cloud.google.com/generative-ai-app-builder/docs/grounded-gen
        url = (f"{self.BASE_URL}/v1/projects/{GOOGLE_PROJECT_NUMBER}/"
               f"locations/{GOOGLE_LOCATION}:generateGroundedContent")
        gsrc: Dict[str, Any] = {}
        if mode == "google":
            gsrc = {"googleSearchSource": {"dynamicRetrievalConfig": {"predictor": {"threshold": 0.6}}}}
        elif mode == "vault" and GOOGLE_ENGINE_ID:
            gsrc = {"searchSource": {"servingConfig":
                f"projects/{GOOGLE_PROJECT_NUMBER}/locations/{GOOGLE_LOCATION}/"
                f"collections/default_collection/engines/{GOOGLE_ENGINE_ID}/servingConfigs/default_search"}}
        body: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": query}]}],
            "groundingSpec": {"groundingSources": [gsrc] if gsrc else []},
            "generationSpec": {"modelId": VERTEX_GROUNDING_MODEL}}
        if system_preamble:
            body["systemInstruction"] = {"parts": [{"text": system_preamble}]}
        r = await self.client.post(url, headers=self._headers(token), json=body)
        r.raise_for_status()
        return self._json(r)

    @with_retry()
    async def embed(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> dict:
        token = await auth_manager.get_access_token()
        url = (
            f"https://{VERTEX_EMBEDDING_LOCATION}-aiplatform.googleapis.com/v1"
            f"/projects/{GOOGLE_PROJECT_NUMBER}/locations/{VERTEX_EMBEDDING_LOCATION}"
            f"/publishers/google/models/{VERTEX_EMBEDDING_MODEL}:predict"
        )
        payload = {"instances": [{"content": text, "task_type": task_type}]}
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = await self.client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        values = data["predictions"][0]["embeddings"]["values"]
        token_count = data["predictions"][0]["embeddings"].get("statistics", {}).get("token_count", 0)
        return {"embedding": values, "token_count": token_count}

# =============================================================================
# OBSIDIAN CLIENT — resilient, auto-reconnecting
# =============================================================================

class ObsidianClient:
    def __init__(self) -> None:
        self._available: Optional[bool] = None
        self._last_check: Optional[datetime] = None
        self._check_lock = asyncio.Lock()
        self._client: Optional[httpx.AsyncClient] = None
        self._consecutive_failures = 0
        self._build_client()

    def _build_client(self) -> None:
        try:
            verify: Any = True
            if not OBSIDIAN_VERIFY_TLS:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                verify = ctx
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(REQUEST_TIMEOUT, connect=5.0), verify=verify,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5))
        except Exception as e:
            logger.error(f"Failed to build Obsidian client: {e}")
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._build_client()
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            try: await self._client.aclose()
            except Exception: pass
        self._client = None

    def _get_headers(self) -> Dict[str, str]:
        h: Dict[str, str] = {}
        if OBSIDIAN_API_KEY:
            h["Authorization"] = f"Bearer {OBSIDIAN_API_KEY}"
        return h

    async def check_availability(self, force: bool = False) -> bool:
        async with self._check_lock:
            now = datetime.now(timezone.utc)
            if not force and self._available is not None and self._last_check:
                ttl = OBSIDIAN_HEALTH_CACHE_SECONDS if self._available else min(
                    OBSIDIAN_RECONNECT_INTERVAL, OBSIDIAN_HEALTH_CACHE_SECONDS)
                if (now - self._last_check).total_seconds() < ttl:
                    return self._available
            try:
                if self._client is None or self._client.is_closed:
                    self._build_client()
                resp = await self.client.get(f"{OBSIDIAN_API_URL}/",
                                             headers=self._get_headers(), timeout=5.0)
                was_down = self._available is False
                self._available = resp.status_code == 200
                self._last_check = now
                if self._available:
                    self._consecutive_failures = 0
                    if was_down:
                        logger.info("Obsidian API reconnected")
                else:
                    self._consecutive_failures += 1
            except Exception:
                self._consecutive_failures += 1
                self._available = False
                self._last_check = now
                if self._consecutive_failures >= 5:
                    await self.close()
                    self._build_client()
                    self._consecutive_failures = 0
            return self._available

    async def _do_request(self, method: str, endpoint: str, content: Optional[bytes] = None,
                          json_data: Optional[Dict[str, Any]] = None,
                          params: Optional[Dict[str, Any]] = None,
                          content_type: Optional[str] = None) -> Dict[str, Any]:
        url = f"{OBSIDIAN_API_URL}{endpoint}"
        headers = self._get_headers()
        if content_type:
            headers["Content-Type"] = content_type
        try:
            if self._client is None or self._client.is_closed:
                self._build_client()
            fn = getattr(self.client, method.lower())
            kw: Dict[str, Any] = {"headers": headers}
            if params: kw["params"] = params
            if content is not None: kw["content"] = content
            elif json_data is not None: kw["json"] = json_data
            resp = await fn(url, **kw)
            resp.raise_for_status()
            self._available = True
            self._last_check = datetime.now(timezone.utc)
            self._consecutive_failures = 0
            ct = resp.headers.get("content-type", "")
            if "application/json" in ct:
                try: return resp.json()
                except Exception: return {"content": resp.text, "success": True}
            elif resp.status_code == 204 or not resp.text:
                return {"success": True}
            return {"content": resp.text, "success": True}
        except httpx.HTTPStatusError as e:
            eb = ""
            try: eb = e.response.text[:200]
            except Exception: pass
            return {"success": False, "error": f"Obsidian API error: {e.response.status_code}",
                    "detail": eb, "available": True}
        except (httpx.ConnectError, httpx.ConnectTimeout):
            self._available = False; self._last_check = datetime.now(timezone.utc)
            self._consecutive_failures += 1
            return {"success": False, "error": "Obsidian connection failed.", "available": False}
        except (httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout):
            return {"success": False, "error": "Obsidian request timed out.", "available": True}
        except (httpx.NetworkError, ConnectionError, OSError, ssl.SSLError) as e:
            self._available = False; self._last_check = datetime.now(timezone.utc)
            self._consecutive_failures += 1
            if isinstance(e, ssl.SSLError) or self._consecutive_failures >= 3:
                await self.close(); self._build_client(); self._consecutive_failures = 0
            return {"success": False, "error": "Obsidian connection error.", "available": False}
        except Exception as e:
            return {"success": False, "error": f"Unexpected: {type(e).__name__}", "available": False}

    async def _ensure_available(self) -> bool:
        if await self.check_availability(): return True
        return await self.check_availability(force=True)

    async def read_note(self, fp: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        r = await self._do_request("GET", f"/vault/{fp}")
        if "content" in r: r["path"] = fp
        return r

    async def write_note(self, fp: str, content: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        r = await self._do_request("PUT", f"/vault/{fp}", content=content.encode("utf-8"),
                                   content_type="text/markdown")
        r.setdefault("success", r.get("available", True)); r["path"] = fp; return r

    async def append_note(self, fp: str, content: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        r = await self._do_request("POST", f"/vault/{fp}", content=content.encode("utf-8"),
                                   content_type="text/markdown")
        r.setdefault("success", r.get("available", True)); r["path"] = fp; return r

    async def search_vault(self, q: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("POST", "/search/simple/", json_data={"query": q})

    async def list_files(self, path: Optional[str] = None) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("GET", f"/vault/{path}/" if path else "/vault/")

    async def delete_note(self, fp: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        r = await self._do_request("DELETE", f"/vault/{fp}")
        r.setdefault("success", r.get("available", True)); r["path"] = fp; return r

    async def patch_note(self, fp: str, content: str, heading: Optional[str] = None,
                         block_ref: Optional[str] = None) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        p: Dict[str, Any] = {}
        if heading: p["heading"] = heading
        if block_ref: p["blockRef"] = block_ref
        r = await self._do_request("PATCH", f"/vault/{fp}", params=p,
                                   content=content.encode("utf-8"), content_type="text/markdown")
        r.setdefault("success", r.get("available", True)); r["path"] = fp; return r

    async def get_active_file(self) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("GET", "/active/")

    async def update_active_file(self, c: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("PUT", "/active/", content=c.encode("utf-8"),
                                      content_type="text/markdown")

    async def append_active_file(self, c: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("POST", "/active/", content=c.encode("utf-8"),
                                      content_type="text/markdown")

    async def delete_active_file(self) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("DELETE", "/active/")

    async def list_commands(self) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("GET", "/commands/")

    async def execute_command(self, cid: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("POST", f"/commands/{cid}/")

    async def open_file(self, fn: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("POST", f"/open/{fn}")

    async def get_periodic_note(self, period: str) -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        return await self._do_request("GET", f"/periodic/{period}/")

    async def advanced_search(self, q: str, qt: str = "text") -> Dict[str, Any]:
        if not await self._ensure_available(): return self._unavail()
        if qt == "dql":
            return await self._do_request("POST", "/search/", content=q.encode("utf-8"),
                                          content_type="application/vnd.olrapi.dataview.dql+txt")
        return await self._do_request("POST", "/search/simple/", json_data={"query": q})

    def _unavail(self) -> Dict[str, Any]:
        return {"success": False, "available": False,
                "error": "Obsidian not available. Will auto-reconnect."}

# =============================================================================
# RESPONSE NORMALIZATION — safe against ANY upstream shape
# =============================================================================

def _coerce_dict(raw: Any) -> Dict[str, Any]:
    """Non-dict → wrapped error dict. Never crashes on list/str/None/scalar."""
    if isinstance(raw, dict):
        return raw
    logger.warning(f"Expected dict from upstream, got {type(raw).__name__}")
    return {"_raw": raw, "_coerced": True}

def _safe_get(data: Any, *keys: str, default: Any = None) -> Any:
    cur = data
    for k in keys:
        if isinstance(cur, dict): cur = cur.get(k, default)
        else: return default
    return cur if cur is not None else default

def normalize_search_response(raw_response: Any) -> GatewayResponse:
    raw = _coerce_dict(raw_response)
    if raw.get("_coerced"):
        return GatewayResponse(answer="Unexpected response format.", metadata={"error": "non_dict"})
    results = raw.get("results") or []
    if not isinstance(results, list): results = []
    cits, snips = [], []
    for i, res in enumerate(results, 1):
        if not isinstance(res, dict): continue
        doc = res.get("document") or {}
        der = res.get("derivedStructData") or {}
        if not isinstance(doc, dict): doc = {}
        if not isinstance(der, dict): der = {}
        uri = der.get("link", "") or doc.get("id", "")
        title = der.get("title", f"Result {i}")
        cits.append(Citation(uri=str(uri), title=str(title), index=i))
        s = der.get("snippets")
        if isinstance(s, list):
            snips.extend([str(x.get("snippet", "")) for x in s if isinstance(x, dict) and x.get("snippet")])
    return GatewayResponse(answer="\n\n".join(snips) if snips else "No results found.",
                           citations=cits, metadata={"total_results": len(results), "search_type": "semantic"})

def normalize_answer_response(raw_response: Any) -> GatewayResponse:
    raw = _coerce_dict(raw_response)
    if raw.get("_coerced"):
        return GatewayResponse(answer="Unexpected response format.", metadata={"error": "non_dict"})

    def _slice(t: str, s: Any, e: Any) -> str:
        try:
            si, ei = max(int(s), 0), max(int(e), 0)
            if ei <= si: return ""
            return t.encode("utf-8")[si:ei].decode("utf-8", errors="ignore")
        except (TypeError, ValueError, AttributeError): return ""

    def _refm(ref: Dict[str, Any]) -> Dict[str, str]:
        for k in ("chunkInfo", "unstructuredDocumentInfo", "structuredDocumentInfo"):
            info = ref.get(k) or {}
            if not isinstance(info, dict): continue
            dm = info.get("documentMetadata") or info
            if not isinstance(dm, dict): continue
            u, t = dm.get("uri", ""), dm.get("title", "")
            if u or t: return {"uri": str(u), "title": str(t)}
        return {"uri": "", "title": ""}

    atxt = ""; cits: List[Citation] = []; gsup: List[GroundingSupport] = []; sid = None
    ad = raw.get("answer") or {}
    if isinstance(ad, dict):
        atxt = str(ad.get("answerText", "") or ad.get("text", ""))
        refs = ad.get("references") or []
        rm: Dict[str, Dict[str, str]] = {}
        for idx, ref in enumerate(refs if isinstance(refs, list) else []):
            if not isinstance(ref, dict): continue
            m = _refm(ref); rm[str(idx)] = m
            eid = ref.get("referenceId")
            if eid is not None: rm[str(eid)] = m
        seen = set()
        for ci, ct in enumerate(ad.get("citations") or [], 1):
            if not isinstance(ct, dict): continue
            for src in ct.get("sources") or []:
                if not isinstance(src, dict): continue
                rid = str(src.get("referenceId", ""))
                rd = rm.get(rid, {}); u = rd.get("uri", ""); t = rd.get("title", "") or f"Citation {ci}"
                key = (rid, u, t)
                if key in seen: continue
                seen.add(key); cits.append(Citation(uri=u, title=t, index=ci))
        for sup in ad.get("groundingSupports") or []:
            if not isinstance(sup, dict): continue
            seg = _slice(atxt, sup.get("startIndex", 0), sup.get("endIndex", 0))[:100]
            try: sc = max(0.0, min(1.0, float(sup.get("groundingScore", 0.0) or 0.0)))
            except (TypeError, ValueError): sc = 0.0
            gsup.append(GroundingSupport(segment=seg, score=sc, percentage=int(sc * 100)))
    sess = raw.get("session", "")
    if isinstance(sess, str) and sess:
        p = sess.split("/")
        if p: sid = p[-1]
    return GatewayResponse(answer=atxt or "No answer generated.", citations=cits,
                           grounding_support=gsup, session_id=sid,
                           metadata={"has_answer": bool(atxt), "citation_count": len(cits)})

def normalize_grounded_response(raw_response: Any) -> GatewayResponse:
    raw = _coerce_dict(raw_response)
    if raw.get("_coerced"):
        return GatewayResponse(answer="Unexpected response format.", metadata={"error": "non_dict"})
    atxt = ""; cits: List[Citation] = []; gsup: List[GroundingSupport] = []
    cands = raw.get("candidates") or []
    first_cand: Dict[str, Any] = {}
    if isinstance(cands, list) and cands:
        first_cand = cands[0] if isinstance(cands[0], dict) else {}
        parts = _safe_get(first_cand, "content", "parts", default=[])
        if isinstance(parts, list):
            atxt = " ".join([str(p.get("text", "")) for p in parts if isinstance(p, dict)])
    # Fix 1: groundingMetadata lives inside candidates[0], not at response root
    gr = first_cand.get("groundingMetadata") or {}
    if isinstance(gr, dict):
        for i, s in enumerate(gr.get("webSearchSources") or [], 1):
            if isinstance(s, dict):
                cits.append(Citation(uri=str(s.get("uri", "")),
                                     title=str(s.get("title", f"Web Source {i}")), index=i))
        for ch in gr.get("groundingChunks") or []:
            if not isinstance(ch, dict): continue
            wc = ch.get("web") or {}
            if isinstance(wc, dict) and wc:
                try: sc = max(0.0, min(1.0, float(ch.get("confidenceScore", 0.0) or 0.0)))
                except (TypeError, ValueError): sc = 0.0
                gsup.append(GroundingSupport(segment=str(wc.get("title", ""))[:100],
                                             score=sc, percentage=int(sc * 100)))
        # Also handle groundingSupports (segment-level citations)
        for sup in gr.get("groundingSupports") or []:
            if not isinstance(sup, dict): continue
            seg_data = sup.get("segment") or {}
            seg_text = str(seg_data.get("text", ""))[:100] if isinstance(seg_data, dict) else ""
            chunk_indices = sup.get("groundingChunkIndices") or []
            # Confidence not always present at support level; use 1.0 if grounded
            gsup.append(GroundingSupport(segment=seg_text, score=1.0, percentage=100))
    return GatewayResponse(answer=atxt or "No content generated.", citations=cits,
                           grounding_support=gsup,
                           metadata={"grounding_mode": "google_search" if cits else "vault",
                                     "support_count": len(gsup)})

def normalize_rank_response(raw_response: Any, original_records: List[RankRecord]) -> GatewayResponse:
    raw = _coerce_dict(raw_response)
    if raw.get("_coerced"):
        return GatewayResponse(answer="Unexpected response format.", metadata={"error": "non_dict"})
    ranked = raw.get("records") or []
    if not isinstance(ranked, list): ranked = []
    parts, cits, sups = [], [], []
    for i, rec in enumerate(ranked, 1):
        if not isinstance(rec, dict): continue
        try: sc = max(0.0, min(1.0, float(rec.get("score", 0.0) or 0.0)))
        except (TypeError, ValueError): sc = 0.0
        t = str(rec.get("title", ""))
        parts.append(f"{i}. {t} (score: {sc:.3f})")
        cits.append(Citation(uri=f"#record-{rec.get('id', i)}", title=t, index=i))
        sups.append(GroundingSupport(segment=t[:100], score=sc, percentage=int(sc * 100)))
    return GatewayResponse(
        answer="Ranked Results:\n" + "\n".join(parts) if parts else "No ranked results.",
        citations=cits, grounding_support=sups,
        metadata={"total_ranked": len(ranked), "original_count": len(original_records)})

# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

vertex_client: Optional[VertexSearchClient] = None
obsidian_client: Optional[ObsidianClient] = None
_pg_pool = None
_pgvector_ready = False


class VectorSearchRequest(BaseModel):
    embedding: List[float]
    top_k: int = Field(default=5, ge=1, le=100)


async def get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
        import asyncpg

        pg_dsn = os.environ.get("PG_DSN", "")
        if not pg_dsn:
            raise RuntimeError("PG_DSN is not configured")
        _pg_pool = await asyncpg.create_pool(dsn=pg_dsn)
    return _pg_pool


async def init_pgvector_schema():
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vault_embeddings (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                folder_path TEXT,
                tags TEXT[],
                embedding vector(1536) NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS vault_embeddings_embedding_idx
            ON vault_embeddings USING hnsw (embedding vector_cosine_ops)
            """
        )


async def ensure_pgvector_ready():
    global _pgvector_ready
    if not _pgvector_ready:
        await init_pgvector_schema()
        _pgvector_ready = True

def _check_vertex_config() -> List[str]:
    m = []
    if not GOOGLE_PROJECT_ID: m.append("GOOGLE_PROJECT_ID")
    if not GOOGLE_PROJECT_NUMBER: m.append("GOOGLE_PROJECT_NUMBER")
    if not GOOGLE_DATASTORE_ID: m.append("GOOGLE_DATASTORE_ID")
    if not GOOGLE_ENGINE_ID: m.append("GOOGLE_ENGINE_ID")
    return m

@asynccontextmanager
async def lifespan(app: FastAPI):
    global vertex_client, obsidian_client, _pg_pool, _pgvector_ready
    logger.info("Starting Gateway Service v3.1.0")
    vertex_ok = False
    miss = _check_vertex_config()
    if miss:
        logger.warning("Vertex config incomplete", extra={"extra_data": {"missing": miss}})
    else:
        try: vertex_ok = await auth_manager.initialize()
        except Exception as e: logger.error(f"Auth init failed: {e}")
    if vertex_ok:
        vertex_client = VertexSearchClient()
        logger.info("Vertex AI Search client initialized")
    else:
        logger.warning("Vertex AI Search unavailable")
    obsidian_client = ObsidianClient()
    obs_ok = await obsidian_client.check_availability()
    try:
        await init_pgvector_schema()
        _pgvector_ready = True
    except Exception as e:
        logger.warning(f"pgvector init deferred (will retry on first request): {e}")
    logger.info("Gateway started (vertex=%s, obsidian=%s)", vertex_ok, obs_ok)
    yield
    logger.info("Shutting down")
    if vertex_client: await vertex_client.close()
    if obsidian_client: await obsidian_client.close()
    if _pg_pool:
        await _pg_pool.close()
        _pg_pool = None

app = FastAPI(title="Vertex AI Search + Obsidian Gateway", version="3.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(HTTPException)
async def _http_exc(req: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code,
                 "timestamp": datetime.now(timezone.utc).isoformat()})

@app.exception_handler(Exception)
async def _gen_exc(req: Request, exc: Exception):
    logger.error("Unhandled exception", extra={"extra_data": {"error": str(exc),
                 "type": type(exc).__name__, "path": req.url.path}})
    return JSONResponse(status_code=500, content={"error": "Internal server error",
                        "status_code": 500, "timestamp": datetime.now(timezone.utc).isoformat()})

def _req_vertex() -> VertexSearchClient:
    if vertex_client is None:
        raise HTTPException(503, "Vertex AI Search not available.")
    return vertex_client

def _req_obsidian() -> ObsidianClient:
    if obsidian_client is None:
        raise HTTPException(503, "Obsidian client not initialized.")
    return obsidian_client

def _obs_resp(result: Dict[str, Any], sc: int = 200):
    if result.get("available") is False:
        return JSONResponse(status_code=503, content=result)
    if result.get("success") is False:
        return JSONResponse(status_code=502, content=result)
    return JSONResponse(status_code=sc, content=result)

# =============================================================================
# HEALTH — honest aggregate status
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    svcs: Dict[str, Any] = {}
    n_healthy = 0; n_total = 0

    # Vertex AI
    n_total += 1
    if vertex_client and auth_manager.is_available:
        try:
            await auth_manager.get_access_token()
            svcs["vertex_ai"] = {"status": "healthy", "detail": "Token valid"}
            n_healthy += 1
        except Exception as e:
            svcs["vertex_ai"] = {"status": "unhealthy", "detail": str(e)[:100]}
    else:
        svcs["vertex_ai"] = {"status": "unavailable", "detail": "Not configured"}

    # Obsidian
    n_total += 1
    if obsidian_client:
        try:
            if await obsidian_client.check_availability():
                svcs["obsidian"] = {"status": "healthy", "detail": "Connected"}
                n_healthy += 1
            else:
                svcs["obsidian"] = {"status": "unavailable", "detail": "Not connected"}
        except Exception as e:
            svcs["obsidian"] = {"status": "error", "detail": str(e)[:100]}
    else:
        svcs["obsidian"] = {"status": "unknown", "detail": "Not initialized"}

    # Aggregate: healthy ONLY if all services healthy
    if n_healthy == n_total:
        overall = "healthy"
    elif n_healthy > 0:
        overall = "degraded"
    else:
        overall = "unhealthy"

    return HealthResponse(status=overall, timestamp=datetime.now(timezone.utc).isoformat(),
                          services=svcs)

@app.get("/")
async def root():
    return {"service": "Vertex AI Search + Obsidian Gateway", "version": "3.1.0",
            "endpoints": {"search": "/v1/search", "answer": "/v1/answer", "rank": "/v1/rank",
                          "grounded": "/v1/grounded", "vault_read": "/vault/{filepath}",
                          "vault_search": "/vault-search", "health": "/health",
                          "mcp": "/mcp"}}

# --- Vertex endpoints ---

@app.post("/v1/search", response_model=GatewayResponse)
async def ep_search(request: SearchRequest):
    c = _req_vertex()
    try:
        return normalize_search_response(await c.semantic_search(request.query, request.page_size, request.filter_expr))
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Vertex Search error: {e.response.text[:300]}")
    except Exception as e:
        raise HTTPException(500, f"Search failed: {type(e).__name__}")

@app.post("/v1/answer", response_model=GatewayResponse)
async def ep_answer(request: AnswerRequest):
    c = _req_vertex()
    try:
        return normalize_answer_response(await c.conversational_answer(request.query, request.session_id, request.preamble, request.mode))
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Vertex Answer error: {e.response.text[:300]}")
    except Exception as e:
        raise HTTPException(500, f"Answer failed: {type(e).__name__}")

@app.post("/v1/rank", response_model=GatewayResponse)
async def ep_rank(request: RankRequest):
    c = _req_vertex()
    try:
        return normalize_rank_response(await c.semantic_rank(request.query, request.records, request.top_n), request.records)
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Vertex Rank error: {e.response.text[:300]}")
    except Exception as e:
        raise HTTPException(500, f"Ranking failed: {type(e).__name__}")


@app.post("/v1/vector-upsert")
async def v1_vector_upsert(req: VectorUpsertRequest):
    await ensure_pgvector_ready()
    import hashlib

    content_hash = hashlib.sha256(req.content.encode()).hexdigest()
    try:
        client = _req_vertex()
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT content_hash FROM vault_embeddings WHERE id = $1", req.id
            )
            if existing and existing["content_hash"] == content_hash:
                return {"success": True, "indexed": False, "reason": "unchanged"}
        result = await client.embed(req.content[:8000], "RETRIEVAL_DOCUMENT")
        embedding = result["embedding"]
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO vault_embeddings (id, content_hash, embedding, folder_path, tags, updated_at)
                VALUES ($1, $2, $3::vector, $4, $5, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    content_hash = EXCLUDED.content_hash,
                    embedding = EXCLUDED.embedding,
                    folder_path = EXCLUDED.folder_path,
                    tags = EXCLUDED.tags,
                    updated_at = NOW()
                """,
                req.id,
                content_hash,
                str(embedding),
                req.folder_path,
                req.tags,
            )
        return {"success": True, "indexed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vector upsert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/vector-search")
async def v1_vector_search(req: VectorSearchRequest):
    await ensure_pgvector_ready()
    try:
        client = _req_vertex()
        pool = await get_pg_pool()
        result = await client.embed(req.query[:4000], "RETRIEVAL_QUERY")
        embedding = result["embedding"]
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, folder_path, tags,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM vault_embeddings
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                str(embedding),
                req.limit,
            )
        results: List[VectorSearchResult] = [
            VectorSearchResult(
                id=r["id"],
                folder_path=r["folder_path"],
                tags=list(r["tags"] or []),
                similarity=float(r["similarity"]),
            )
            for r in rows
        ]
        return {"success": True, "results": [result.model_dump() for result in results]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vector search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/grounded", response_model=GatewayResponse)
async def ep_grounded(request: GroundedRequest):
    c = _req_vertex()
    try:
        return normalize_grounded_response(await c.generate_grounded_content(request.query, request.mode, request.system_preamble))
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Grounded error: {e.response.text[:300]}")
    except Exception as e:
        raise HTTPException(500, f"Grounded generation failed: {type(e).__name__}")

@app.post("/v1/embed")
async def v1_embed(req: EmbedRequest):
    try:
        client = _req_vertex()
        result = await client.embed(req.text, req.task_type)
        return {"success": True, "embedding": result["embedding"], "token_count": result["token_count"]}
    except Exception as e:
        logger.error(f"Embed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Obsidian proxy endpoints ---

@app.get("/vault/{fp:path}")
async def v_read(fp: str): return _obs_resp(await _req_obsidian().read_note(fp))
@app.post("/vault/{fp:path}")
async def v_append(fp: str, r: VaultWriteRequest): return _obs_resp(await _req_obsidian().append_note(fp, r.content))
@app.put("/vault/{fp:path}")
async def v_write(fp: str, r: VaultWriteRequest): return _obs_resp(await _req_obsidian().write_note(fp, r.content))
@app.patch("/vault/{fp:path}")
async def v_patch(fp: str, r: VaultWriteRequest, heading: Optional[str] = Query(None), block_ref: Optional[str] = Query(None)):
    return _obs_resp(await _req_obsidian().patch_note(fp, r.content, heading, block_ref))
@app.delete("/vault/{fp:path}")
async def v_del(fp: str): return _obs_resp(await _req_obsidian().delete_note(fp))
@app.get("/vault-search")
async def v_search(query: str = Query(...)): return _obs_resp(await _req_obsidian().search_vault(query))
@app.get("/vault")
async def v_list(): return _obs_resp(await _req_obsidian().list_files())
@app.get("/vault/dir/{path:path}")
async def v_listdir(path: str): return _obs_resp(await _req_obsidian().list_files(path))
@app.get("/active")
async def a_get(): return _obs_resp(await _req_obsidian().get_active_file())
@app.put("/active")
async def a_put(r: VaultWriteRequest): return _obs_resp(await _req_obsidian().update_active_file(r.content))
@app.post("/active/append")
async def a_app(r: VaultWriteRequest): return _obs_resp(await _req_obsidian().append_active_file(r.content))
@app.delete("/active")
async def a_del(): return _obs_resp(await _req_obsidian().delete_active_file())
@app.get("/commands")
async def c_list(): return _obs_resp(await _req_obsidian().list_commands())
@app.post("/commands/{cid}")
async def c_exec(cid: str): return _obs_resp(await _req_obsidian().execute_command(cid))
@app.post("/open/{fn:path}")
async def o_open(fn: str): return _obs_resp(await _req_obsidian().open_file(fn))
@app.get("/periodic/{period}")
async def p_get(period: str): return _obs_resp(await _req_obsidian().get_periodic_note(period))
@app.post("/vault-search/advanced")
async def v_adv(query: str = Query(...), query_type: str = Query("text")):
    return _obs_resp(await _req_obsidian().advanced_search(query, query_type))

# =============================================================================
# Fix 2: MCP SERVER — exposes all FastAPI routes as MCP tools
# =============================================================================

try:
    from fastapi_mcp import FastApiMCP

    mcp = FastApiMCP(
        app,
        name="vertex-gateway",
        description="Vertex AI Search + Obsidian Gateway — semantic search, "
                    "conversational answers, grounded generation, ranking, "
                    "and Obsidian vault management",
    )
    mcp.mount()  # Streamable HTTP at /mcp
    logger.info("MCP server mounted at /mcp")
except ImportError:
    logger.warning("fastapi-mcp not installed — MCP endpoint disabled. "
                   "Install with: pip install fastapi-mcp")
except Exception as _mcp_err:
    logger.error(f"MCP mount failed: {_mcp_err}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gateway:app", host="0.0.0.0", port=SERVICE_PORT, log_level="info", access_log=True)
