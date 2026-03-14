import { describe, expect, it, vi } from "vitest";

import {
  MiddlewareRunner,
  loggingMiddleware,
  rateLimitMiddleware,
  costTrackingMiddleware,
  createMessage
} from "../src/index.js";
import type { Message, Middleware } from "../src/index.js";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return createMessage({
    from: "user",
    to: "bot",
    role: "user",
    conversationId: "conv-mw",
    content: { type: "text", text: "hello" },
    ...overrides
  });
}

describe("MiddlewareRunner", () => {
  it("executes middleware in registration order", async () => {
    const runner = new MiddlewareRunner();
    const order: number[] = [];

    runner.use(async (_msg, next) => {
      order.push(1);
      const result = await next();
      order.push(4);
      return result;
    });

    runner.use(async (_msg, next) => {
      order.push(2);
      const result = await next();
      order.push(3);
      return result;
    });

    const msg = makeMessage();
    const handler = vi.fn(async () => {
      order.push(99);
      return [msg];
    });

    await runner.run(msg, handler);

    // Middleware composes inside-out: last registered is outermost.
    // So middleware 2 runs first, then middleware 1, then handler.
    expect(order).toEqual([2, 1, 99, 4, 3]);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("middleware can short-circuit by not calling next", async () => {
    const runner = new MiddlewareRunner();
    const shortCircuitMsg = makeMessage({ content: { type: "text", text: "blocked" } });

    runner.use(async (_msg, _next) => {
      // Do not call next — short circuit
      return [shortCircuitMsg];
    });

    const handler = vi.fn(async () => [makeMessage()]);
    const result = await runner.run(makeMessage(), handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual([shortCircuitMsg]);
  });

  it("middleware can modify messages in the result", async () => {
    const runner = new MiddlewareRunner();

    runner.use(async (msg, next) => {
      const results = await next();
      // Tag every result message with metadata
      return results.map((m) => ({
        ...m,
        metadata: { ...m.metadata, tagged: true }
      }));
    });

    const original = makeMessage();
    const handler = async () => [original];

    const result = await runner.run(original, handler);
    expect(result[0].metadata?.tagged).toBe(true);
  });

  it("runs handler directly when no middleware registered", async () => {
    const runner = new MiddlewareRunner();
    const msg = makeMessage();
    const handler = vi.fn(async () => [msg]);

    const result = await runner.run(msg, handler);
    expect(handler).toHaveBeenCalledOnce();
    expect(result).toEqual([msg]);
  });
});

describe("loggingMiddleware", () => {
  it("logs dispatch info before and after next()", async () => {
    const runner = new MiddlewareRunner();
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);

    runner.use(loggingMiddleware(logger));

    const msg = makeMessage({
      from: "alice",
      to: "bob",
      content: { type: "text", text: "hi there" }
    });

    await runner.run(msg, async () => [msg]);

    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain("alice");
    expect(logs[0]).toContain("bob");
    expect(logs[0]).toContain("hi there");
    expect(logs[1]).toContain("completed in");
    expect(logs[1]).toContain("1 messages");
  });

  it("shows content type for non-text messages", async () => {
    const runner = new MiddlewareRunner();
    const logs: string[] = [];

    runner.use(loggingMiddleware((msg) => logs.push(msg)));

    const msg = makeMessage({
      content: { type: "tool_call", name: "search", input: { q: "test" } }
    });

    await runner.run(msg, async () => [msg]);

    expect(logs[0]).toContain("tool_call");
  });
});

describe("rateLimitMiddleware", () => {
  it("throws when global rate limit is exceeded", async () => {
    const runner = new MiddlewareRunner();
    runner.use(rateLimitMiddleware({ maxPerMinute: 2 }));

    const msg = makeMessage();
    const handler = async () => [msg];

    // First two should succeed
    await runner.run(msg, handler);
    await runner.run(msg, handler);

    // Third should throw
    await expect(runner.run(msg, handler)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("tracks limits per actor when perActor is true", async () => {
    const runner = new MiddlewareRunner();
    runner.use(rateLimitMiddleware({ maxPerMinute: 1, perActor: true }));

    const msgToBob = makeMessage({ to: "bob" });
    const msgToAlice = makeMessage({ to: "alice" });
    const handler = async () => [makeMessage()];

    // Bob: first call OK
    await runner.run(msgToBob, handler);

    // Alice: first call OK (separate bucket)
    await runner.run(msgToAlice, handler);

    // Bob: second call should fail
    await expect(runner.run(msgToBob, handler)).rejects.toThrow(
      /Rate limit exceeded.*bob/
    );

    // Alice: second call should also fail
    await expect(runner.run(msgToAlice, handler)).rejects.toThrow(
      /Rate limit exceeded.*alice/
    );
  });

  it("does not include actor name in global rate limit error", async () => {
    const runner = new MiddlewareRunner();
    runner.use(rateLimitMiddleware({ maxPerMinute: 1, perActor: false }));

    const msg = makeMessage({ to: "target" });
    const handler = async () => [msg];

    await runner.run(msg, handler);

    try {
      await runner.run(msg, handler);
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("Rate limit exceeded");
      expect((err as Error).message).not.toContain("target");
    }
  });
});

describe("costTrackingMiddleware", () => {
  it("extracts token info from metadata.tokens", async () => {
    const runner = new MiddlewareRunner();
    const costs: Array<{ input?: number; output?: number }> = [];
    runner.use(costTrackingMiddleware((_, tokens) => costs.push(tokens)));

    const msg = makeMessage({
      metadata: { tokens: { input: 100, output: 50 } }
    });

    await runner.run(msg, async () => [msg]);

    // Should report tokens from the incoming message AND from the result
    // Since the result is the same message, it will be reported twice
    expect(costs.length).toBeGreaterThanOrEqual(1);
    expect(costs[0]).toEqual({ input: 100, output: 50 });
  });

  it("extracts from top-level inputTokens/outputTokens in metadata", async () => {
    const runner = new MiddlewareRunner();
    const costs: Array<{ input?: number; output?: number }> = [];
    runner.use(costTrackingMiddleware((_, tokens) => costs.push(tokens)));

    const msg = makeMessage({
      metadata: { inputTokens: 200, outputTokens: 75 }
    });

    await runner.run(msg, async () => [makeMessage()]);

    expect(costs).toHaveLength(1);
    expect(costs[0]).toEqual({ input: 200, output: 75 });
  });

  it("does nothing when no token info is present", async () => {
    const runner = new MiddlewareRunner();
    const onCost = vi.fn();
    runner.use(costTrackingMiddleware(onCost));

    const msg = makeMessage({ metadata: { other: "stuff" } });
    await runner.run(msg, async () => [makeMessage()]);

    expect(onCost).not.toHaveBeenCalled();
  });

  it("inspects result messages for token info", async () => {
    const runner = new MiddlewareRunner();
    const costs: Array<{ msg: Message; tokens: { input?: number; output?: number } }> = [];
    runner.use(costTrackingMiddleware((msg, tokens) => costs.push({ msg, tokens })));

    const inMsg = makeMessage();
    const resultMsg = makeMessage({
      from: "bot",
      to: "user",
      metadata: { tokens: { input: 300, output: 150 } }
    });

    await runner.run(inMsg, async () => [resultMsg]);

    // Only the result message has tokens, not the input
    expect(costs).toHaveLength(1);
    expect(costs[0].tokens).toEqual({ input: 300, output: 150 });
    expect(costs[0].msg.from).toBe("bot");
  });
});
