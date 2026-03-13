export type ActorType =
  | "model"
  | "process"
  | "mcp"
  | "tool"
  | "human"
  | "memory"
  | "router";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; output: unknown; error?: string }
  | { type: "json"; value: unknown };

export interface Message {
  id: string;
  from: string;
  to: string;
  role: MessageRole;
  content: MessageContent;
  metadata?: Record<string, unknown>;
  timestamp: number;
  conversationId: string;
  parentId?: string;
}

export interface MessageDraft {
  id?: string;
  from?: string;
  to: string;
  role: MessageRole;
  content: MessageContent;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  conversationId?: string;
  parentId?: string;
}

export interface Actor {
  id: string;
  type: ActorType;
  capabilities: string[];
  receive(message: Message, context: ActorContext): Promise<MessageDraft[]>;
}

export interface ActorContext {
  actor: Actor;
  conversation: ConversationSnapshot;
  router: RouterLike;
  createReply(draft: Omit<MessageDraft, "conversationId" | "parentId">): MessageDraft;
}

export interface ConversationSnapshot {
  id: string;
  participants: string[];
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface ConversationGraph {
  nodes: Array<{
    id: string;
    type: ActorType | "external";
    label: string;
    messageCount: number;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    conversationId: string;
    count: number;
    lastTimestamp: number;
  }>;
}

export interface RouterLike {
  readonly maxDepth: number;
  has(actorId: string): boolean;
  listActors(): Actor[];
}
