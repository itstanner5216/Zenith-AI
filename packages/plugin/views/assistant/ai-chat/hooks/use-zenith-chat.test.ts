/**
 * @jest-environment jsdom
 *
 * Tests for useZenithChat hook.
 * Uses jsdom + @testing-library/react renderHook for behavioral tests.
 */

import { renderHook, act } from "@testing-library/react";
import { useZenithChat } from "./use-zenith-chat";
import type { ChatStatus, UseZenithChatOptions, UseZenithChatReturn } from "./use-zenith-chat";

// Build a mock AIService with a controllable async generator for fullStream
function makeFullStream(events: any[]) {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

const makeAIService = (streamEvents: any[] = [{ type: "text-delta", text: "hello" }]) => ({
  streamChat: jest.fn(() => ({ fullStream: makeFullStream(streamEvents) })),
  getActiveModel: jest.fn(),
  validateKey: jest.fn(),
  getModelForConfig: jest.fn(),
});

// ─── Type contract tests (no render needed) ──────────────────────────────────

describe("useZenithChat type contracts", () => {
  it("ChatStatus accepts exactly 'ready', 'submitted', and 'streaming'", () => {
    const s1: ChatStatus = "ready";
    const s2: ChatStatus = "submitted";
    const s3: ChatStatus = "streaming";
    expect([s1, s2, s3]).toEqual(["ready", "submitted", "streaming"]);
  });

  it("UseZenithChatOptions accepts required aiService and all optional fields", () => {
    const svc = makeAIService();
    const full: UseZenithChatOptions = {
      aiService: svc as any,
      tools: undefined,
      maxSteps: 10,
      onFinish: jest.fn() as any,
      onError: jest.fn() as any,
      onStepFinish: jest.fn() as any,
    };
    expect(full.maxSteps).toBe(10);
  });

  it("UseZenithChatReturn typed object contains all required fields", () => {
    const mockReturn: UseZenithChatReturn = {
      messages: [],
      status: "ready",
      error: null,
      sendMessage: jest.fn() as any,
      addToolResult: jest.fn() as any,
      stop: jest.fn() as any,
      reload: jest.fn() as any,
      setMessages: jest.fn() as any,
    };
    expect(Object.keys(mockReturn)).toHaveLength(8);
    expect(mockReturn.error).toBeNull();
  });

  it("fullStream mock yields text-delta with .text (AI SDK v5, not .textDelta)", async () => {
    const events: any[] = [];
    for await (const e of makeFullStream([{ type: "text-delta", text: "hi" }])) {
      events.push(e);
    }
    expect(events[0]).toHaveProperty("text", "hi");
    expect(events[0]).not.toHaveProperty("textDelta");
  });

  it("makeAIService creates a mock satisfying all AIService methods", () => {
    const svc = makeAIService();
    for (const m of ["streamChat", "getActiveModel", "validateKey", "getModelForConfig"]) {
      expect(jest.isMockFunction((svc as any)[m])).toBe(true);
    }
  });
});

// ─── Behavioral tests via renderHook ─────────────────────────────────────────

describe("useZenithChat behavior", () => {
  it("initial state is ready with empty messages and no error", () => {
    const { result } = renderHook(() =>
      useZenithChat({ aiService: makeAIService() as any })
    );
    expect(result.current.status).toBe("ready");
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("sendMessage adds a user message immediately", async () => {
    const svc = makeAIService([]);
    const { result } = renderHook(() => useZenithChat({ aiService: svc as any }));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const userMsg = result.current.messages.find(m => m.role === "user");
    expect(userMsg).toBeDefined();
    expect((userMsg!.parts[0] as any).text).toBe("hello");
  });

  it("sendMessage triggers streamChat on the AIService", async () => {
    const svc = makeAIService([]);
    const { result } = renderHook(() => useZenithChat({ aiService: svc as any }));

    await act(async () => {
      await result.current.sendMessage("ping");
    });

    expect(svc.streamChat).toHaveBeenCalledTimes(1);
  });

  it("streaming text-delta events accumulate into assistant message", async () => {
    const svc = makeAIService([
      { type: "text-delta", text: "hel" },
      { type: "text-delta", text: "lo" },
    ]);
    const { result } = renderHook(() => useZenithChat({ aiService: svc as any }));

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const assistant = result.current.messages.find(m => m.role === "assistant");
    expect(assistant).toBeDefined();
    const textPart = assistant!.parts.find((p: any) => p.type === "text") as any;
    expect(textPart?.text).toBe("hello");
  });

  it("status returns to 'ready' after stream completes", async () => {
    const svc = makeAIService([{ type: "text-delta", text: "done" }]);
    const { result } = renderHook(() => useZenithChat({ aiService: svc as any }));

    await act(async () => {
      await result.current.sendMessage("go");
    });

    expect(result.current.status).toBe("ready");
  });

  it("onFinish is called with the final assistant message", async () => {
    const onFinish = jest.fn();
    const svc = makeAIService([{ type: "text-delta", text: "result" }]);
    const { result } = renderHook(() =>
      useZenithChat({ aiService: svc as any, onFinish })
    );

    await act(async () => {
      await result.current.sendMessage("test");
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    const msg = onFinish.mock.calls[0][0];
    expect(msg.role).toBe("assistant");
  });

  it("stop() aborts the stream without throwing", async () => {
    const { result } = renderHook(() =>
      useZenithChat({ aiService: makeAIService() as any })
    );
    expect(() => act(() => { result.current.stop(); })).not.toThrow();
  });

  it("setMessages replaces the messages array", () => {
    const { result } = renderHook(() =>
      useZenithChat({ aiService: makeAIService() as any })
    );
    act(() => {
      result.current.setMessages([
        { id: "1", role: "user", parts: [{ type: "text" as const, text: "hi" }] },
      ]);
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("addToolResult updates matching tool part state to output-available", async () => {
    const svc = makeAIService([
      { type: "tool-call", toolName: "search", toolCallId: "tc-1", input: { query: "test" } },
    ]);
    const { result } = renderHook(() => useZenithChat({ aiService: svc as any }));

    await act(async () => {
      await result.current.sendMessage("search for something");
    });

    act(() => {
      result.current.addToolResult({ toolCallId: "tc-1", result: "found it" });
    });

    const assistant = result.current.messages.find(m => m.role === "assistant");
    const toolPart = assistant?.parts.find(
      (p: any) => p.type.startsWith("tool-") && p.toolCallId === "tc-1"
    ) as any;
    expect(toolPart?.state).toBe("output-available");
    expect(toolPart?.output).toBe("found it");
  });
});

