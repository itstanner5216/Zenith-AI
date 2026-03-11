import { requestUrl } from "obsidian";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

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

interface RankSupport {
  segment: string;
  score: number;
}

export class VertexBrainClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async health(): Promise<boolean> {
    try {
      const resp = await withTimeout(
        requestUrl({ url: `${this.baseUrl}/health` }),
        5000
      );
      return resp.json?.status !== "unhealthy";
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const resp = await withTimeout(requestUrl({
      url: `${this.baseUrl}/v1/embed`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 8000) }),
    }), 30000);
    return resp.json.embedding;
  }

  async vectorUpsert(params: {
    id: string;
    content: string;
    folder_path: string;
    tags: string[];
  }): Promise<{ indexed: boolean }> {
    const resp = await withTimeout(requestUrl({
      url: `${this.baseUrl}/v1/vector-upsert`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }), 30000);
    return resp.json;
  }

  async vectorSearch(
    query: string,
    limit = 20
  ): Promise<VaultSearchResult[]> {
    const resp = await withTimeout(requestUrl({
      url: `${this.baseUrl}/v1/vector-search`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.slice(0, 4000), limit }),
    }), 30000);
    return resp.json.results ?? [];
  }

  async rank(
    query: string,
    records: RankRecord[]
  ): Promise<Array<{ title: string; score: number }>> {
    const resp = await withTimeout(requestUrl({
      url: `${this.baseUrl}/v1/rank`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, records }),
    }), 30000);
    return (resp.json.grounding_support ?? []).map((s: RankSupport) => ({
      title: s.segment,
      score: s.score,
    }));
  }

  async answer(
    query: string,
    sessionId?: string
  ): Promise<{ answer: string; session_id?: string; citations: unknown[] }> {
    const resp = await withTimeout(requestUrl({
      url: `${this.baseUrl}/v1/answer`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, session_id: sessionId, mode: "vault" }),
    }), 30000);
    return resp.json;
  }
}
