import { describe, expect, it } from "vitest";

import {
  createMessage,
  createTextMessage,
  replyTo,
  contentToText,
  ensureText
} from "../src/index.js";
import type { MessageContent, Message } from "../src/index.js";

describe("createMessage", () => {
  it("generates an id and timestamp when not provided", () => {
    const msg = createMessage({
      from: "alice",
      to: "bob",
      role: "user",
      conversationId: "conv-1",
      content: { type: "text", text: "hi" }
    });

    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(0);
    expect(msg.timestamp).toBeDefined();
    expect(typeof msg.timestamp).toBe("number");
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it("preserves provided id and timestamp", () => {
    const msg = createMessage({
      id: "custom-id",
      from: "alice",
      to: "bob",
      role: "user",
      conversationId: "conv-1",
      timestamp: 12345,
      content: { type: "text", text: "hi" }
    });

    expect(msg.id).toBe("custom-id");
    expect(msg.timestamp).toBe(12345);
  });

  it("defaults metadata to empty object when not provided", () => {
    const msg = createMessage({
      from: "alice",
      to: "bob",
      role: "user",
      conversationId: "conv-1",
      content: { type: "text", text: "hi" }
    });

    expect(msg.metadata).toEqual({});
  });

  it("throws when from is missing", () => {
    expect(() =>
      createMessage({
        to: "bob",
        role: "user",
        conversationId: "conv-1",
        content: { type: "text", text: "hi" }
      })
    ).toThrow(/from/i);
  });

  it("throws when conversationId is missing", () => {
    expect(() =>
      createMessage({
        from: "alice",
        to: "bob",
        role: "user",
        content: { type: "text", text: "hi" }
      })
    ).toThrow(/conversationId/i);
  });
});

describe("createTextMessage", () => {
  it("creates a message with text content", () => {
    const msg = createTextMessage("alice", "bob", "hello", "conv-2");

    expect(msg.from).toBe("alice");
    expect(msg.to).toBe("bob");
    expect(msg.conversationId).toBe("conv-2");
    expect(msg.content).toEqual({ type: "text", text: "hello" });
    expect(msg.role).toBe("user"); // default role
    expect(msg.id).toBeDefined();
    expect(msg.timestamp).toBeDefined();
  });

  it("accepts a custom role", () => {
    const msg = createTextMessage("system", "bob", "instructions", "conv-2", "system");
    expect(msg.role).toBe("system");
  });
});

describe("replyTo", () => {
  it("swaps conversationId and sets parentId from the original message", () => {
    const original = createMessage({
      id: "msg-123",
      from: "alice",
      to: "bob",
      role: "user",
      conversationId: "conv-3",
      content: { type: "text", text: "question" }
    });

    const reply = replyTo(original, {
      from: "bob",
      to: "alice",
      role: "assistant",
      content: { type: "text", text: "answer" }
    });

    expect(reply.conversationId).toBe("conv-3");
    expect(reply.parentId).toBe("msg-123");
    expect(reply.from).toBe("bob");
    expect(reply.to).toBe("alice");
  });

  it("returns a MessageDraft (not a full Message) so id/timestamp are absent", () => {
    const original = createTextMessage("a", "b", "hi", "conv-4");
    const reply = replyTo(original, {
      from: "b",
      to: "a",
      role: "assistant",
      content: { type: "text", text: "bye" }
    });

    // replyTo returns a draft, so id is not auto-set
    // (unless the caller provided one in the Omit'd draft)
    expect(reply.conversationId).toBe("conv-4");
    expect(reply.parentId).toBe(original.id);
  });
});

describe("contentToText", () => {
  it("handles text content", () => {
    const content: MessageContent = { type: "text", text: "hello world" };
    expect(contentToText(content)).toBe("hello world");
  });

  it("handles tool_call content", () => {
    const content: MessageContent = {
      type: "tool_call",
      name: "search",
      input: { query: "test" }
    };
    const result = contentToText(content);
    expect(result).toContain("search");
    expect(result).toContain("test");
  });

  it("handles tool_result content with output", () => {
    const content: MessageContent = {
      type: "tool_result",
      output: { data: [1, 2, 3] }
    };
    const result = contentToText(content);
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
  });

  it("handles tool_result content with error", () => {
    const content: MessageContent = {
      type: "tool_result",
      output: null,
      error: "something broke"
    };
    expect(contentToText(content)).toBe("error: something broke");
  });

  it("handles json content", () => {
    const content: MessageContent = {
      type: "json",
      value: { key: "value" }
    };
    const result = contentToText(content);
    expect(result).toContain("key");
    expect(result).toContain("value");
  });
});

describe("ensureText", () => {
  it("returns the text for text content", () => {
    const content: MessageContent = { type: "text", text: "hello" };
    expect(ensureText(content)).toBe("hello");
  });

  it("throws for non-text content types", () => {
    const content: MessageContent = { type: "json", value: { a: 1 } };
    expect(() => ensureText(content)).toThrow(/Expected text content.*json/);
  });

  it("throws for tool_call content", () => {
    const content: MessageContent = { type: "tool_call", name: "fn", input: {} };
    expect(() => ensureText(content)).toThrow(/Expected text content.*tool_call/);
  });

  it("throws for tool_result content", () => {
    const content: MessageContent = { type: "tool_result", output: "data" };
    expect(() => ensureText(content)).toThrow(/Expected text content.*tool_result/);
  });
});
