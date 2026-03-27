/**
 * Boundary cast tests for buildPluginToolPart, withOutput, and isPluginToolPart.
 *
 * These are the only places where `unknown` inputs/outputs are cast to typed
 * values, so they deserve their own focused tests.
 */

import { buildPluginToolPart, withOutput, isPluginToolPart } from "./types";

const TOOLS = [
  "getSearchQuery",
  "getLastModifiedFiles",
  "openFile",
  "moveFiles",
  "renameFiles",
] as const;
type PluginToolName = typeof TOOLS[number];

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

// ─── buildPluginToolPart ──────────────────────────────────────────────────────

describe("buildPluginToolPart", () => {
  it("returns null for an unknown tool name", () => {
    expect(buildPluginToolPart("unknownTool", "id-x", {})).toBeNull();
  });

  for (const name of TOOLS) {
    const callId = `tcid-${name}`;
    const input = STUB_INPUTS[name];

    it(`${name}: returns a non-null part`, () => {
      expect(buildPluginToolPart(name, callId, input)).not.toBeNull();
    });

    it(`${name}: type field is "tool-${name}"`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      expect(part.type).toBe(`tool-${name}`);
    });

    it(`${name}: state is "input-available"`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      expect(part.state).toBe("input-available");
    });

    it(`${name}: toolCallId matches what was passed in`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      expect(part.toolCallId).toBe(callId);
    });

    it(`${name}: input matches what was passed in`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      expect(part.input).toBe(input);
    });
  }
});

// ─── withOutput ──────────────────────────────────────────────────────────────

describe("withOutput", () => {
  for (const name of TOOLS) {
    const callId = `tcid-out-${name}`;
    const input = STUB_INPUTS[name];
    const output = STUB_OUTPUTS[name];

    it(`${name}: transitions state to "output-available"`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      const result = withOutput(part, output);
      expect(result.state).toBe("output-available");
    });

    it(`${name}: output matches what was passed in`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      const result = withOutput(part, output);
      expect((result as { output: unknown }).output).toBe(output);
    });

    it(`${name}: type, toolCallId, and input are preserved`, () => {
      const part = buildPluginToolPart(name, callId, input)!;
      const result = withOutput(part, output);
      expect(result.type).toBe(part.type);
      expect(result.toolCallId).toBe(callId);
      expect(result.input).toBe(input);
    });
  }
});

// ─── isPluginToolPart ─────────────────────────────────────────────────────────

describe("isPluginToolPart", () => {
  for (const name of TOOLS) {
    it(`returns true for a valid ${name} part`, () => {
      const part = buildPluginToolPart(name, "id", STUB_INPUTS[name])!;
      expect(isPluginToolPart(part)).toBe(true);
    });
  }

  it('returns false for { type: "text" }', () => {
    expect(isPluginToolPart({ type: "text" })).toBe(false);
  });

  it('returns false for { type: "tool-unknownTool" }', () => {
    expect(isPluginToolPart({ type: "tool-unknownTool" })).toBe(false);
  });

  it('returns false for { type: "dynamic-tool" }', () => {
    expect(isPluginToolPart({ type: "dynamic-tool" })).toBe(false);
  });
});
