// Extend the obsidian mock with normalizePath (not present in the base __mocks__/obsidian.ts)
jest.mock("obsidian", () => ({
  normalizePath: (path: string) => path,
  App: jest.fn(),
  TFile: jest.fn(),
  Notice: jest.fn(),
}));

import { ChatHistoryManager } from "./chat-history-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeApp = () => ({
  vault: {
    adapter: {
      exists: jest.fn().mockResolvedValue(false),
      read: jest.fn().mockResolvedValue(""),
      write: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
    },
    create: jest.fn().mockResolvedValue(undefined),
  },
  workspace: { getLeaf: jest.fn() },
});

// ---------------------------------------------------------------------------
// Static method tests (no mocking required)
// ---------------------------------------------------------------------------

describe("ChatHistoryManager.generateTitleFromMessages", () => {
  it("returns 'New Chat' for empty messages array", () => {
    expect(ChatHistoryManager.generateTitleFromMessages([])).toBe("New Chat");
  });

  it("returns 'New Chat' for messages with no user message", () => {
    const messages = [
      { id: "1", role: "assistant" as const, content: "Hello there" },
    ] as any[];
    expect(ChatHistoryManager.generateTitleFromMessages(messages)).toBe(
      "New Chat"
    );
  });

  it("extracts title from first user message content", () => {
    const content = "What is the weather today";
    const messages = [
      { id: "1", role: "user" as const, content },
    ] as any[];
    expect(ChatHistoryManager.generateTitleFromMessages(messages)).toBe(
      content
    );
  });

  it("removes @mention at end of message, leaving preceding text", () => {
    // @notes.md appears at the end; nothing follows it so the regex removes only
    // the mention token and leaves the non-mention prefix intact.
    const messages = [
      { id: "1", role: "user" as const, content: "Explain @notes.md" },
    ] as any[];
    expect(ChatHistoryManager.generateTitleFromMessages(messages)).toBe(
      "Explain"
    );
  });

  it("returns 'New Chat' when message content is only @mentions", () => {
    // The first replace removes @file.md; the second /@\S+/g removes @other.md.
    // The result is an empty string which falls back to "New Chat".
    const messages = [
      { id: "1", role: "user" as const, content: "@file.md @other.md" },
    ] as any[];
    expect(ChatHistoryManager.generateTitleFromMessages(messages)).toBe(
      "New Chat"
    );
  });

  it("truncates long messages to 50 characters", () => {
    // Use a space-free string so substring(0,50).trim() doesn't shorten the result
    const content = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 52 chars
    const messages = [
      { id: "1", role: "user" as const, content },
    ] as any[];
    const result = ChatHistoryManager.generateTitleFromMessages(messages);
    expect(result.length).toBe(50);
    expect(result).toBe(content.substring(0, 50));
  });
});

// ---------------------------------------------------------------------------
// Instance operation tests (require a mocked App)
// ---------------------------------------------------------------------------

describe("ChatHistoryManager instance operations", () => {
  beforeEach(() => {
    // Reset singleton so each test gets a fresh instance
    (ChatHistoryManager as any).instance = null;
  });

  it("createSession() returns a session with id, 'New Chat' title, empty messages, and timestamps", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    const before = Date.now();
    const session = manager.createSession();
    const after = Date.now();

    expect(session.id).toMatch(/^chat-\d+-[a-z0-9]+$/);
    expect(session.title).toBe("New Chat");
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
    expect(session.updatedAt).toBe(session.createdAt);
  });

  it("createSession() with title uses the provided title", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    const session = manager.createSession("My Custom Session");
    expect(session.title).toBe("My Custom Session");
  });

  it("updateSession() mutates the session and updates updatedAt", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    let fakeNow = 1_000_000;
    const spy = jest.spyOn(Date, "now").mockImplementation(() => fakeNow);

    const session = manager.createSession();
    const originalUpdatedAt = session.updatedAt;

    fakeNow += 100;
    manager.updateSession(session.id, { title: "Updated Title" });

    const updated = manager.getSession(session.id);
    expect(updated?.title).toBe("Updated Title");
    expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);

    spy.mockRestore();
  });

  it("deleteSession() removes the session", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    const session = manager.createSession();
    manager.deleteSession(session.id);

    expect(manager.getSession(session.id)).toBeUndefined();
  });

  it("getSession() returns undefined for unknown id", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    expect(manager.getSession("nonexistent-id-xyz")).toBeUndefined();
  });

  it("getAllSessions() returns sessions sorted by updatedAt descending", async () => {
    const app = makeApp() as any;
    const manager = ChatHistoryManager.getInstance(app);
    await manager.waitForLoad();

    let fakeNow = 1_000_000;
    const spy = jest.spyOn(Date, "now").mockImplementation(() => fakeNow);

    const s1 = manager.createSession("First");
    fakeNow += 100;
    const s2 = manager.createSession("Second");
    fakeNow += 100;
    const s3 = manager.createSession("Third");

    const all = manager.getAllSessions();
    expect(all.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);

    spy.mockRestore();
  });

  it("getInstance() throws when called with no app and no existing instance", () => {
    expect(() => ChatHistoryManager.getInstance()).toThrow(
      "ChatHistoryManager needs app for initialization"
    );
  });
});
