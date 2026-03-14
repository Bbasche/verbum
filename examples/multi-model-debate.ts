// Multi-Model Debate — Two models argue, a tool judges
// Demonstrates: multiple ModelActors, ToolActor as judge, conversation graph
// Run: npx tsx examples/multi-model-debate.ts

import { Router, ModelActor, scriptedModel, ToolActor, contentToText } from "../packages/verbum/src/index.js";

async function main() {
  const router = new Router({ maxDepth: 12 });
  let claudeTurn = 0;

  // Claude argues for tabs.
  // Turn 1: opening argument, routes to GPT
  // Turn 2: rebuttal after hearing GPT, routes to judge
  // Turn 3: received judge's verdict, summarizes to moderator (terminates)
  const claude = new ModelActor({
    id: "claude",
    provider: "scripted",
    model: "claude-debate",
    adapter: scriptedModel((ctx) => {
      claudeTurn++;
      if (claudeTurn === 1) {
        return { text: "Tabs provide consistent rendering across editors, are more accessible (users set their own width), and use fewer bytes. One character per indent level is semantically clean.", routeTo: "gpt" };
      }
      if (claudeTurn === 2) {
        return { text: "Spaces break in terminals with tab-width mismatches. The accessibility argument is definitive — WCAG recommends user-configurable indentation. Tabs win on principle and pragmatism.", routeTo: "judge" };
      }
      // Turn 3: judge returned the verdict — relay it to moderator
      const verdict = contentToText(ctx.message.content);
      return { text: `The judge has ruled. ${verdict}`, routeTo: "moderator" };
    }),
  });

  // GPT argues for spaces. Returns to claude for rebuttal.
  const gpt = new ModelActor({
    id: "gpt",
    provider: "scripted",
    model: "gpt-debate",
    adapter: scriptedModel(() => {
      return { text: "Spaces guarantee pixel-perfect alignment everywhere — GitHub, diffs, printed code. The 'fewer bytes' argument is irrelevant with modern compression. Most major open-source projects use spaces.", routeTo: "claude" };
    }),
  });

  // Judge scores both arguments. Result goes back to sender (claude).
  const judge = new ToolActor({
    id: "judge",
    description: "Scores debate arguments on clarity, evidence, and persuasion",
    execute: () => ({
      verdict: "Split decision",
      scores: {
        claude: { clarity: 9, evidence: 7, persuasion: 8, total: 24 },
        gpt: { clarity: 8, evidence: 8, persuasion: 7, total: 23 },
      },
      summary: "Claude wins narrowly on accessibility. GPT's ecosystem evidence was strong.",
    }),
  });

  router.register(claude);
  router.register(gpt);
  router.register(judge);

  router.on("message", (msg) => {
    const preview = contentToText(msg.content).slice(0, 110);
    console.log(`  [${msg.from} -> ${msg.to}] ${preview}`);
  });

  console.log("=== Multi-Model Debate: Tabs vs Spaces ===\n");

  const transcript = await router.send({
    from: "moderator",
    to: "claude",
    role: "user",
    conversationId: "debate-1",
    content: { type: "text", text: "Debate: Tabs vs Spaces. Claude argues for tabs, GPT for spaces. Go." },
  });

  console.log(`\n=== ${transcript.length} messages in the debate ===`);

  const graph = router.visualize();
  console.log("\nDebate flow:");
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} -> ${edge.to} (${edge.count}x)`);
  }
}

main().catch(console.error);
