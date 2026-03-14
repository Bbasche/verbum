import { describe, expect, it, vi } from "vitest";

import { Router, createTextMessage } from "../src/index.js";
import type { Actor, Message, MessageDraft } from "../src/index.js";

/**
 * A simple actor that records received messages and replies with a text.
 */
function recorderActor(id: string): { actor: Actor; received: Message[] } {
  const received: Message[] = [];

  const actor: Actor = {
    id,
    type: "tool",
    capabilities: [],
    async receive(message: Message): Promise<MessageDraft[]> {
      received.push(message);
      return [
        {
          from: id,
          to: message.from,
          role: "tool",
          content: { type: "text", text: `ack from ${id}` }
        }
      ];
    }
  };

  return { actor, received };
}

/**
 * A sink actor that receives but does not reply.
 */
function sinkActor(id: string): { actor: Actor; received: Message[] } {
  const received: Message[] = [];

  const actor: Actor = {
    id,
    type: "tool",
    capabilities: [],
    async receive(message: Message): Promise<MessageDraft[]> {
      received.push(message);
      return [];
    }
  };

  return { actor, received };
}

describe("Broadcast", () => {
  describe("router.broadcast()", () => {
    it("sends to all registered actors", async () => {
      const router = new Router();

      const a = sinkActor("alpha");
      const b = sinkActor("beta");
      const c = sinkActor("gamma");

      router.register(a.actor);
      router.register(b.actor);
      router.register(c.actor);

      const transcript = await router.broadcast({
        from: "user",
        role: "user",
        conversationId: "conv-bc-1",
        content: { type: "text", text: "hello all" }
      });

      // Each actor should have received the message
      expect(a.received).toHaveLength(1);
      expect(b.received).toHaveLength(1);
      expect(c.received).toHaveLength(1);

      // Transcript should contain all the sent messages
      expect(transcript.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("to: '*' broadcast via routeMessage", () => {
    it("dispatches to all actors", async () => {
      const router = new Router();

      const a = sinkActor("alpha");
      const b = sinkActor("beta");

      router.register(a.actor);
      router.register(b.actor);

      const transcript = await router.send({
        from: "user",
        to: "*",
        role: "user",
        conversationId: "conv-bc-2",
        content: { type: "text", text: "broadcast via star" }
      });

      expect(a.received).toHaveLength(1);
      expect(b.received).toHaveLength(1);

      // Transcript includes the original broadcast message + individual deliveries
      expect(transcript.length).toBeGreaterThanOrEqual(3);

      // The broadcast message itself is in the transcript
      expect(transcript[0].to).toBe("*");
    });

    it("does not send back to the sender", async () => {
      const router = new Router();

      const sender = sinkActor("sender");
      const other = sinkActor("other");

      router.register(sender.actor);
      router.register(other.actor);

      await router.send({
        from: "sender",
        to: "*",
        role: "user",
        conversationId: "conv-bc-3",
        content: { type: "text", text: "no echo" }
      });

      // The sender should NOT have received the broadcast back
      expect(sender.received).toHaveLength(0);

      // The other actor should have received it
      expect(other.received).toHaveLength(1);
    });
  });

  describe("broadcast with replies", () => {
    it("collects replies from all actors in the transcript", async () => {
      const router = new Router();

      const a = recorderActor("alpha");
      const b = recorderActor("beta");

      router.register(a.actor);
      router.register(b.actor);

      const transcript = await router.send({
        from: "user",
        to: "*",
        role: "user",
        conversationId: "conv-bc-4",
        content: { type: "text", text: "hello" }
      });

      // Expect: broadcast msg, alpha delivery, alpha reply, beta delivery, beta reply
      const fromAlpha = transcript.filter((m) => m.from === "alpha");
      const fromBeta = transcript.filter((m) => m.from === "beta");

      expect(fromAlpha.length).toBeGreaterThan(0);
      expect(fromBeta.length).toBeGreaterThan(0);
    });
  });

  describe("broadcast metadata", () => {
    it("marks individual messages with broadcast: true metadata", async () => {
      const router = new Router();

      const a = sinkActor("alpha");
      router.register(a.actor);

      await router.send({
        from: "user",
        to: "*",
        role: "user",
        conversationId: "conv-bc-5",
        content: { type: "text", text: "test" }
      });

      // The message delivered to alpha should have broadcast: true in metadata
      expect(a.received).toHaveLength(1);
      expect(a.received[0].metadata?.broadcast).toBe(true);
    });
  });
});
