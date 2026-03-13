export type SourceKind = "claude-code" | "codex" | "terminal" | "memory" | "human" | "custom";

export type MessageBlock =
  | { type: "markdown"; text: string }
  | { type: "code"; language: string; code: string; filename?: string }
  | { type: "command"; command: string; output: string }
  | { type: "tool"; name: string; input: string; output: string; status: "running" | "done" }
  | { type: "status-list"; items: Array<{ label: string; value: string }> };

export interface SourceDescriptor {
  id: string;
  name: string;
  kind: SourceKind;
  subtitle: string;
  mode: "companion" | "replacement" | "custom";
  connected: boolean;
  typing: string;
}

export interface AppMessage {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceKind: SourceKind;
  role: "user" | "assistant" | "system" | "tool";
  title: string;
  timestamp: string;
  blocks: MessageBlock[];
}

