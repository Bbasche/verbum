# Verbum — Full MVP Specification
> *Everything is a conversation.*

---

## 1. Vision & Positioning

**Verbum** is an open-source TypeScript framework that models every computational participant — AI models, terminals, subprocesses, humans, databases, file systems — as a conversational **Actor**. Actors exchange **Messages**. A **Router** orchestrates the flow. The result is a unified, observable, replayable graph of everything your system is saying to itself.

**Tagline**: *Everything is a conversation.*

**Target**: Developers building multi-agent systems, LLM-powered tools, or complex AI pipelines who want a framework built around the right abstraction — messages — rather than one that bolts conversations onto an RPC model as an afterthought.

**OSS Strategy**: MIT licensed. Built in public. Viral via CLI demo + great DX + honest README.

---

## 2. Core Concepts

### 2.1 Actor
An Actor is any participant in the system. It has:
- A unique `id` and `type`
- A `capabilities` descriptor (what it can handle)
- A `receive(message)` method that returns 0–N outgoing messages
- Optional `context` — a rolling conversation window

```ts
interface Actor {
  id: string
  type: ActorType
  capabilities: string[]
  receive(message: Message): Promise<Message[]>
}

type ActorType =
  | 'model'      // Claude, GPT, Gemini, Ollama
  | 'process'    // terminal, shell, subprocess, CLIs
  | 'mcp'        // MCP protocol servers (stdio or SSE)
  | 'tool'       // deterministic API wrappers, functions
  | 'human'      // stdin, webhook, websocket
  | 'memory'     // vector DB, KV store, file
  | 'router'     // orchestration logic
```

### 2.2 Message
The universal unit of exchange. Inspired by chat message format but extended.

```ts
interface Message {
  id: string
  from: string           // actor id
  to: string             // actor id or '*' for broadcast
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: MessageContent
  metadata?: Record<string, unknown>
  timestamp: number
  conversationId: string
  parentId?: string      // for threading
}

type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; output: unknown; error?: string }
  | { type: 'binary'; mimeType: string; data: Buffer }
```

### 2.3 Conversation
A named, addressable thread of messages between actors. Conversations can be:
- **Linear** — A→B→A→B
- **Branched** — fork at any message, explore alternate paths
- **Composite** — a meta-conversation that aggregates sub-conversations

```ts
interface Conversation {
  id: string
  participants: string[]   // actor ids
  messages: Message[]
  metadata: Record<string, unknown>
  fork(fromMessageId: string): Conversation
  replay(speed?: number): AsyncIterable<Message>
}
```

### 2.4 Router
The runtime. Receives messages, resolves target actors, dispatches, collects responses, emits events.

```ts
interface Router {
  register(actor: Actor): void
  send(message: Message): Promise<Message[]>
  broadcast(message: Omit<Message, 'to'>): Promise<Message[]>
  on(event: RouterEvent, handler: Handler): void
  getConversation(id: string): Conversation
  visualize(): ConversationGraph
}
```

---

## 3. Built-in Actors (MVP)

### 3.1 ModelActor
Wraps any LLM provider. Normalizes to Verbum message format.

**Supported providers (MVP):**
- Anthropic (Claude 3.x / 4.x)
- OpenAI (GPT-4o, o1)
- Google (Gemini 1.5 / 2.0)
- Ollama (local models)
- OpenRouter (catch-all)

```ts
const claude = new ModelActor({
  id: 'claude',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  system: 'You are a senior engineer.',
})
```

Provider adapters implement a single `ModelAdapter` interface — adding a new provider is ~30 lines.

### 3.2 ProcessActor
Wraps a terminal session or subprocess. Shell commands become messages.

```ts
const terminal = new ProcessActor({
  id: 'shell',
  shell: '/bin/bash',
  cwd: process.cwd(),
  env: process.env,
})

// Sending a message to a ProcessActor:
// { content: { type: 'text', text: 'ls -la' } }
// Response: { content: { type: 'text', text: '...' } }
```

ProcessActor maintains a persistent shell session — state carries across messages (env vars, directory changes).

### 3.3 HumanActor
Represents a human participant. Pluggable transports.

**MVP transports:**
- `StdinTransport` — interactive CLI
- `WebSocketTransport` — browser/app integration
- `WebhookTransport` — async human input (Slack, SMS)

```ts
const human = new HumanActor({
  id: 'user',
  transport: new StdinTransport(),
})
```

### 3.4 MemoryActor
Persistent context. Reads and writes based on semantic queries or keys.

**MVP backends:**
- In-memory (default)
- File (JSON / JSONL)
- SQLite (via `better-sqlite3`)
- Qdrant (vector search)

```ts
const memory = new MemoryActor({
  id: 'memory',
  backend: new SqliteBackend('./verbum.db'),
})
```

### 3.5 ToolActor
A deterministic function exposed as a conversational participant. First-class alternative to "tool calling" — tools can also *initiate* messages.

```ts
const calculator = new ToolActor({
  id: 'calculator',
  description: 'Evaluates mathematical expressions',
  execute: async ({ expression }) => ({ result: eval(expression) }),
})
```

### 3.6 MCPActor
Wraps any MCP (Model Context Protocol) server — stdio or SSE transport. Automatically discovers the tools the server exposes and registers their capabilities, making the entire MCP ecosystem available as Verbum participants.

Internally, `MCPActor` is a `ProcessActor` with a JSON-RPC layer on top. From the Router's perspective it's just another actor.

```ts
const filesystem = new MCPActor({
  id: 'mcp-filesystem',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
})

const browserTools = new MCPActor({
  id: 'mcp-browser',
  transport: 'sse',
  url: 'http://localhost:3100/sse',
})
```

On startup, `MCPActor` calls `tools/list` and registers each returned tool as a capability. When a message arrives that matches a capability, it calls `tools/call` and returns the result as a Message. The full tool invocation appears as an edge in the conversation graph.

**MCP compatibility**: any MCP server that works with Claude Code works with Verbum. The protocol is the contract.

---

## 4. Router Internals

### 4.1 Dispatch Pipeline
```
Message In
  → Middleware chain (auth, logging, rate limit)
  → Resolve target Actor
  → Actor.receive(message)
  → Collect response messages
  → Route response messages (recurse if needed)
  → Emit events
  → Return to caller
```

### 4.2 Middleware
```ts
type Middleware = (
  message: Message,
  next: (msg: Message) => Promise<Message[]>
) => Promise<Message[]>

router.use(loggingMiddleware())
router.use(rateLimitMiddleware({ maxTokensPerMinute: 100_000 }))
router.use(retryMiddleware({ attempts: 3, backoff: 'exponential' }))
```

### 4.3 Routing Strategies
- **Direct** — `to: 'actor-id'` — explicit target
- **Broadcast** — `to: '*'` — all registered actors
- **Semantic** — `to: { capability: 'code-execution' }` — router resolves best match
- **Pipeline** — `to: ['actor-1', 'actor-2']` — sequential chaining
- **Parallel** — `to: { parallel: ['actor-1', 'actor-2'] }` — fan-out, collect all

---

## 5. Conversation Graph

Every run produces a **ConversationGraph** — a DAG of messages and actors.

- Serializable to JSON
- Replayable at any speed
- Forkable from any node
- Diffable between runs
- Exportable to Mermaid / DOT / JSON

```ts
const graph = router.visualize()
graph.toMermaid()   // → mermaid diagram string
graph.replay()      // → AsyncIterable<Message>
graph.fork('msg-42') // → new Router with forked state
```

---

## 6. CLI — `verbum`

The CLI is the primary developer interface and the viral demo surface.

### Commands

```bash
verbum init                    # scaffold a new project
verbum run ./my-flow.ts        # execute a flow file
verbum replay ./run-123.json   # replay a recorded run
verbum visualize ./run-123.json # open interactive graph viewer
verbum actors list             # show registered actors
verbum providers test          # verify API key connectivity
verbum export --format mermaid # export conversation graph
```

### Live Visualization
`verbum run` streams a live terminal UI (via Ink) showing:
- Active actors (colored nodes)
- Messages flowing between them (animated arrows)
- Token counts and latency per actor
- Current conversation tree

This is the **demo moment** — watching a terminal, Claude, and a memory store converse in real time to solve a task is viscerally compelling.

---

## 7. Configuration

```ts
// verbum.config.ts
import { defineConfig } from 'verbum'

export default defineConfig({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    ollama: { baseUrl: 'http://localhost:11434' },
  },
  router: {
    middleware: ['logging', 'retry'],
    maxConcurrentConversations: 10,
  },
  memory: {
    backend: 'sqlite',
    path: './verbum.db',
  },
  record: true, // save all runs to ./runs/
})
```

---

## 8. Developer Experience — Getting Started

```bash
npm install verbum
```

```ts
import { Router, ModelActor, ProcessActor, HumanActor } from 'verbum'

const router = new Router()

router.register(new ModelActor({
  id: 'claude',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
}))

router.register(new ProcessActor({
  id: 'shell',
  shell: '/bin/bash',
}))

// Claude and a shell, working together
const result = await router.send({
  from: 'user',
  to: 'claude',
  role: 'user',
  content: { type: 'text', text: 'List the 3 largest files in my home directory using the shell' },
  conversationId: 'run-1',
})
```

That's it. Claude figures out it needs the shell, routes to it, gets the result, responds to the user. No tool schemas. No manual wiring.

---

## 9. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | TypeScript | Ecosystem, DX, type safety |
| Runtime | Node.js 20+ | Broad adoption, stable |
| Build | tsup | Fast, zero-config |
| CLI UI | Ink (React for terminals) | Rich live UI |
| Testing | Vitest | Fast, ESM-native |
| Docs | Starlight (Astro) | Beautiful OSS docs |
| Package | npm + JSR | Maximum reach |
| CI | GitHub Actions | Standard |
| Monorepo | pnpm workspaces | Clean separation |

### Package Structure
```
verbum/
├── packages/
│   ├── core/          # Router, Message, Actor interfaces
│   ├── actors/        # Built-in actor implementations
│   ├── providers/     # Model provider adapters
│   ├── memory/        # Memory backends
│   ├── cli/           # verbum CLI
│   ├── devtools/      # Graph visualizer (browser)
│   └── network/       # Phase 4 — RemoteActor, transports, identity, mesh
├── examples/
│   ├── basic/
│   ├── multi-agent/
│   ├── terminal-agent/
│   ├── human-in-loop/
│   └── federated/     # Phase 4 — two-node + Nostr human example
└── docs/
```

`@verbum/network` is fully optional — only install when federation is needed. Core remains zero-dependency.

---

## 10. MVP Scope & Milestones

### Phase 1 — Core (Weeks 1–2)
- [ ] `Message`, `Actor`, `Router` interfaces
- [ ] `ModelActor` with Anthropic + OpenAI adapters
- [ ] `ProcessActor` with bash
- [ ] Basic `verbum run` CLI
- [ ] JSON conversation recording
- [ ] README + 3 examples
- [ ] Published to npm

### Phase 2 — DX & Ecosystem (Weeks 3–4)
- [ ] `HumanActor` (stdin transport)
- [ ] `MemoryActor` (SQLite backend)
- [ ] `ToolActor`
- [ ] `MCPActor` (stdio + SSE transports, auto tool discovery)
- [ ] Middleware system
- [ ] `verbum replay` CLI
- [ ] Live terminal visualizer (Ink)
- [ ] Gemini + Ollama provider adapters
- [ ] Docs site (Starlight)

### Phase 3 — Viral Surface (Weeks 5–6)
- [ ] `verbum visualize` — interactive browser graph
- [ ] Conversation forking + diffing
- [ ] Semantic routing
- [ ] OpenClaw compatibility shim
- [ ] LangChain tool import adapter
- [ ] Blog post + HN launch

### Phase 4 — Federated Mesh (Weeks 7–10)
> *Conversations that span machines, networks, and humans — without a server.*

#### 4.1 Core additions

**`RemoteActor`** — an Actor whose `receive()` sends over a network transport instead of calling local code. From the Router's perspective, indistinguishable from a local actor.

```ts
router.register(new RemoteActor({
  id: 'remote-gemini',
  address: 'gemini@npub1xyz...',
  transport: new NostrTransport({ relays: ['wss://relay.damus.io'] }),
}))

// Identical API to local actors
await router.send({ from: 'user', to: 'remote-gemini', content: { type: 'text', text: '...' } })
```

**Actor type extension:**
```
Actor (abstract)
├── ModelActor
├── ProcessActor
├── HumanActor
├── MemoryActor
├── ToolActor
└── RemoteActor         ← Phase 4
    ├── NostrTransport  ← p2p, no server required
    ├── WebSocketTransport
    ├── NATSTransport
    └── HTTPTransport   ← simple webhook-style
```

#### 4.2 Network envelope

`Message` gains optional network fields — local messages ignore them entirely, no breaking change:

```ts
interface Message {
  // all existing fields unchanged...

  // optional — only present on network messages
  origin?: {
    nodeId: string       // ed25519 pubkey of sending Verbum node
    signature: string    // signs content + conversationId + timestamp
    transport: string    // 'nostr' | 'ws' | 'nats' | 'http'
  }
  routing?: {
    ttl: number          // hop limit, prevents cycles
    relays?: string[]    // nostr: preferred relay list
    encrypt?: boolean    // NIP-44 encryption for Nostr; TLS for WS
  }
}
```

#### 4.3 Node identity & discovery

Every Verbum node gets an ed25519 keypair on `verbum init`. Nodes publish a signed capability manifest:

```ts
interface NodeManifest {
  nodeId: string           // ed25519 pubkey
  actors: {
    id: string
    capabilities: string[]
    public: boolean        // whether discoverable by the mesh
  }[]
  endpoint: string         // e.g. 'wss://relay.verbum.dev' or nostr pubkey
  signature: string        // self-signed
}
```

Routing to `claude@npub1abc...` resolves via the manifest. No DNS. No central registry.

#### 4.4 Why Nostr as the p2p primitive

Nostr is a signed-message relay protocol — every event is signed by a keypair, relays are dumb pipes, there is no central server. It already models the world as messages. Key properties that make it right for Verbum:

- **No infrastructure required** — use public relays (damus, nostr.wine, etc.) or self-host
- **Offline-tolerant** — relays buffer messages; actors pick up on reconnect
- **Signed by default** — message provenance is cryptographically guaranteed
- **Human-native** — any person with a Nostr client (dozens exist) can participate in a Verbum conversation without a custom app. A `HumanActor` with `NostrTransport` is a person's Nostr identity.
- **Encryption built in** — NIP-44 for private conversations between nodes

#### 4.5 Security model

| Concern | Solution |
|---------|----------|
| Message authenticity | ed25519 signatures on every network message |
| Replay attacks | `timestamp` + `conversationId` in signed payload |
| Impersonation | Actor capability manifests are signed by node keypair |
| Privacy | NIP-44 encryption opt-in per conversation |
| Untrusted relays | Signatures verified client-side; relay cannot forge |
| Hop loops | `ttl` decrements at each hop; dropped at 0 |

#### 4.6 CLI additions

```bash
verbum node init           # generate keypair, write verbum.node.json
verbum node announce       # publish capability manifest to relays
verbum node discover       # list reachable nodes on the mesh
verbum mesh status         # show connected peers + latency
verbum mesh relay add <url> # add a relay to your node config
```

#### 4.7 Package additions

```
verbum/
└── packages/
    └── network/           # Phase 4 — new package
        ├── RemoteActor.ts
        ├── transports/
        │   ├── NostrTransport.ts
        │   ├── WebSocketTransport.ts
        │   ├── NATSTransport.ts
        │   └── HTTPTransport.ts
        ├── identity/
        │   ├── Keypair.ts
        │   └── NodeManifest.ts
        └── discovery/
            └── MeshRegistry.ts
```

Fully optional — `npm install @verbum/network` only if you need it. Core stays zero-dependency.

#### 4.8 What this unlocks

- **Agent mesh** — Claude on your laptop routes to a Gemini instance on another machine; conversation graph spans both nodes transparently
- **Distributed memory** — `MemoryActor` instances can sync or query across nodes
- **Human network** — any person with a Nostr identity is reachable as a `HumanActor` from anywhere on the mesh
- **Federated workflows** — a pipeline can span organizations; each node controls its own actors; the protocol is the contract
- **No lock-in** — no Verbum Cloud required; the mesh is the infrastructure

#### 4.9 Phase 4 milestones checklist
- [ ] `RemoteActor` base class + transport interface
- [ ] `WebSocketTransport` (simplest, good for LAN / same-org)
- [ ] Node keypair generation + `verbum node init`
- [ ] `NodeManifest` signing + verification
- [ ] `NostrTransport` (public p2p, no server)
- [ ] Message signing + signature verification middleware
- [ ] NIP-44 encryption support
- [ ] `verbum node discover` + mesh CLI commands
- [ ] `NATSTransport` (for teams running their own infra)
- [ ] Federated conversation graph (spans multiple nodes)
- [ ] End-to-end example: two Verbum nodes + human via Nostr client
- [ ] Security audit of signing implementation
- [ ] Docs: federation guide + threat model

---

## 11. Competitive Positioning

| Feature | Verbum | OpenClaw | LangChain | AutoGen |
|---------|--------|----------|-----------|---------|
| Everything-is-a-message | ✅ | ❌ | ❌ | ❌ |
| Terminal as first-class Actor | ✅ | ❌ | ❌ | ❌ |
| MCP servers as first-class Actor | ✅ | Partial | Partial | ❌ |
| Human Actor (native pause/resume) | ✅ | Partial | Partial | Partial |
| Provider-symmetric | ✅ | ✅ | ✅ | ✅ |
| Conversation graph / replay | ✅ | ❌ | ❌ | ❌ |
| Portable context (swap models mid-flight) | ✅ | ❌ | ❌ | ❌ |
| Zero-config start | ✅ | ❌ | ❌ | ❌ |
| TypeScript-native | ✅ | ✅ | Partial | ❌ |
| Federated p2p mesh (Phase 4) | ✅ | ❌ | ❌ | ❌ |
| Human-via-Nostr (Phase 4) | ✅ | ❌ | ❌ | ❌ |

---

## 12. Open Source Strategy

- **License**: MIT
- **GitHub**: `verbum-ai/verbum`
- **Launch target**: Hacker News "Show HN" + r/LocalLLaMA + X/Twitter demo thread
- **Demo clip**: 60s terminal recording showing Claude + shell + memory solving a real coding task, messages flowing live
- **Contributor hooks**: Clear `good-first-issue` labels, CONTRIBUTING.md, Discord
- **Sustainability**: Verbum Cloud (hosted graph replay + team collaboration) as eventual revenue path — framework stays fully free

---

## 13. Marketing Page Copy

*(See verbum-marketing.html for rendered version)*

---

# Everything is a conversation.

**Verbum** is an open-source framework that treats every computational participant — AI models, terminals, humans, databases — as a conversational actor. They send messages. They receive messages. The rest is routing.

Stop wiring. Start talking.

```bash
npm install verbum
```

---

### Why Verbum?

Current AI frameworks bolt conversations onto an RPC model. You call tools. Tools return values. You call models. Models return strings. It's imperative, opaque, and fragile.

Verbum inverts this. Every entity in your system is an Actor. Every interaction is a Message. Your terminal isn't a "tool" — it's a participant. Your database isn't a "retriever" — it's in the conversation. Your human isn't a "callback" — they're a first-class actor.

This changes everything:

**Unified observability.** Every interaction — AI to AI, AI to shell, human to model — is a readable, structured message. No more grepping logs or tracing hex blobs.

**Replayable runs.** Every conversation is recorded. Replay it at any speed. Fork it from any message. Debug the exact moment things went wrong.

**Provider freedom.** Swap Claude for Gemini or GPT by changing one line. Verbum is symmetric — no provider is privileged.

**Composable by nature.** Actors forward messages to other actors. Pipelines emerge from routing rules, not imperative chains. Your architecture is a graph, not spaghetti.

---

### The Actors

```ts
// An AI model
new ModelActor({ id: 'claude', provider: 'anthropic', model: '...' })

// A terminal session
new ProcessActor({ id: 'shell', shell: '/bin/bash' })

// A human
new HumanActor({ id: 'user', transport: new StdinTransport() })

// Persistent memory
new MemoryActor({ id: 'memory', backend: new SqliteBackend() })
```

Same interface. Same message format. Infinite composability.

---

### Five lines to multi-agent

```ts
import { Router, ModelActor, ProcessActor } from 'verbum'

const router = new Router()
router.register(new ModelActor({ id: 'claude', provider: 'anthropic' }))
router.register(new ProcessActor({ id: 'shell' }))

await router.send({ from: 'user', to: 'claude', content: 'Find the largest file in this repo' })
```

Claude figures out it needs the shell. Routes to it. Gets the answer. Responds. You didn't write a single tool schema.

---

### Built for developers who've felt the pain

- Tired of OpenClaw's Claude-centrism
- Frustrated that your terminal is a second-class citizen
- Wanted to replay a failed agent run and couldn't
- Wished you could swap models mid-conversation
- Just wanted things to be simpler

Verbum is for you.

---

*MIT licensed. Built in public. No vendor lock-in.*

**[Get started →](https://verbum.dev/docs)**  
**[GitHub](https://github.com/verbum-ai/verbum)**  
**[Discord](https://discord.gg/verbum)**
