// Shell Pipeline — CI/CD as a conversation between actors
// Demonstrates: multiple ProcessActors, ModelActor orchestrator, ToolActor deploy
// Run: npx tsx examples/shell-pipeline.ts

import { Router, ModelActor, scriptedModel, ProcessActor, ToolActor, contentToText } from "../packages/verbum/src/index.js";

async function main() {
  const router = new Router({ maxDepth: 12 });

  const buildShell = new ProcessActor({ id: "build", timeoutMs: 5000 });
  const testShell = new ProcessActor({ id: "test", timeoutMs: 5000 });

  const deploy = new ToolActor({
    id: "deploy",
    description: "Deploys the build artifact to production",
    execute: () => ({
      status: "deployed",
      url: "https://app.example.com",
      version: "1.0.42",
      timestamp: new Date().toISOString(),
    }),
  });

  let phase = 0;
  const orchestrator = new ModelActor({
    id: "orchestrator",
    provider: "scripted",
    model: "pipeline-v1",
    adapter: scriptedModel(() => {
      phase++;
      if (phase === 1) {
        return { text: 'echo "Compiling 12 modules... done. Build artifact: dist/app.js (48KB)"', routeTo: "build" };
      }
      if (phase === 2) {
        return { text: 'echo "Running 47 tests... 47 passed, 0 failed. Coverage: 94%"', routeTo: "test" };
      }
      if (phase === 3) {
        return { text: "deploy to production", routeTo: "deploy" };
      }
      return { text: "Pipeline complete. Build OK, 47/47 tests passing (94% coverage), deployed to production.", routeTo: "user" };
    }),
  });

  router.register(orchestrator);
  router.register(buildShell);
  router.register(testShell);
  router.register(deploy);

  router.on("message", (msg) => {
    const preview = contentToText(msg.content).slice(0, 100);
    console.log(`  [${msg.from} -> ${msg.to}] ${preview}`);
  });

  console.log("=== DevOps Pipeline as Conversation ===\n");

  const transcript = await router.send({
    from: "user",
    to: "orchestrator",
    role: "user",
    conversationId: "pipeline-1",
    content: { type: "text", text: "Deploy the latest commit" },
  });

  console.log(`\n=== Pipeline finished: ${transcript.length} messages ===`);

  const graph = router.visualize();
  console.log("\nPipeline graph:");
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} -> ${edge.to} (${edge.count}x)`);
  }

  buildShell.dispose();
  testShell.dispose();
}

main().catch(console.error);
