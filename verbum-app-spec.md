# Verbum App — Product & Technical Specification
> *The god-view of every conversation your system is having.*

---

## 1. What It Is

Verbum App is a native macOS application that serves as the observation, orchestration, and chat management layer for everything running on the Verbum framework — and beyond. It ingests conversation streams from Verbum-powered agents, Claude Code sessions, Codex CLI runs, terminal processes, and any connected chat frontend, then renders them as a unified, inspectable, live 3D conversation graph.

It is not a replacement for your terminal, your Claude Code TUI, or your chat UI. It is the layer above — the thing that shows you what everything is saying to everything else, all at once.

**Three modes in one app:**

1. **Observe** — watch live agent sessions, terminal streams, and model conversations as they happen
2. **Inspect** — pause, replay, fork, and diff any conversation in the graph
3. **Chat** — a first-class inbox for all human↔agent conversations across every source

---

## 2. Core Concepts

### 2.1 Session
A Session is any active or recorded conversation stream ingested by Verbum App. Sessions have a type:

```
Session
├── VerbumSession      — from a local verbum Router
├── ClaudeCodeSession  — from Claude Code SDK or session files
├── CodexSession       — from Codex CLI subprocess
├── TerminalSession    — raw shell/process stream
├── RemoteSession      — from a federated Verbum node (Phase 4)
└── ChatSession        — human↔agent chat from any frontend
```

### 2.2 Graph
The 3D Conversation Graph is the primary UI surface. Every Session is a node. Every message between sessions is an edge. The graph is:
- **Live** — edges animate as messages flow
- **Inspectable** — click any node or edge to see full message content
- **Filterable** — by actor type, provider, time range, session
- **Replayable** — scrub time to replay any session or the whole graph
- **Forkable** — branch from any message, explore alternate paths

### 2.3 Inbox
The Inbox is the unified chat interface. Every `HumanActor` conversation across all connected sources surfaces here. You reply from one place regardless of whether the underlying transport is stdin, WebSocket, Slack, or Nostr.

---

## 3. Integration Sources

### 3.1 Verbum Framework (native)
The tightest integration. Verbum App connects to a local Verbum Router via IPC (Unix socket) or WebSocket. The Router emits events on every message — App consumes them in real time.

```
verbum Router
  → IPC / WebSocket event stream
  → VerbumSession in App
  → live graph edges
```

Config: `verbum.config.ts` sets `devtools: true` to enable the App connection.

### 3.2 Claude Code

**Mode A — Headless SDK (recommended)**

Claude Code exposes `@anthropic-ai/claude-code` as a programmatic SDK. Verbum App ships a `ClaudeCodeBridge` that instantiates the SDK, intercepts the message stream (prompts, tool calls, file edits, shell commands, responses), and maps them to Verbum `Message` format.

```
ClaudeCodeBridge
  → @anthropic-ai/claude-code SDK
  → intercept: prompts, tool_calls, file_edits, shell_cmds, responses
  → map to Message[]
  → ClaudeCodeSession in App
```

Each Claude Code "turn" becomes a conversation thread in the graph. Tool calls (Bash, file edit, web fetch) appear as edges to child actors. The full agentic loop is visible.

**Mode B — Session file watcher (passive)**

For users who run Claude Code in their own terminal, the App watches `.claude/` for session state files and reconstructs conversation history passively.

```
FSWatcher → .claude/sessions/*.json
  → parse session state
  → reconstruct Message[]
  → ClaudeCodeSession in App (read-only)
```

This mode is observation-only. The user continues using Claude Code normally in their terminal.

**What Verbum App does NOT do with Claude Code:**
- Drive the TUI via stdin injection (fragile, unsupported)
- Parse ANSI escape codes from the terminal (brittle)
- Replace the Claude Code TUI

### 3.3 Codex CLI

Verbum App spawns Codex CLI as a managed subprocess with `--approval-mode full-auto` and captures structured stdout.

```
ProcessActor (codex subprocess)
  → spawn: codex --approval-mode full-auto --output-format json
  → parse JSON output stream
  → map to Message[]
  → CodexSession in App
```

For users calling OpenAI's API directly, the standard `ModelActor` OpenAI provider handles this — no subprocess needed.

**Codex limitations acknowledged:**
- No headless SDK equivalent to Claude Code's
- Subprocess / stdout mode only
- TUI driving not supported — observation only

### 3.4 Integration Comparison

| Integration mode | Claude Code | Codex CLI |
|---|---|---|
| Headless SDK | ✅ native `@anthropic-ai/claude-code` | ❌ not available |
| `--print` / subprocess | ✅ | ✅ |
| Session file watching | ✅ `.claude/sessions/` | partial |
| TUI stdin injection | ⚠️ fragile, not supported | ⚠️ fragile, not supported |
| Conversation graph replay | ✅ via SDK | ✅ via subprocess logs |

### 3.5 Terminal Sessions

Any shell or subprocess is ingested as a `TerminalSession` via PTY (pseudoterminal). The App reads the byte stream, strips ANSI, and segments into message-like turns (command → output pairs).

```
node-pty
  → PTY session
  → command/output segmentation
  → map to Message[]
  → TerminalSession in App
```

Works with any shell (bash, zsh, fish), any REPL (Python, Node), or any TUI. Users can optionally open a live interactive terminal pane inside the App for any session.

### 3.6 Chat Frontends

Verbum App runs a local WebSocket server (the **Chat Bridge**, default `ws://localhost:7331`) that any chat UI can connect to:

- Custom React/web UIs
- open-webui and similar self-hosted frontends
- Mobile apps on the local network
- Any WebSocket-capable client

The Chat Bridge translates chat messages into Verbum `Message` format, routes them through the App's internal Router, and streams responses back. From the frontend's perspective it's a standard streaming chat API. From Verbum's perspective, the human is a `HumanActor`.

### 3.7 Browser Extension (Chat Intercept)

An optional Manifest V3 Chrome/Brave/Arc extension observes claude.ai, chatgpt.com, and configurable URLs. It:
- Intercepts message send/receive events via DOM mutation observer
- Sends observed messages to the local Verbum App WS server
- Shows a status indicator in the toolbar (connected / disconnected)
- Is **observation only** — does not drive or inject into the browser UI
- Stores nothing externally — local App only

### 3.8 Remote Verbum Nodes (Phase 4)

When `@verbum/network` is available, Verbum App connects to remote nodes on the mesh. Remote sessions appear in the graph exactly like local sessions with a visual indicator showing they're federated.

---

## 4. The 3D Conversation Graph

The centrepiece. Everything orbits it.

### 4.1 Renderer

Built on **Three.js** + **React Three Fiber** inside an Electron shell. Force-directed 3D layout via `d3-force-3d` with custom physics tuned for conversation topology.

- **Actor nodes** — shaped by type, sized by message volume, coloured by actor class
- **Message edges** — animated arcs showing direction and flow
- **Conversation clusters** — related sessions naturally group in 3D space
- **Time axis** — optional z-axis maps to time; scrub to replay

### 4.2 Node Visual Language

| Actor Type | Shape | Colour |
|---|---|---|
| ModelActor (Claude) | Icosahedron | Amber `#c8842f` |
| ModelActor (OpenAI) | Icosahedron | Teal `#2f8ac8` |
| ModelActor (Gemini) | Icosahedron | Slate `#5a6a9a` |
| ModelActor (Ollama) | Icosahedron | Moss `#6a8a5a` |
| ProcessActor / Terminal | Cube | Graphite `#4a4a4a` |
| HumanActor | Ring | White `#f0ece0` |
| MemoryActor | Torus | Gold `#b8972a` |
| ToolActor | Octahedron | Muted red `#8a3a2a` |
| RemoteActor | Dodecahedron | Purple `#7a5a9a` |

### 4.3 Edge Visual Language

- **Thin animated line** — message in flight
- **Pulse speed** — proportional to token rate
- **Colour** — matches source actor type
- **Opacity** — fades for historical messages
- **Thickness** — scales with message size

### 4.4 Interactions

| Interaction | Action |
|---|---|
| Click node | Open actor inspector panel |
| Click edge | Open message inspector (full content) |
| Drag | Rotate graph |
| Scroll | Zoom |
| Cmd+click | Multi-select |
| Right-click node | Context menu: pause, fork, replay, disconnect |
| Right-click edge | Context menu: copy message, view raw, add to memory |
| Double-click node | Expand to show full conversation thread |
| Space | Play / pause timeline |
| ← → | Step through messages one at a time |

### 4.5 Filters & Views

- By actor type — show/hide any class
- By session — isolate one session's subgraph
- By time — range slider, live scrub
- By provider — Claude / OpenAI / Gemini / local
- By status — active, idle, errored
- Full-text search — matching nodes highlight in place

Saved views — name and save any filter combination.

### 4.6 Timeline Scrubber

Horizontal timeline at the bottom:
- Sessions as colour-coded swim lanes
- Message events as dots on each lane
- Playhead for replay
- Drag to scrub; space to play; 0.5×/1×/2×/5× speed

---

## 5. Inspector Panel

Slides in from the right on node/edge click.

### Actor Inspector
- Actor id, type, provider, model
- Capabilities list
- Message count, token count, avg latency
- Full scrollable + searchable conversation history
- "Open in Chat" (HumanActors)
- "Fork from here"
- "Export conversation" (JSON / Markdown / CSV)

### Message Inspector
- Full content (rendered Markdown)
- Raw JSON view toggle
- `from` / `to` / `role` / `timestamp` / `conversationId`
- Token count + latency
- Network envelope fields (Phase 4 — `origin.nodeId`, `signature`)
- Copy / Fork from this message / Add to MemoryActor

---

## 6. Inbox — Unified Chat

Three-column layout:

```
[Session list] | [Conversation thread] | [Actor context]
```

**Left — Session list**: All active ChatSession / HumanActor conversations by last activity. Source icon, unread count, last message preview.

**Centre — Thread**: Markdown-rendered messages, streaming token-by-token. Code blocks with syntax highlight + copy. Actor switcher dropdown — route your next message to any registered actor without losing context. The conversation carries over.

**Right — Actor context**: Live graph minimap for this conversation. Which actors are involved, tools called, memory reads/writes.

**Composer:**
- `/` command palette
- File drop (binary Message)
- `@actor-name` to address specific actor
- `#memory` to query MemoryActor inline
- Shortcut to pop thread into 3D graph view

---

## 7. Terminal Viewer

Dedicated tab for TerminalSessions:

- **Left** — list of sessions (name, PID, shell)
- **Main** — output rendered as conversation stream
  - Commands: right-aligned, monospace, dark background (outgoing)
  - Output: left-aligned blocks (incoming)
  - ANSI colour preserved
  - Long outputs collapsible
- **Graph button** — jump to this node in 3D graph
- **Live terminal toggle** — interactive PTY pane for the session

---

## 8. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Shell | Electron + Electron Forge | Native macOS, web tech, proven for dev tools |
| UI | React 19 | Component model, ecosystem |
| 3D graph | Three.js + React Three Fiber | Best-in-class 3D for Electron |
| Graph physics | d3-force-3d | Force-directed layout in 3D space |
| Graph edges | drei (Line2) | Smooth antialiased lines in Three.js |
| Styling | Tailwind CSS + CSS vars | Utility + custom theming |
| Terminal | xterm.js + node-pty | Industry standard for Electron terminal |
| State | Zustand | Lightweight, Electron-friendly |
| IPC (App↔Router) | Unix socket / WebSocket | Fast local comms |
| Claude Code bridge | @anthropic-ai/claude-code | Official SDK |
| File watching | chokidar | `.claude/` session file watcher |
| Build | electron-vite | Fast HMR in dev |
| Updates | electron-updater | Auto-update via GitHub releases |
| Persistence | better-sqlite3 | All messages stored locally |
| Distribution | DMG → Mac App Store (later) | Standard macOS |

### macOS-specific integrations
- Menu bar icon — active session count, quick-open
- Dock badge — unread Inbox count
- Notifications — task completion, errors, human-in-loop requests
- Spotlight — index conversation history
- Native window management — full-screen, Stage Manager compatible

---

## 9. App Architecture

```
Verbum App (Electron)
├── Main process (Node.js)
│   ├── SessionManager         — tracks all active/recorded sessions
│   ├── VerbumBridge           — IPC/WS → local Verbum Router
│   ├── ClaudeCodeBridge       — SDK + file watcher
│   ├── CodexBridge            — subprocess manager
│   ├── TerminalManager        — node-pty sessions
│   ├── ChatBridgeServer       — local WS for chat frontends
│   ├── BrowserExtensionServer — local WS for extension intercept
│   ├── MessageStore           — SQLite (better-sqlite3)
│   └── GraphLayoutEngine      — pre-computes 3D layout data
│
└── Renderer process (React)
    ├── GraphView              — Three.js / R3F 3D graph
    ├── InspectorPanel         — node/edge detail
    ├── InboxView              — unified chat
    ├── TerminalView           — terminal session viewer
    ├── SessionSidebar         — session list + filters
    └── TimelineScrubber       — playback controls
```

### Data flow
```
Source (Claude Code / Codex / Terminal / Chat frontend / Browser ext)
  → Bridge (normalise to Message[])
  → SessionManager
  → MessageStore (SQLite)
  → GraphLayoutEngine (update force layout)
  → IPC → Renderer
  → GraphView (live edge animation)
  → InspectorPanel (if node/edge selected)
  → InboxView (if ChatSession)
```

---

## 10. Chat Frontend Integration Protocol

Any chat UI connects to `ws://localhost:7331`.

### Handshake
```json
{ "type": "register", "clientId": "my-ui", "displayName": "My Chat App" }
// App responds:
{ "type": "registered", "sessionId": "chat-abc123" }
```

### Sending a message
```json
{ "type": "message", "conversationId": "chat-abc123", "content": "Hello", "role": "user" }
```

### Streaming response
```json
{ "type": "chunk", "conversationId": "chat-abc123", "content": "Hello! " }
{ "type": "chunk", "conversationId": "chat-abc123", "content": "How can I help?" }
{ "type": "done",  "conversationId": "chat-abc123", "usage": { "inputTokens": 12, "outputTokens": 8 } }
```

### Routing control
```json
// Route to specific actor
{ "type": "message", ..., "routeTo": "claude" }
// Or auto-route
{ "type": "message", ..., "routeTo": "auto" }
```

### Graph event subscription (optional)
```json
{ "type": "subscribe", "events": ["message_sent", "session_started", "session_ended"] }
// App pushes:
{ "type": "graph_event", "event": "message_sent", "from": "claude", "to": "shell" }
```

This protocol is published so any third-party chat UI can integrate in one WebSocket connection.

---

## 11. MVP Milestones

### Phase A — Foundation (Weeks 1–3)
- [ ] Electron + React + electron-vite setup
- [ ] VerbumBridge — IPC connection to local Router
- [ ] 3D graph (Three.js + R3F, force layout, actor nodes + message edges)
- [ ] SessionSidebar — list active sessions
- [ ] Actor + Message Inspector panels
- [ ] MessageStore (SQLite)
- [ ] macOS menu bar icon

### Phase B — Integrations (Weeks 4–6)
- [ ] ClaudeCodeBridge — headless SDK mode
- [ ] ClaudeCodeBridge — session file watcher mode
- [ ] CodexBridge — subprocess mode
- [ ] TerminalManager + xterm.js viewer
- [ ] Chat Bridge WS server
- [ ] Basic Inbox (list + thread)

### Phase C — Polish (Weeks 7–9)
- [ ] Timeline scrubber + replay
- [ ] Fork from message
- [ ] Graph filters + saved views
- [ ] Full Inbox with actor switching + composer
- [ ] Browser extension (Chrome/Brave)
- [ ] Export (JSON / Markdown)
- [ ] Auto-updater + DMG distribution

### Phase D — Remote (aligned with framework Phase 4)
- [ ] RemoteSession support
- [ ] Remote actor nodes with federated visual indicator
- [ ] Nostr identity in Inspector panel

---

## 12. Design Language

**Aesthetic**: Dark, precise, observatory-like. A control room. A deep-space telescope interface. Serious tooling for people who care what's happening inside their systems.

**Palette:**
- Background: `#0a0908`
- Surface: `#131110`
- Border: `#2a2520`
- Text primary: `#e8e0d0`
- Text muted: `#6a6055`
- Accent: `#c84b2f`
- Gold: `#b8972a`
- Code: JetBrains Mono

**Graph atmosphere**: Subtle particle field background. Node glow pulses on activity. Edges have a luminous quality against the dark void. A living constellation of conversations.

**Motion principles**:
- Nodes spring into position on first render
- Edges animate source→target on message send (0.3s)
- Inspector slides in from right (0.2s ease-out)
- Timeline scrub is immediate
- Camera transitions are damped spring (0.4s)
