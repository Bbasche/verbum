import { describe, expect, it } from "vitest";

import { Conversation, createMessage } from "../src/index.js";
import type { Message } from "../src/index.js";

function makeMessage(overrides: Partial<Message> & { from: string; to: string }): Message {
  return createMessage({
    role: "user",
    conversationId: "conv-test",
    content: { type: "text", text: "hello" },
    ...overrides
  });
}

describe("Conversation", () => {
  describe("addMessage", () => {
    it("stores messages in order", () => {
      const conv = new Conversation("c1");
      const m1 = makeMessage({ from: "alice", to: "bob" });
      const m2 = makeMessage({ from: "bob", to: "alice" });

      conv.add(m1);
      conv.add(m2);

      const messages = conv.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe(m1.id);
      expect(messages[1].id).toBe(m2.id);
    });
  });

  describe("snapshot", () => {
    it("returns a plain object copy of the conversation state", () => {
      const conv = new Conversation("c2", { key: "value" });
      const m1 = makeMessage({ from: "a", to: "b" });
      conv.add(m1);

      const snap = conv.snapshot();

      expect(snap.id).toBe("c2");
      expect(snap.metadata).toEqual({ key: "value" });
      expect(snap.messages).toHaveLength(1);
      expect(snap.messages[0].id).toBe(m1.id);
      expect(snap.participants).toContain("a");
      expect(snap.participants).toContain("b");
    });

    it("snapshot messages array is a copy (mutations do not affect original)", () => {
      const conv = new Conversation("c3");
      conv.add(makeMessage({ from: "x", to: "y" }));

      const snap = conv.snapshot();
      snap.messages.push(makeMessage({ from: "z", to: "w" }));

      // Original conversation unchanged
      expect(conv.getMessages()).toHaveLength(1);
    });
  });

  describe("getMessages", () => {
    it("returns a frozen array", () => {
      const conv = new Conversation("c4");
      conv.add(makeMessage({ from: "a", to: "b" }));

      const messages = conv.getMessages();
      expect(Object.isFrozen(messages)).toBe(true);

      // Attempting to push should throw in strict mode
      expect(() => (messages as Message[]).push(makeMessage({ from: "c", to: "d" }))).toThrow();
    });

    it("returns a new array each call (not the same reference)", () => {
      const conv = new Conversation("c5");
      conv.add(makeMessage({ from: "a", to: "b" }));

      const first = conv.getMessages();
      const second = conv.getMessages();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });

  describe("fork", () => {
    it("creates an independent copy from a specific message", () => {
      const conv = new Conversation("c6");
      const m1 = makeMessage({ from: "a", to: "b" });
      const m2 = makeMessage({ from: "b", to: "a" });
      const m3 = makeMessage({ from: "a", to: "b" });

      conv.add(m1);
      conv.add(m2);
      conv.add(m3);

      const forked = conv.fork(m2.id);

      // Fork contains messages up to and including m2
      expect(forked.getMessages()).toHaveLength(2);
      expect(forked.getMessages()[0].id).toBe(m1.id);
      expect(forked.getMessages()[1].id).toBe(m2.id);

      // Fork has a distinct id
      expect(forked.id).toBe(`c6:fork:${m2.id}`);

      // Fork metadata records forkedFrom
      expect(forked.metadata.forkedFrom).toBe(m2.id);

      // Fork is independent: adding to fork does not affect original
      forked.add(makeMessage({ from: "c", to: "d" }));
      expect(conv.getMessages()).toHaveLength(3);
      expect(forked.getMessages()).toHaveLength(3);
    });

    it("throws when forking from a non-existent message id", () => {
      const conv = new Conversation("c7");
      conv.add(makeMessage({ from: "a", to: "b" }));

      expect(() => conv.fork("nonexistent-id")).toThrow(/not found/);
    });
  });

  describe("replay", () => {
    it("yields messages with correct ordering", async () => {
      const conv = new Conversation("c8");
      const now = Date.now();

      // Messages with known timestamps close together
      const m1 = createMessage({
        from: "a",
        to: "b",
        role: "user",
        conversationId: "c8",
        content: { type: "text", text: "first" },
        timestamp: now
      });
      const m2 = createMessage({
        from: "b",
        to: "a",
        role: "assistant",
        conversationId: "c8",
        content: { type: "text", text: "second" },
        timestamp: now + 10
      });

      conv.add(m1);
      conv.add(m2);

      const replayed: Message[] = [];
      // Use a very high speed to avoid real delays in tests
      for await (const msg of conv.replay(10000)) {
        replayed.push(msg);
      }

      expect(replayed).toHaveLength(2);
      expect(replayed[0].id).toBe(m1.id);
      expect(replayed[1].id).toBe(m2.id);
    });

    it("throws if speed is zero or negative", async () => {
      const conv = new Conversation("c9");
      conv.add(makeMessage({ from: "a", to: "b" }));

      // Vitest async generator error test: consume the generator to trigger the throw
      await expect(async () => {
        for await (const _ of conv.replay(0)) {
          // should not reach here
        }
      }).rejects.toThrow(/speed must be greater than zero/i);
    });
  });

  describe("clear", () => {
    it("empties all messages and participants", () => {
      const conv = new Conversation("c10");
      conv.add(makeMessage({ from: "a", to: "b" }));
      conv.add(makeMessage({ from: "c", to: "d" }));

      expect(conv.getMessages()).toHaveLength(2);
      expect(conv.participants.size).toBe(4);

      conv.clear();

      expect(conv.getMessages()).toHaveLength(0);
      expect(conv.participants.size).toBe(0);
    });
  });

  describe("participants", () => {
    it("tracks unique participants from added messages", () => {
      const conv = new Conversation("c11");
      conv.add(makeMessage({ from: "alice", to: "bob" }));
      conv.add(makeMessage({ from: "bob", to: "alice" }));
      conv.add(makeMessage({ from: "alice", to: "carol" }));

      expect(conv.participants.size).toBe(3);
      expect(conv.participants.has("alice")).toBe(true);
      expect(conv.participants.has("bob")).toBe(true);
      expect(conv.participants.has("carol")).toBe(true);
    });
  });
});
