// Middleware Demo — Logging, cost tracking, and rate limiting
// Demonstrates: MiddlewareRunner, loggingMiddleware, costTrackingMiddleware, rateLimitMiddleware
// Run: npx tsx examples/middleware-demo.ts

import { Router, ModelActor, scriptedModel, MiddlewareRunner, loggingMiddleware, costTrackingMiddleware, rateLimitMiddleware, createMessage, contentToText } from "../packages/verbum/src/index.js";

async function main() {
  // -- Set up middleware stack --
  const mw = new MiddlewareRunner();

  // 1. Logging: prints every dispatch
  mw.use(loggingMiddleware((msg) => console.log(`  LOG: ${msg}`)));

  // 2. Cost tracking: accumulates token usage
  let totalInput = 0;
  let totalOutput = 0;
  mw.use(
    costTrackingMiddleware((_msg, tokens) => {
      totalInput += tokens.input ?? 0;
      totalOutput += tokens.output ?? 0;
      console.log(`  COST: +${tokens.input ?? 0} input, +${tokens.output ?? 0} output tokens`);
    })
  );

  // 3. Rate limiting: max 5 messages per minute (low for demo)
  mw.use(rateLimitMiddleware({ maxPerMinute: 5, perActor: true }));

  // -- Simple model that returns token metadata --
  const router = new Router({ maxDepth: 6 });

  const assistant = new ModelActor({
    id: "assistant",
    provider: "scripted",
    model: "demo-v1",
    adapter: scriptedModel(() => ({
      text: "Middleware processed this message through logging, cost tracking, and rate limiting.",
      metadata: { tokens: { input: 150, output: 42 } },
    })),
  });

  router.register(assistant);

  // Wrap router.send to run middleware around each dispatch
  const originalSend = router.send.bind(router);
  const wrappedSend = async (draft: Parameters<typeof router.send>[0]) => {
    const message = createMessage({
      ...draft,
      from: draft.from ?? "system",
      conversationId: draft.conversationId ?? "default",
    });
    return mw.run(message, () => originalSend(draft));
  };

  console.log("=== Middleware Demo ===\n");

  // Send a few messages to see middleware in action
  for (let i = 1; i <= 3; i++) {
    console.log(`--- Message ${i} ---`);
    await wrappedSend({
      from: "user",
      to: "assistant",
      role: "user" as const,
      conversationId: "mw-demo",
      content: { type: "text" as const, text: `Question ${i}: How does middleware work?` },
    });
    console.log();
  }

  console.log(`=== Token totals: ${totalInput} input, ${totalOutput} output ===`);

  // Demonstrate rate limit error
  console.log("\n--- Rate limit test ---");
  try {
    for (let i = 0; i < 10; i++) {
      await wrappedSend({
        from: "user",
        to: "assistant",
        role: "user" as const,
        conversationId: "rate-test",
        content: { type: "text" as const, text: `Rapid fire ${i}` },
      });
    }
  } catch (err) {
    console.log(`  Rate limit triggered: ${(err as Error).message}`);
  }
}

main().catch(console.error);
