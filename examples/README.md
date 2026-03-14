# Verbum Examples

Runnable examples demonstrating the Verbum framework. All examples use `scriptedModel` so they work without API keys.

## Running

From the repository root:

```bash
npx tsx examples/code-reviewer.ts
npx tsx examples/multi-model-debate.ts
npx tsx examples/shell-pipeline.ts
npx tsx examples/middleware-demo.ts
```

## Examples

### `code-reviewer.ts` — Multi-actor code review agent

A **ModelActor** drives a review pipeline: it asks a **ProcessActor** to run `git diff`, analyzes the output, stores the review in a **MemoryActor**, and reports back to the user. Shows how to wire multiple actor types through a Router.

### `multi-model-debate.ts` — Two models debate a topic

Two **ModelActors** (simulating Claude and GPT) argue tabs vs spaces. A **ToolActor** judges their arguments. Demonstrates multi-turn routing where models address each other, and how `router.visualize()` captures the conversation graph.

### `shell-pipeline.ts` — DevOps pipeline as conversation

Models a CI/CD pipeline as actor conversation. A **ModelActor** orchestrator drives **ProcessActors** for build and test steps, then triggers a **ToolActor** deployment. Shows how imperative workflows map naturally to Verbum's message-passing model.

### `middleware-demo.ts` — Middleware in action

Sets up `loggingMiddleware`, `costTrackingMiddleware`, and `rateLimitMiddleware` in a `MiddlewareRunner`. Demonstrates how middleware wraps message dispatch for observability, cost control, and rate limiting.

## Using real LLMs

Every example uses `scriptedModel` for offline execution. To use a real model, swap the adapter:

```ts
import { anthropicAdapter } from "../packages/verbum/src/adapters/anthropic.js";

const reviewer = new ModelActor({
  id: "reviewer",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  adapter: anthropicAdapter(),  // reads ANTHROPIC_API_KEY from env
});
```
