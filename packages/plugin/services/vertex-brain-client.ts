import type ZenithAI from "../index";

export interface VaultSearchResult {
  folder_path: string;
  file_path: string;
  content: string;
}

export interface VertexBrainClient {
  vectorSearch(query: string, limit: number): Promise<VaultSearchResult[]>;
  answer(context: string): Promise<{ answer: string }>;
}

export function createBrainClient(plugin: ZenithAI): VertexBrainClient {
  return {
    async vectorSearch(_query: string, _limit: number): Promise<VaultSearchResult[]> {
      // TODO: Wire to actual vector/embedding search when available
      return [];
    },
    async answer(context: string): Promise<{ answer: string }> {
      try {
        const response = await fetch(`${plugin.getServerUrl()}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: context }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        // /api/chat returns an AI SDK v4 data stream (not JSON)
        // Read the stream and extract text content from "0:" prefixed lines
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2));
                if (typeof text === "string") {
                  fullText += text;
                }
              } catch {
                // Not valid JSON, skip
              }
            }
          }
        }

        return { answer: fullText };
      } catch (error) {
        console.error("[VertexBrainClient] answer failed:", error);
        return { answer: "" };
      }
    },
  };
}
