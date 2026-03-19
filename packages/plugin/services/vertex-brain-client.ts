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
            ...(plugin.getApiKey()
              ? { Authorization: `Bearer ${plugin.getApiKey()}` }
              : {}),
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: context }],
            model: plugin.settings.selectedModel,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        return {
          answer: data.choices?.[0]?.message?.content ?? "",
        };
      } catch (error) {
        console.error("[VertexBrainClient] answer failed:", error);
        return { answer: "" };
      }
    },
  };
}
