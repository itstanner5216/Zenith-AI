/**
 * Note: This hook is tightly coupled to React state and the AI SDK streaming APIs.
 * Unit tests cover the pure logic; integration behavior is verified by building
 * and manually testing the chat in the plugin.
 *
 * The hook's contract is:
 * - It exposes messages, status, error, sendMessage, addToolResult, stop, reload, setMessages
 * - status transitions: ready → submitted → streaming → ready
 * - addToolResult updates the correct tool part's state to "output-available"
 */

// Basic smoke test — the hook module exports the expected function
import { useZenithChat } from "./use-zenith-chat";

describe("useZenithChat module", () => {
  it("exports useZenithChat function", () => {
    expect(typeof useZenithChat).toBe("function");
  });
});
