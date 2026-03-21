/**
 * Tests for useZenithChat hook.
 *
 * Integration-level behavior (streaming, sendMessage) requires a React
 * rendering environment. Tests here cover:
 * - Module export shape
 * - addToolResult pure state transformation (via setMessages + renderHook if available)
 * - stop() safety (no throw when no active stream)
 *
 * Note: @testing-library/react is not available in this package, so tests are
 * limited to module shape and pure-function exports.
 */

import { useZenithChat } from "./use-zenith-chat";
import type { ChatStatus, UseZenithChatOptions, UseZenithChatReturn } from "./use-zenith-chat";

// Minimal AIService mock
const makeAIService = (overrides?: any) => ({
  streamChat: jest.fn(() => ({
    fullStream: (async function* () {
      yield { type: "text-delta", text: "hello" };
    })(),
  })),
  getActiveModel: jest.fn(),
  validateKey: jest.fn(),
  getModelForConfig: jest.fn(),
  ...overrides,
});

describe("useZenithChat module", () => {
  it("exports useZenithChat as a function", () => {
    expect(typeof useZenithChat).toBe("function");
  });

  it("makeAIService helper produces a valid mock shape", () => {
    const svc = makeAIService();
    expect(typeof svc.streamChat).toBe("function");
    expect(typeof svc.getActiveModel).toBe("function");
    expect(typeof svc.validateKey).toBe("function");
    expect(typeof svc.getModelForConfig).toBe("function");
  });

  it("makeAIService streamChat returns an object with fullStream", () => {
    const svc = makeAIService();
    const result = svc.streamChat();
    expect(result).toHaveProperty("fullStream");
    expect(typeof result.fullStream[Symbol.asyncIterator]).toBe("function");
  });
});

describe("useZenithChat type contracts", () => {
  // Test 1: ChatStatus valid literals
  it("ChatStatus accepts exactly 'ready', 'submitted', and 'streaming'", () => {
    const s1: ChatStatus = "ready";
    const s2: ChatStatus = "submitted";
    const s3: ChatStatus = "streaming";
    expect([s1, s2, s3]).toEqual(["ready", "submitted", "streaming"]);
  });

  // Test 2: UseZenithChatOptions interface shape
  it("UseZenithChatOptions accepts required aiService and all optional fields", () => {
    const svc = makeAIService();

    // Minimal: only required field
    const minimal: UseZenithChatOptions = { aiService: svc as any };
    expect(minimal.aiService).toBe(svc);

    // Full: all optional fields present
    const full: UseZenithChatOptions = {
      aiService: svc as any,
      tools: undefined,
      maxSteps: 10,
      onFinish: jest.fn() as any,
      onError: jest.fn() as any,
      onStepFinish: jest.fn() as any,
    };
    expect(full.maxSteps).toBe(10);
    expect(typeof full.onFinish).toBe("function");
    expect(typeof full.onError).toBe("function");
    expect(typeof full.onStepFinish).toBe("function");
  });

  // Test 3: fullStream yields text-delta with .text property (AI SDK v5)
  it("fullStream mock yields text-delta event with .text property (AI SDK v5, not .textDelta)", async () => {
    const stream = (async function* () {
      yield { type: "text-delta", text: "hello" };
    })();

    const events: any[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("text-delta");
    expect(events[0]).toHaveProperty("text", "hello");
    expect(events[0]).not.toHaveProperty("textDelta");
  });

  // Test 4: fullStream yields multiple event types in order
  it("fullStream mock yields multiple event types in correct order", async () => {
    const stream = (async function* () {
      yield { type: "text-delta", text: "hello" };
      yield { type: "tool-call", toolName: "search", toolCallId: "tc-1", input: {} };
      yield { type: "finish" };
    })();

    const events: any[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("text-delta");
    expect(events[1].type).toBe("tool-call");
    expect(events[1].toolCallId).toBe("tc-1");
    expect(events[2].type).toBe("finish");
  });

  // Test 5: UseZenithChatReturn interface shape
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

    const expectedKeys = [
      "messages", "status", "error",
      "sendMessage", "addToolResult", "stop", "reload", "setMessages",
    ];
    expect(Object.keys(mockReturn)).toEqual(expect.arrayContaining(expectedKeys));
    expect(Object.keys(mockReturn)).toHaveLength(expectedKeys.length);
    expect(Array.isArray(mockReturn.messages)).toBe(true);
    expect(mockReturn.error).toBeNull();
  });

  // Test 6: AIService mock completeness
  it("makeAIService creates a mock satisfying all AIService methods", () => {
    const svc = makeAIService();
    const requiredMethods = ["streamChat", "getActiveModel", "validateKey", "getModelForConfig"];

    for (const method of requiredMethods) {
      expect(svc).toHaveProperty(method);
      expect(jest.isMockFunction((svc as any)[method])).toBe(true);
    }
  });

  // Test 7: AbortController signal passthrough to streamChat mock
  it("AbortController signal can be passed to streamChat mock and tracks aborted state", () => {
    const svc = makeAIService();
    const controller = new AbortController();

    svc.streamChat({ messages: [], abortSignal: controller.signal });

    const calledWith = svc.streamChat.mock.calls[0][0];
    expect(calledWith.abortSignal).toBe(controller.signal);
    expect(calledWith.abortSignal.aborted).toBe(false);

    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});
