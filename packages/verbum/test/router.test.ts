import { describe, expect, it } from "vitest";

import { MemoryActor, ModelActor, Router, ToolActor, createTextMessage, scriptedModel } from "../src/index.js";

describe("Router", () => {
  it("routes across actors and records the conversation graph", async () => {
    const router = new Router({ maxDepth: 6 });

    router.register(
      new ToolActor({
        id: "shell",
        execute: ({ text }: { text?: string }) => ({ echoed: text?.toUpperCase() ?? "" })
      })
    );

    router.register(
      new ModelActor({
        id: "claude",
        provider: "anthropic",
        model: "claude-sonnet",
        adapter: scriptedModel(({ message }) => {
          if (message.from === "user") {
            return [
              {
                from: "claude",
                to: "shell",
                role: "assistant",
                content: { type: "text", text: "hello verbum" }
              }
            ];
          }

          if (message.from === "shell" && message.content.type === "tool_result") {
            return {
              from: "claude",
              to: "user",
              role: "assistant",
              content: {
                type: "text",
                text: `Shell said ${JSON.stringify(message.content.output)}`
              }
            };
          }

          return "done";
        })
      })
    );

    const transcript = await router.send(createTextMessage("user", "claude", "Ship it", "conv-1"));
    const graph = router.visualize();

    expect(transcript.map((message) => `${message.from}->${message.to}`)).toEqual([
      "user->claude",
      "claude->shell",
      "shell->claude",
      "claude->user"
    ]);
    expect(graph.nodes.find((node) => node.id === "shell")?.messageCount).toBeGreaterThan(0);
    expect(graph.edges.some((edge) => edge.from === "claude" && edge.to === "shell")).toBe(true);
  });

  it("stores and recalls memory entries", async () => {
    const router = new Router();
    router.register(new MemoryActor({ id: "memory" }));

    await router.send({
      from: "user",
      to: "memory",
      role: "user",
      conversationId: "memory-1",
      content: { type: "text", text: "remember: codex watched claude code and two shells" }
    });

    const transcript = await router.send({
      from: "user",
      to: "memory",
      role: "user",
      conversationId: "memory-1",
      content: { type: "text", text: "claude code" }
    });

    const last = transcript.at(-1);
    expect(last?.content.type).toBe("json");
    expect(JSON.stringify(last?.content)).toContain("claude");
  });
});

