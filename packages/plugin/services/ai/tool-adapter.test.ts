import { createPluginTools } from "./tool-adapter";

describe("createPluginTools", () => {
  it("returns a ToolSet with all expected tools", () => {
    const tools = createPluginTools();
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("getSearchQuery");
    expect(toolNames).toContain("getLastModifiedFiles");
    expect(toolNames).toContain("openFile");
    expect(toolNames).toContain("moveFiles");
    expect(toolNames).toContain("renameFiles");
    expect(toolNames).toHaveLength(5);
  });

  it("each tool has inputSchema but no execute function", () => {
    const tools = createPluginTools();
    for (const [, t] of Object.entries(tools)) {
      expect(t.inputSchema).toBeDefined();
      // Tools without execute return undefined for tool.execute
      // The AI SDK handles this as "client-side execution"
      expect((t as any).execute).toBeUndefined();
    }
  });
});
