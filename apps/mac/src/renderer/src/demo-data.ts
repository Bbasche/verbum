import type { AppMessage, SourceDescriptor } from "./message-schema";

export const sessions = [
  {
    id: "verbum-app",
    name: "Verbum App",
    kind: "router",
    status: "live",
    summary: "Watching Claude Code, Codex, two terminals, inbox, and search."
  },
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "model",
    status: "editing",
    summary: "Patching router dispatch and narrating changes."
  },
  {
    id: "codex",
    name: "Codex",
    kind: "model",
    status: "verifying",
    summary: "Running repo search, checking tests, and explaining root cause."
  },
  {
    id: "shell-1",
    name: "zsh · repo",
    kind: "terminal",
    status: "busy",
    summary: "npm test, git diff, and release packaging."
  },
  {
    id: "shell-2",
    name: "python · data",
    kind: "terminal",
    status: "idle",
    summary: "Preparing demo fixtures and screenshots."
  },
  {
    id: "inbox",
    name: "Inbox",
    kind: "human",
    status: "1 unread",
    summary: "Founder asks the app to route the next reply through Claude Code."
  },
  {
    id: "custom-source",
    name: "Custom Source",
    kind: "custom",
    status: "ready",
    summary: "Bring your own typed adapter and let Verbum render it like any other source."
  }
] as const;

export const graphNodes = [
  {
    id: "verbum-app",
    label: "Verbum App",
    type: "router",
    x: 52,
    y: 46,
    z: 40,
    detail:
      "The observatory. It watches streams, powers search, and keeps the whole machine legible."
  },
  {
    id: "claude-code",
    label: "Claude Code",
    type: "model",
    x: 23,
    y: 22,
    z: 18,
    detail: "Observed through the SDK or session files with tool calls rendered as child edges."
  },
  {
    id: "codex",
    label: "Codex",
    type: "model",
    x: 79,
    y: 28,
    z: 24,
    detail: "Managed subprocess mode for search, shell work, and final synthesis."
  },
  {
    id: "shell-1",
    label: "zsh · repo",
    type: "terminal",
    x: 18,
    y: 70,
    z: 14,
    detail: "Local shell state persists across commands so repo work reads like a conversation."
  },
  {
    id: "shell-2",
    label: "python · data",
    type: "terminal",
    x: 75,
    y: 73,
    z: 10,
    detail: "Second terminal proves Verbum is orchestrating the machine, not a single pane."
  },
  {
    id: "search",
    label: "Search",
    type: "memory",
    x: 51,
    y: 15,
    z: 16,
    detail: "Fast local conversational retrieval over docs, notes, and live session traces."
  },
  {
    id: "inbox",
    label: "Inbox",
    type: "human",
    x: 47,
    y: 84,
    z: 12,
    detail: "Every human interrupt lands here with actor routing preserved."
  },
  {
    id: "custom-source",
    label: "Custom Source",
    type: "custom",
    x: 86,
    y: 54,
    z: 10,
    detail: "Your own typed message adapter can appear in the same graph and thread."
  }
] as const;

export const graphEdges = [
  { from: "claude-code", to: "verbum-app", label: "patch stream" },
  { from: "codex", to: "verbum-app", label: "json events" },
  { from: "verbum-app", to: "shell-1", label: "dispatch" },
  { from: "verbum-app", to: "shell-2", label: "dispatch" },
  { from: "search", to: "verbum-app", label: "citation hit" },
  { from: "inbox", to: "verbum-app", label: "human override" },
  { from: "verbum-app", to: "inbox", label: "reply" },
  { from: "custom-source", to: "verbum-app", label: "typed adapter" }
] as const;

export const busEvents = [
  "Claude Code requested shell context",
  "Codex confirmed the failing test path",
  "Search surfaced yesterday's launch note",
  "Inbox routed the reply back to Claude Code",
  "zsh built the package",
  "python refreshed the graph fixture"
] as const;

export const terminalSnapshots = [
  {
    title: "zsh · repo",
    lines: [
      "$ npm test",
      " PASS  packages/verbum/test/router.test.ts",
      "$ npm run build",
      " done in 1.6s"
    ]
  },
  {
    title: "python · data",
    lines: [
      "$ python scripts/refresh_fixture.py",
      " wrote 18 sample messages",
      "$ open screenshots/launch-graph.png",
      " preview updated"
    ]
  }
] as const;

export const inboxThread = [
  {
    author: "Founder",
    route: "@claude-code",
    text: "Refactor the bug, but have Codex explain the failure before you merge anything."
  },
  {
    author: "Verbum App",
    route: "system",
    text: "Codex is verifying the issue in a second terminal. Claude Code is holding the patch until search and tests agree."
  },
  {
    author: "Founder",
    route: "#memory",
    text: "Save this whole pattern as the demo story."
  }
] as const;

export const searchDocuments = [
  {
    id: "orchestration",
    title: "Orchestration Layer",
    kind: "Architecture",
    tags: ["claude code", "codex", "terminals", "orchestration"],
    excerpt:
      "Verbum App sits above Claude Code, Codex, and PTY terminals. It does not replace them. It makes them visible in one command center."
  },
  {
    id: "graph",
    title: "3D Conversation Graph",
    kind: "Surface",
    tags: ["graph", "nodes", "edges", "replay"],
    excerpt:
      "Every session becomes a node. Every message becomes an edge. Activity pulses through the graph so debugging feels immediate."
  },
  {
    id: "search",
    title: "Conversational Search",
    kind: "Feature",
    tags: ["search", "citations", "local", "fast"],
    excerpt:
      "Search is local-first and instant. It answers from docs, message traces, and launch assets so the app becomes the front door to project memory."
  },
  {
    id: "launch",
    title: "Launch Story",
    kind: "Narrative",
    tags: ["tweet", "hn", "demo", "mac app"],
    excerpt:
      "Lead with the god-view: Claude Code and Codex solving a real task while the app shows the whole machine talking to itself."
  },
  {
    id: "roadmap",
    title: "Now vs Next",
    kind: "Roadmap",
    tags: ["p2p", "collaboration", "roadmap"],
    excerpt:
      "This launch focuses on single-machine orchestration. Collaboration and P2P stay clearly marked as the next layer."
  }
] as const;

export const sourceDescriptors: SourceDescriptor[] = [
  {
    id: "verbum-app",
    name: "Verbum App",
    kind: "custom",
    subtitle: "Unified desktop control room",
    mode: "replacement",
    connected: true,
    typing: "graph, inbox, search, typed source registry"
  },
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "claude-code",
    subtitle: "SDK or session bridge",
    mode: "companion",
    connected: true,
    typing: "assistant text, tool calls, patches, shell activity"
  },
  {
    id: "codex",
    name: "Codex",
    kind: "codex",
    subtitle: "Managed subprocess or future direct bridge",
    mode: "companion",
    connected: true,
    typing: "structured output, search traces, final synthesis"
  },
  {
    id: "shell-1",
    name: "zsh · repo",
    kind: "terminal",
    subtitle: "PTY sessions",
    mode: "replacement",
    connected: true,
    typing: "commands, output, status updates"
  },
  {
    id: "shell-2",
    name: "python · data",
    kind: "terminal",
    subtitle: "Additional process views",
    mode: "replacement",
    connected: true,
    typing: "commands, output, status updates"
  },
  {
    id: "inbox",
    name: "Inbox",
    kind: "human",
    subtitle: "Human-in-the-loop routing",
    mode: "replacement",
    connected: true,
    typing: "human messages, routing decisions, system summaries"
  },
  {
    id: "custom-source",
    name: "Bring your own source",
    kind: "custom",
    subtitle: "Typed adapter contract",
    mode: "custom",
    connected: true,
    typing: "define your own blocks and metadata"
  }
] as const;

export const onboardingSteps = [
  "Open Verbum and connect Claude Code with one connector.",
  "Add Codex as a companion source or run it from inside the app.",
  "Watch terminals, code blocks, and tool calls render in one thread.",
  "Add your own source with the typed message contract when you outgrow the defaults."
] as const;

export const messageFeed: AppMessage[] = [
  {
    id: "msg-1",
    sourceId: "inbox",
    sourceLabel: "Inbox",
    sourceKind: "human",
    role: "user",
    title: "Founder request",
    timestamp: "Now",
    blocks: [
      {
        type: "markdown",
        text: "Fix the failing router test, but ask Codex for the root cause before Claude applies any patch."
      }
    ]
  },
  {
    id: "msg-2",
    sourceId: "codex",
    sourceLabel: "Codex",
    sourceKind: "codex",
    role: "assistant",
    title: "Root cause",
    timestamp: "Now",
    blocks: [
      {
        type: "markdown",
        text: "The recursion path records a broadcast clone twice, so the conversation graph inflates edge counts when depth increases."
      },
      {
        type: "code",
        language: "ts",
        filename: "packages/verbum/src/router.ts",
        code: "if (message.to === \"*\") {\n  // clone once per recipient, but avoid re-recording the original broadcast edge\n}"
      }
    ]
  },
  {
    id: "msg-3",
    sourceId: "claude-code",
    sourceLabel: "Claude Code",
    sourceKind: "claude-code",
    role: "assistant",
    title: "Patch plan",
    timestamp: "Now",
    blocks: [
      {
        type: "status-list",
        items: [
          { label: "Step 1", value: "Adjust router recursion" },
          { label: "Step 2", value: "Run the workspace tests" },
          { label: "Step 3", value: "Report the exact behavioral change" }
        ]
      },
      {
        type: "tool",
        name: "apply_patch",
        status: "done",
        input: "Update router broadcast handling and keep parent linkage intact.",
        output: "router.ts updated successfully"
      }
    ]
  },
  {
    id: "msg-4",
    sourceId: "shell-1",
    sourceLabel: "zsh · repo",
    sourceKind: "terminal",
    role: "tool",
    title: "Build + test",
    timestamp: "Now",
    blocks: [
      {
        type: "command",
        command: "npm test && npm run build",
        output: "PASS packages/verbum/test/router.test.ts\nDone in 1.8s"
      }
    ]
  },
  {
    id: "msg-5",
    sourceId: "custom-source",
    sourceLabel: "Custom Source",
    sourceKind: "custom",
    role: "system",
    title: "Typed adapter contract",
    timestamp: "Now",
    blocks: [
      {
        type: "code",
        language: "ts",
        filename: "my-source.ts",
        code: "type CustomMessage = {\n  id: string;\n  sourceKind: \"custom\";\n  blocks: Array<{ type: \"markdown\" | \"code\" | \"command\" }>;\n};"
      },
      {
        type: "markdown",
        text: "Any source that emits the typed block contract can appear in the same thread, graph, and inbox without a one-off UI."
      }
    ]
  }
] as const;
