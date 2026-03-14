import { describe, expect, it, vi } from "vitest";

import {
  ToolActor,
  MemoryActor,
  HumanActor,
  ModelActor,
  ProcessActor,
  scriptedModel,
  createMessage
} from "../src/index.js";
import type { ActorContext, Message, MessageDraft, ConversationSnapshot, RouterLike } from "../src/index.js";

/** Build a minimal ActorContext for unit-testing actors. */
function makeContext(actor: { id: string; type: string; capabilities: string[] }): ActorContext {
  const snapshot: ConversationSnapshot = {
    id: "conv-test",
    participants: [],
    messages: [],
    metadata: {}
  };

  const router: RouterLike = {
    maxDepth: 8,
    has: () => false,
    listActors: () => []
  };

  return {
    actor: actor as ActorContext["actor"],
    conversation: snapshot,
    router,
    createReply: (draft) => ({
      ...draft,
      conversationId: "conv-test",
      parentId: "parent-id"
    })
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return createMessage({
    from: "user",
    to: "test-actor",
    role: "user",
    conversationId: "conv-test",
    content: { type: "text", text: "hello" },
    ...overrides
  });
}

describe("ToolActor", () => {
  it("executes the function and returns a tool_result", async () => {
    const tool = new ToolActor({
      id: "add",
      execute: (input: { a: number; b: number }) => input.a + input.b
    });

    const msg = makeMessage({
      to: "add",
      content: { type: "tool_call", name: "add", input: { a: 3, b: 4 } }
    });

    const results = await tool.receive(msg, makeContext(tool));

    expect(results).toHaveLength(1);
    expect(results[0].content).toEqual({ type: "tool_result", output: 7 });
    expect(results[0].to).toBe("user");
    expect(results[0].role).toBe("tool");
  });

  it("handles errors in the execute function gracefully", async () => {
    const tool = new ToolActor({
      id: "failing-tool",
      execute: () => {
        throw new Error("tool broke");
      }
    });

    const msg = makeMessage({ to: "failing-tool" });
    const results = await tool.receive(msg, makeContext(tool));

    expect(results).toHaveLength(1);
    expect(results[0].content.type).toBe("tool_result");
    const content = results[0].content as { type: "tool_result"; output: unknown; error?: string };
    expect(content.error).toBe("tool broke");
    expect(content.output).toBeNull();
  });

  it("passes text content as { text } when not a tool_call", async () => {
    const tool = new ToolActor({
      id: "echo",
      execute: (input: { text?: string }) => `echoed: ${input.text}`
    });

    const msg = makeMessage({
      to: "echo",
      content: { type: "text", text: "hi" }
    });

    const results = await tool.receive(msg, makeContext(tool));
    expect(results[0].content).toEqual({ type: "tool_result", output: "echoed: hi" });
  });
});

describe("MemoryActor", () => {
  it("remembers via text prefix 'remember:'", async () => {
    const memory = new MemoryActor({ id: "mem" });

    const msg = makeMessage({
      to: "mem",
      content: { type: "text", text: "remember: the sky is blue" }
    });

    const results = await memory.receive(msg, makeContext(memory));

    expect(results).toHaveLength(1);
    expect(results[0].content.type).toBe("text");
    const text = (results[0].content as { type: "text"; text: string }).text;
    expect(text).toContain("Stored memory");

    // Verify it's actually stored
    const entries = memory.all();
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("the sky is blue");
  });

  it("remembers via tool_call", async () => {
    const memory = new MemoryActor({ id: "mem" });

    const msg = makeMessage({
      to: "mem",
      content: {
        type: "tool_call",
        name: "remember",
        input: { text: "cats are cool", tags: ["animals"] }
      }
    });

    const results = await memory.receive(msg, makeContext(memory));

    expect(results).toHaveLength(1);
    expect(results[0].content.type).toBe("tool_result");

    const entries = memory.all();
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("cats are cool");
    expect(entries[0].tags).toEqual(["animals"]);
  });

  it("searches and returns matching results", async () => {
    const memory = new MemoryActor({
      id: "mem",
      initialEntries: [
        { id: "e1", text: "TypeScript is great", tags: ["dev"], createdAt: 1000 },
        { id: "e2", text: "Python is versatile", tags: ["dev"], createdAt: 2000 },
        { id: "e3", text: "Cooking pasta", tags: ["food"], createdAt: 3000 }
      ]
    });

    const msg = makeMessage({
      to: "mem",
      content: { type: "text", text: "TypeScript" }
    });

    const results = await memory.receive(msg, makeContext(memory));

    expect(results).toHaveLength(1);
    expect(results[0].content.type).toBe("json");
    const value = (results[0].content as { type: "json"; value: { query: string; matches: Array<{ id: string }> } }).value;
    expect(value.matches.length).toBeGreaterThan(0);
    // TypeScript entry should be first (highest score)
    expect(value.matches[0].id).toBe("e1");
  });

  it("search via tool_call returns results", async () => {
    const memory = new MemoryActor({
      id: "mem",
      initialEntries: [
        { id: "e1", text: "red apples", tags: [], createdAt: 1000 }
      ]
    });

    const msg = makeMessage({
      to: "mem",
      content: {
        type: "tool_call",
        name: "search",
        input: { query: "apples" }
      }
    });

    const results = await memory.receive(msg, makeContext(memory));
    const output = (results[0].content as { type: "tool_result"; output: unknown }).output as Array<{ id: string }>;
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe("e1");
  });

  it("returns empty matches when nothing is found", async () => {
    const memory = new MemoryActor({ id: "mem" });

    const msg = makeMessage({
      to: "mem",
      content: { type: "text", text: "quantum physics" }
    });

    const results = await memory.receive(msg, makeContext(memory));

    expect(results).toHaveLength(1);
    const value = (results[0].content as { type: "json"; value: { matches: unknown[] } }).value;
    expect(value.matches).toHaveLength(0);
  });
});

describe("HumanActor", () => {
  it("delivers message via transport and returns empty array", async () => {
    const deliverFn = vi.fn();
    const human = new HumanActor({
      id: "human",
      transport: { deliver: deliverFn }
    });

    const msg = makeMessage({ to: "human" });
    const results = await human.receive(msg, makeContext(human));

    expect(deliverFn).toHaveBeenCalledOnce();
    expect(deliverFn).toHaveBeenCalledWith(msg);
    expect(results).toEqual([]);
  });

  it("awaits async transport deliver", async () => {
    let delivered = false;
    const human = new HumanActor({
      id: "human",
      transport: {
        async deliver() {
          await new Promise((r) => setTimeout(r, 10));
          delivered = true;
        }
      }
    });

    const msg = makeMessage({ to: "human" });
    await human.receive(msg, makeContext(human));
    expect(delivered).toBe(true);
  });
});

describe("ModelActor", () => {
  it("scriptedModel returning a string creates a text reply", async () => {
    const model = new ModelActor({
      id: "gpt",
      provider: "openai",
      model: "gpt-4",
      adapter: scriptedModel(() => "Hello, world!")
    });

    const msg = makeMessage({ to: "gpt" });
    const results = await model.receive(msg, makeContext(model));

    expect(results).toHaveLength(1);
    expect(results[0].role).toBe("assistant");
    expect(results[0].to).toBe("user");
    expect(results[0].content).toEqual({ type: "text", text: "Hello, world!" });
  });

  it("scriptedModel returning a MessageDraft uses it directly", async () => {
    const model = new ModelActor({
      id: "claude",
      provider: "anthropic",
      model: "claude-3",
      adapter: scriptedModel(() => ({
        to: "tool-actor",
        role: "assistant" as const,
        content: { type: "tool_call" as const, name: "search", input: { q: "test" } }
      }))
    });

    const msg = makeMessage({ to: "claude" });
    const results = await model.receive(msg, makeContext(model));

    expect(results).toHaveLength(1);
    expect(results[0].from).toBe("claude");
    expect(results[0].content.type).toBe("tool_call");
  });

  it("scriptedModel returning an array produces multiple drafts", async () => {
    const model = new ModelActor({
      id: "multi",
      provider: "test",
      model: "test",
      adapter: scriptedModel(() => [
        {
          to: "tool-a",
          role: "assistant" as const,
          content: { type: "text" as const, text: "first" }
        },
        {
          to: "tool-b",
          role: "assistant" as const,
          content: { type: "text" as const, text: "second" }
        }
      ])
    });

    const msg = makeMessage({ to: "multi" });
    const results = await model.receive(msg, makeContext(model));

    expect(results).toHaveLength(2);
    expect(results[0].to).toBe("tool-a");
    expect(results[1].to).toBe("tool-b");
  });

  it("scriptedModel returning { text, routeTo } routes to specified actor", async () => {
    const model = new ModelActor({
      id: "router-model",
      provider: "test",
      model: "test",
      adapter: scriptedModel(() => ({
        text: "routed reply",
        routeTo: "special-target",
        metadata: { custom: true }
      }))
    });

    const msg = makeMessage({ to: "router-model" });
    const results = await model.receive(msg, makeContext(model));

    expect(results).toHaveLength(1);
    expect(results[0].to).toBe("special-target");
    expect(results[0].content).toEqual({ type: "text", text: "routed reply" });
    expect(results[0].metadata).toEqual({ custom: true });
  });
});

describe("ProcessActor", () => {
  it("runs a simple echo command", async () => {
    const proc = new ProcessActor({ id: "shell", timeoutMs: 5000 });

    const msg = makeMessage({
      to: "shell",
      content: { type: "text", text: "echo hello-verbum" }
    });

    const results = await proc.receive(msg, makeContext(proc));

    expect(results).toHaveLength(1);
    expect(results[0].content.type).toBe("text");
    const text = (results[0].content as { type: "text"; text: string }).text;
    expect(text).toContain("hello-verbum");

    proc.dispose();
  });

  it("times out when command takes too long", async () => {
    const proc = new ProcessActor({ id: "slow-shell", timeoutMs: 100 });

    // sleep 10 should exceed the 100ms timeout
    const msg = makeMessage({
      to: "slow-shell",
      content: { type: "text", text: "sleep 10" }
    });

    await expect(proc.receive(msg, makeContext(proc))).rejects.toThrow(/timed out/i);

    proc.dispose();
  });
});
