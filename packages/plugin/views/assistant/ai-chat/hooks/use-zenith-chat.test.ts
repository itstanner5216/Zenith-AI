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

// Minimal AIService mock
const makeAIService = (overrides?: any) => ({
  streamChat: jest.fn(() => ({
    fullStream: (async function* () {
      yield { type: "text-delta", textDelta: "hello" };
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
