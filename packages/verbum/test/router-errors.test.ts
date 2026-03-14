import { describe, expect, it, vi } from "vitest";

import { Router, ToolActor, createTextMessage } from "../src/index.js";
import type { Actor, ActorContext, Message, MessageDraft } from "../src/index.js";

/**
 * A helper actor that always throws.
 */
function throwingActor(id: string, errorMessage: string): Actor {
  return {
    id,
    type: "tool",
    capabilities: [],
    async receive(): Promise<MessageDraft[]> {
      throw new Error(errorMessage);
    }
  };
}

/**
 * A helper actor that takes a long time to respond.
 */
function slowActor(id: string, delayMs: number): Actor {
  return {
    id,
    type: "tool",
    capabilities: [],
    async receive(message: Message): Promise<MessageDraft[]> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return [
        {
          from: id,
          to: message.from,
          role: "tool",
          content: { type: "text", text: "finally done" }
        }
      ];
    }
  };
}

/**
 * An echo actor that just replies.
 */
function echoActor(id: string): Actor {
  return {
    id,
    type: "tool",
    capabilities: [],
    async receive(message: Message): Promise<MessageDraft[]> {
      return [
        {
          from: id,
          to: message.from,
          role: "tool",
          content: { type: "text", text: "echo" }
        }
      ];
    }
  };
}

describe("Router error handling", () => {
  it("emits error event and records system error message when actor throws", async () => {
    const router = new Router();
    const actor = throwingActor("bad-actor", "kaboom");
    router.register(actor);

    const errorHandler = vi.fn();
    router.on("error", errorHandler);

    const transcript = await router.send(
      createTextMessage("user", "bad-actor", "trigger error", "conv-err-1")
    );

    // Error event was emitted with the right arguments
    expect(errorHandler).toHaveBeenCalledOnce();
    const [err, msg, faultyActor] = errorHandler.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("kaboom");
    expect(msg.from).toBe("user");
    expect(faultyActor.id).toBe("bad-actor");

    // Transcript contains the original message
    expect(transcript).toHaveLength(1);
    expect(transcript[0].from).toBe("user");

    // A system error message was recorded in the conversation
    const conv = router.getConversation("conv-err-1");
    const messages = conv.getMessages();
    const systemMsg = messages.find(
      (m) => m.from === "system" && m.content.type === "text"
    );
    expect(systemMsg).toBeDefined();
    expect(
      systemMsg!.content.type === "text" && systemMsg!.content.text
    ).toContain("kaboom");
  });

  it("throws when max depth is exceeded", async () => {
    const router = new Router({ maxDepth: 2 });

    // Actor that always bounces messages back, creating infinite recursion
    const pingPong: Actor = {
      id: "ping",
      type: "tool",
      capabilities: [],
      async receive(message: Message): Promise<MessageDraft[]> {
        return [
          {
            from: "ping",
            to: "ping", // sends to itself
            role: "tool",
            content: { type: "text", text: "bounce" }
          }
        ];
      }
    };
    router.register(pingPong);

    await expect(
      router.send(createTextMessage("user", "ping", "start", "conv-depth"))
    ).rejects.toThrow(/Maximum router depth of 2 exceeded/);
  });

  it("emits deadletter event when sending to unknown actor", async () => {
    const router = new Router();
    const deadletterHandler = vi.fn();
    router.on("deadletter", deadletterHandler);

    const transcript = await router.send(
      createTextMessage("user", "nonexistent", "hello", "conv-dead")
    );

    expect(deadletterHandler).toHaveBeenCalledOnce();
    const [deadMsg] = deadletterHandler.mock.calls[0];
    expect(deadMsg.to).toBe("nonexistent");
    expect(deadMsg.from).toBe("user");

    // The undeliverable message is still in the transcript
    expect(transcript).toHaveLength(1);
    expect(transcript[0].to).toBe("nonexistent");
  });

  it("times out when actor exceeds dispatchTimeoutMs", async () => {
    const router = new Router({ dispatchTimeoutMs: 50 });
    router.register(slowActor("slowpoke", 5000));

    const errorHandler = vi.fn();
    router.on("error", errorHandler);

    const transcript = await router.send(
      createTextMessage("user", "slowpoke", "hurry up", "conv-timeout")
    );

    expect(errorHandler).toHaveBeenCalledOnce();
    const [err] = errorHandler.mock.calls[0];
    expect(err.message).toContain("timed out");
    expect(err.message).toContain("slowpoke");

    // Transcript returns the original message
    expect(transcript).toHaveLength(1);
  });

  it("unregister removes an actor so dispatch deadletters", async () => {
    const router = new Router();
    const actor = echoActor("removable");
    router.register(actor);

    expect(router.has("removable")).toBe(true);

    // Dispatch should work before unregistering
    const t1 = await router.send(
      createTextMessage("user", "removable", "hi", "conv-unreg")
    );
    expect(t1.length).toBeGreaterThan(1); // original + echo reply

    // Unregister
    const removed = router.unregister("removable");
    expect(removed).toBe(true);
    expect(router.has("removable")).toBe(false);

    // Now dispatch should deadletter
    const deadletterHandler = vi.fn();
    router.on("deadletter", deadletterHandler);

    const t2 = await router.send(
      createTextMessage("user", "removable", "hi again", "conv-unreg-2")
    );
    expect(deadletterHandler).toHaveBeenCalledOnce();
    expect(t2).toHaveLength(1);
  });

  it("removeConversation deletes the conversation", async () => {
    const router = new Router();
    router.register(echoActor("echo"));

    await router.send(createTextMessage("user", "echo", "hi", "conv-remove"));
    const conv = router.getConversation("conv-remove");
    expect(conv.getMessages().length).toBeGreaterThan(0);

    const removed = router.removeConversation("conv-remove");
    expect(removed).toBe(true);

    // Getting the conversation again returns a fresh empty one
    const conv2 = router.getConversation("conv-remove");
    expect(conv2.getMessages()).toHaveLength(0);

    // Removing non-existent returns false
    expect(router.removeConversation("doesnt-exist")).toBe(false);
  });
});
