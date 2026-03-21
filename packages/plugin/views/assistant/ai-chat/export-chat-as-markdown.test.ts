import type { UIMessage } from "ai";
import { messagesToMarkdown, copyChatToClipboard } from "./export-chat-as-markdown";

jest.mock("../../../fileUtils", () => ({
  safeCreate: jest.fn().mockResolvedValue({ path: "Chat exports/test 2024-01-15.md" }),
}));

jest.mock("../../../someUtils", () => ({
  sanitizeFileName: jest.fn((s: string) => s),
}));

jest.mock("./services/chat-history-manager", () => ({
  ChatHistoryManager: {
    generateTitleFromMessages: jest.fn((msgs: any[]) => {
      const first = msgs.find((m: any) => m.role === "user");
      return first?.content?.substring(0, 50) || "New Chat";
    }),
  },
}));

const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(global, "navigator", {
  value: { clipboard: { writeText: mockWriteText } },
  writable: true,
});

// Local type that extends UIMessage with the legacy `content` and helper fields
// the source code casts to access.
type TestMessage = {
  id: string;
  role: "user" | "assistant";
  content?: string | Array<{ type?: string; text?: string }>;
  parts: any[];
  createdAt?: Date | string | number;
  toolInvocations?: any[];
};

let _id = 0;
function makeMessage(
  role: "user" | "assistant",
  content: string,
  extras?: Partial<TestMessage>
): TestMessage {
  return { id: `msg-${++_id}`, role, content, parts: [], ...extras };
}

beforeEach(() => {
  mockWriteText.mockClear();
  _id = 0;
});

// ---------------------------------------------------------------------------
// messagesToMarkdown
// ---------------------------------------------------------------------------

describe("messagesToMarkdown", () => {
  it("returns empty string for empty messages array", () => {
    const result = messagesToMarkdown([] as unknown as UIMessage[]);
    expect(result).toBe("");
  });

  it("produces ## User heading with message content for a user message", () => {
    const msgs = [makeMessage("user", "Hello world")] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    expect(result).toContain("## User");
    expect(result).toContain("Hello world");
    expect(result).not.toContain("## Assistant");
  });

  it("produces ## Assistant heading with message content for an assistant message", () => {
    const msgs = [makeMessage("assistant", "I can help with that")] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    expect(result).toContain("## Assistant");
    expect(result).toContain("I can help with that");
    expect(result).not.toContain("## User");
  });

  it("renders user then assistant in correct order", () => {
    const msgs = [
      makeMessage("user", "What is 2+2?"),
      makeMessage("assistant", "It is 4."),
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    const userIdx = result.indexOf("## User");
    const assistantIdx = result.indexOf("## Assistant");
    expect(userIdx).toBeGreaterThanOrEqual(0);
    expect(assistantIdx).toBeGreaterThan(userIdx);
    expect(result).toContain("What is 2+2?");
    expect(result).toContain("It is 4.");
  });

  it("includes YAML frontmatter and # heading when title option is provided", () => {
    const msgs = [makeMessage("user", "Test")] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs, { title: "My Chat Session" });
    expect(result).toContain("---");
    expect(result).toContain("title: My Chat Session");
    expect(result).toContain('source: "Zenith-AI Chat"');
    expect(result).toContain("date:");
    expect(result).toContain("# My Chat Session");
  });

  it("omits timestamp lines when includeTimestamps is false", () => {
    const msgs = [
      makeMessage("user", "Test message", { createdAt: new Date("2024-06-01T10:00:00.000Z") }),
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs, { includeTimestamps: false });
    // Timestamps appear as *YYYY-MM-DD HH:mm* — verify none present
    expect(result).not.toMatch(/\*\d{4}-\d{2}-\d{2}/);
  });

  it("renders tool call as **Tool (name):** result in assistant message", () => {
    const msgs = [
      {
        id: "msg-tool-1",
        role: "assistant",
        content: "Let me search for that.",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolCallId: "call_abc123",
              toolName: "webSearch",
              result: "Found 5 results",
            },
          },
        ],
      },
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    expect(result).toContain("**Tool (webSearch):** Found 5 results");
  });

  it("omits tool calls when includeToolCalls is false", () => {
    const msgs = [
      {
        id: "msg-tool-2",
        role: "assistant",
        content: "Let me check that.",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolCallId: "call_xyz789",
              toolName: "readFile",
              result: "file contents here",
            },
          },
        ],
      },
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs, { includeToolCalls: false });
    expect(result).not.toContain("**Tool");
    expect(result).not.toContain("readFile");
  });

  it("joins array-content parts into a single text block", () => {
    const msgs = [
      {
        id: "msg-arr-1",
        role: "user",
        content: [
          { type: "text", text: "First paragraph" },
          { type: "text", text: "Second paragraph" },
        ],
        parts: [],
      },
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
  });

  it("truncates tool result longer than 200 chars with ellipsis", () => {
    const longResult = "x".repeat(250);
    const msgs = [
      {
        id: "msg-long-1",
        role: "assistant",
        content: "Analyzing...",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolCallId: "call_long1",
              toolName: "bigTool",
              result: longResult,
            },
          },
        ],
      },
    ] as unknown as UIMessage[];
    const result = messagesToMarkdown(msgs);
    const toolLine = result.split("\n").find((l) => l.startsWith("**Tool (bigTool):**"));
    expect(toolLine).toBeDefined();
    expect(toolLine).toContain("…");
    // 200-char slice + ellipsis = 201 chars after the "**Tool (bigTool):** " prefix
    const summary = toolLine!.replace("**Tool (bigTool):** ", "");
    expect(summary.endsWith("…")).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(201);
  });
});

// ---------------------------------------------------------------------------
// copyChatToClipboard
// ---------------------------------------------------------------------------

describe("copyChatToClipboard", () => {
  it("calls navigator.clipboard.writeText with markdown containing message content", async () => {
    const msgs = [makeMessage("user", "clipboard test")] as unknown as UIMessage[];
    await copyChatToClipboard(msgs, null);
    expect(mockWriteText).toHaveBeenCalledTimes(1);
    const written: string = mockWriteText.mock.calls[0][0];
    expect(written).toContain("## User");
    expect(written).toContain("clipboard test");
  });

  it("includes sessionTitle in frontmatter when provided", async () => {
    const msgs = [makeMessage("user", "hello")] as unknown as UIMessage[];
    await copyChatToClipboard(msgs, "My Export Title");
    expect(mockWriteText).toHaveBeenCalledTimes(1);
    const written: string = mockWriteText.mock.calls[0][0];
    expect(written).toContain("title: My Export Title");
    expect(written).toContain("# My Export Title");
    expect(written).toContain("---");
  });
});
