import { EventEmitter } from "node:events";

import { Conversation } from "./conversation.js";
import { createMessage } from "./message.js";
import type {
  Actor,
  ActorContext,
  ConversationGraph,
  Message,
  MessageDraft,
  RouterLike
} from "./types.js";

export interface RouterEvents {
  message: [message: Message];
  dispatch: [message: Message, depth: number];
  settled: [conversationId: string];
  error: [error: Error, message: Message, actor: Actor];
  deadletter: [message: Message];
}

export interface RouterConfig {
  maxDepth?: number;
  dispatchTimeoutMs?: number;
}

export class Router extends EventEmitter<RouterEvents> implements RouterLike {
  readonly maxDepth: number;
  readonly dispatchTimeoutMs?: number;
  private readonly actors = new Map<string, Actor>();
  private readonly conversations = new Map<string, Conversation>();

  constructor(config: RouterConfig = {}) {
    super();
    this.maxDepth = config.maxDepth ?? 8;
    this.dispatchTimeoutMs = config.dispatchTimeoutMs;
  }

  register(actor: Actor): void {
    this.actors.set(actor.id, actor);
  }

  unregister(actorId: string): boolean {
    return this.actors.delete(actorId);
  }

  has(actorId: string): boolean {
    return this.actors.has(actorId);
  }

  get(actorId: string): Actor | undefined {
    return this.actors.get(actorId);
  }

  listActors(): Actor[] {
    return [...this.actors.values()];
  }

  getConversation(id: string): Conversation {
    const existing = this.conversations.get(id);
    if (existing) {
      return existing;
    }

    const conversation = new Conversation(id);
    this.conversations.set(id, conversation);
    return conversation;
  }

  removeConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  async send(messageLike: MessageDraft): Promise<Message[]> {
    const message = createMessage(messageLike);
    const transcript = await this.routeMessage(message, 0);
    this.emit("settled", message.conversationId);
    return transcript;
  }

  async broadcast(messageLike: Omit<MessageDraft, "to">): Promise<Message[]> {
    const transcript: Message[] = [];

    for (const actor of this.actors.values()) {
      transcript.push(
        ...(await this.send({
          ...messageLike,
          to: actor.id
        }))
      );
    }

    return transcript;
  }

  visualize(): ConversationGraph {
    const nodeCounts = new Map<string, number>();
    const edgeCounts = new Map<string, { from: string; to: string; conversationId: string; count: number; lastTimestamp: number }>();

    for (const conversation of this.conversations.values()) {
      for (const message of conversation.getMessages()) {
        nodeCounts.set(message.from, (nodeCounts.get(message.from) ?? 0) + 1);
        nodeCounts.set(message.to, (nodeCounts.get(message.to) ?? 0) + 1);

        const edgeKey = `${message.from}:${message.to}:${message.conversationId}`;
        const edge = edgeCounts.get(edgeKey) ?? {
          from: message.from,
          to: message.to,
          conversationId: message.conversationId,
          count: 0,
          lastTimestamp: message.timestamp
        };

        edge.count += 1;
        edge.lastTimestamp = Math.max(edge.lastTimestamp, message.timestamp);
        edgeCounts.set(edgeKey, edge);
      }
    }

    return {
      nodes: [...nodeCounts.entries()].map(([id, messageCount]) => ({
        id,
        label: id,
        messageCount,
        type: this.actors.get(id)?.type ?? "external"
      })),
      edges: [...edgeCounts.entries()].map(([id, edge]) => ({
        id,
        ...edge
      }))
    };
  }

  private async routeMessage(message: Message, depth: number): Promise<Message[]> {
    if (depth >= this.maxDepth) {
      throw new Error(`Maximum router depth of ${this.maxDepth} exceeded`);
    }

    this.record(message);
    this.emit("message", message);
    this.emit("dispatch", message, depth);

    if (message.to === "*") {
      const transcript: Message[] = [message];

      for (const actor of this.actors.values()) {
        if (actor.id === message.from) {
          continue;
        }

        transcript.push(
          ...(await this.routeMessage(
            createMessage({
              ...message,
              id: undefined,
              timestamp: undefined,
              to: actor.id,
              metadata: {
                ...message.metadata,
                broadcast: true
              }
            }),
            depth + 1
          ))
        );
      }

      return transcript;
    }

    const actor = this.actors.get(message.to);
    if (!actor) {
      this.emit("deadletter", message);
      return [message];
    }

    const actorContext: ActorContext = {
      actor,
      router: this,
      conversation: this.getConversation(message.conversationId).snapshot(),
      createReply: (draft) => ({
        ...draft,
        conversationId: message.conversationId,
        parentId: message.id
      })
    };

    let responses: MessageDraft[];
    try {
      const receivePromise = actor.receive(message, actorContext);

      if (this.dispatchTimeoutMs != null) {
        responses = await Promise.race([
          receivePromise,
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error(`Actor "${actor.id}" timed out after ${this.dispatchTimeoutMs}ms`)),
              this.dispatchTimeoutMs
            )
          )
        ]);
      } else {
        responses = await receivePromise;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err, message, actor);
      this.record(
        createMessage({
          from: "system",
          to: actor.id,
          role: "system",
          conversationId: message.conversationId,
          parentId: message.id,
          content: { type: "text", text: `Error in actor "${actor.id}": ${err.message}` }
        })
      );
      return [message];
    }

    const transcript: Message[] = [message];

    for (const response of responses) {
      transcript.push(
        ...(await this.routeMessage(
          createMessage({
            ...response,
            from: response.from ?? actor.id,
            conversationId: response.conversationId ?? message.conversationId,
            parentId: response.parentId ?? message.id
          }),
          depth + 1
        ))
      );
    }

    return transcript;
  }

  private record(message: Message): void {
    this.getConversation(message.conversationId).add(message);
  }
}

