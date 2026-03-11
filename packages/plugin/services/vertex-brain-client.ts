import { requestUrl } from "obsidian";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

export class VertexBrainClient {
  constructor(private readonly baseUrl: string) {}

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

  async embed(input: { text: string }): Promise<any> {
    const resp = await withTimeout(
      requestUrl({
        url: `${this.baseUrl}/v1/embed`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
      }),
      30000
    );
    return resp.json;
  }

  async vectorUpsert(input: {
    id: string;
    content: string;
    embedding: number[];
  }): Promise<any> {
    const resp = await withTimeout(
      requestUrl({
        url: `${this.baseUrl}/v1/vector/upsert`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
      }),
      30000
    );
    return resp.json;
  }

  async vectorSearch(input: {
    embedding: number[];
    top_k?: number;
  }): Promise<any> {
    const resp = await withTimeout(
      requestUrl({
        url: `${this.baseUrl}/v1/vector/search`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
      }),
      30000
    );
    return resp.json;
  }

  async rank(input: {
    query: string;
    records: Array<{ id: string; title: string; content: string }>;
    top_n?: number;
  }): Promise<any> {
    const resp = await withTimeout(
      requestUrl({
        url: `${this.baseUrl}/v1/rank`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
      }),
      30000
    );
    return resp.json;
  }

  async answer(input: {
    query: string;
    session_id?: string;
    preamble?: string;
    mode?: "vault" | "google";
  }): Promise<any> {
    const resp = await withTimeout(
      requestUrl({
        url: `${this.baseUrl}/v1/answer`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
      }),
      30000
    );
    return resp.json;
  }
}
