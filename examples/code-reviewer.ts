// Code Review Agent — Multi-actor code review pipeline
// Demonstrates: ModelActor (scriptedModel), ProcessActor, MemoryActor, Router wiring
// Run: npx tsx examples/code-reviewer.ts
//
// To use a real LLM instead of scriptedModel, swap the adapter:
//   import { anthropicAdapter } from "../packages/verbum/src/adapters/anthropic.js";
//   adapter: anthropicAdapter({ model: "claude-sonnet-4-20250514" })

import { Router, ModelActor, scriptedModel, ProcessActor, MemoryActor, contentToText } from "../packages/verbum/src/index.js";

async function main() {
  const router = new Router({ maxDepth: 10 });

  // -- Shell actor: runs commands and returns output --
  const shell = new ProcessActor({ id: "shell", timeoutMs: 5000 });

  // -- Memory actor: stores completed reviews --
  const memory = new MemoryActor({ id: "memory" });

  // -- Reviewer actor: scripted model that drives the review flow --
  let step = 0;
  const reviewer = new ModelActor({
    id: "reviewer",
    provider: "scripted",
    model: "code-review-v1",
    system: "You are an expert code reviewer. Be concise and actionable.",
    adapter: scriptedModel(() => {
      step++;
      if (step === 1) {
        // User asked to review — ask shell to show the diff
        return { text: 'echo "--- a/src/router.ts\\n+++ b/src/router.ts\\n@@ -74,6 +74,7 @@\\n   async send(msg) {\\n+    if (!msg.to) throw new Error(\\"Missing recipient\\");\\n     const message = createMessage(msg);\\n   }"', routeTo: "shell" };
      }
      if (step === 2) {
        // Got diff back — produce the review, store in memory
        return { text: "remember: REVIEW src/router.ts — Added input validation for missing recipient. LGTM with 2 suggestions: (1) include sender id in error message, (2) use early return pattern.", routeTo: "memory" };
      }
      // Memory stored it — send summary to user
      return { text: "Review complete. 1 approval with 2 minor suggestions stored in memory.", routeTo: "user" };
    }),
  });

  router.register(reviewer);
  router.register(shell);
  router.register(memory);

  // Log every message for visibility
  router.on("message", (msg) => {
    const preview = contentToText(msg.content).slice(0, 120);
    console.log(`  [${msg.from} -> ${msg.to}] ${preview}`);
  });

  console.log("=== Code Review Agent ===\n");

  const transcript = await router.send({
    from: "user",
    to: "reviewer",
    role: "user",
    conversationId: "review-1",
    content: { type: "text", text: "Please review src/router.ts" },
  });

  console.log(`\n=== Done: ${transcript.length} messages exchanged ===`);
  console.log(`Memory entries: ${memory.all().length}`);

  // Show the conversation graph
  const graph = router.visualize();
  console.log("\nConversation graph:");
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} -> ${edge.to} (${edge.count} messages)`);
  }

  shell.dispose();
}

main().catch(console.error);
