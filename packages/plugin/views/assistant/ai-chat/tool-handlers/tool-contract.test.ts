/**
 * Tool contract completeness tests.
 *
 * Asserts that every known plugin tool name is fully wired:
 *  1. A schema key exists in createPluginTools()
 *  2. buildPluginToolPart() returns a non-null part
 *  3. withOutput() transitions the part without throwing
 */

import { buildPluginToolPart, withOutput } from "./types";
import { createPluginTools } from "../../../../services/ai/tool-adapter";

const ALL_TOOL_NAMES = [
  "getSearchQuery",
  "getLastModifiedFiles",
  "openFile",
  "moveFiles",
  "renameFiles",
] as const;
type PluginToolName = typeof ALL_TOOL_NAMES[number];

const STUB_INPUTS: Record<PluginToolName, unknown> = {
  getSearchQuery: { query: "test" },
  getLastModifiedFiles: {},
  openFile: { filePath: "test.md" },
  moveFiles: { filePaths: ["a.md"], destinationFolder: "folder" },
  renameFiles: { renames: [{ oldPath: "a.md", newName: "b" }] },
};

const STUB_OUTPUTS: Record<PluginToolName, unknown> = {
  getSearchQuery: [],
  getLastModifiedFiles: { success: true, files: [], count: 0 },
  openFile: { success: true, message: "ok" },
  moveFiles: { success: true, results: [] },
  renameFiles: { success: true, results: [] },
};

describe("Tool contract completeness", () => {
  const tools = createPluginTools();

  for (const name of ALL_TOOL_NAMES) {
    it(`${name}: has a schema registered in createPluginTools()`, () => {
      expect(tools).toHaveProperty(name);
      expect(tools[name]).toBeDefined();
    });

    it(`${name}: buildPluginToolPart() returns a non-null part`, () => {
      const part = buildPluginToolPart(name, `id-${name}`, STUB_INPUTS[name]);
      expect(part).not.toBeNull();
    });

    it(`${name}: withOutput() does not throw`, () => {
      const part = buildPluginToolPart(name, `id-${name}`, STUB_INPUTS[name]);
      expect(part).not.toBeNull();
      expect(() => withOutput(part!, STUB_OUTPUTS[name])).not.toThrow();
    });
  }

  it("default case: buildPluginToolPart returns null for unknown tool name", () => {
    expect(buildPluginToolPart("unknownTool", "id", {})).toBeNull();
  });
});
