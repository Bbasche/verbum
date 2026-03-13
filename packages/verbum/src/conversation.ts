import type { ConversationSnapshot, Message } from "./types.js";

export class Conversation {
  readonly id: string;
  readonly metadata: Record<string, unknown>;
  readonly messages: Message[] = [];
  readonly participants = new Set<string>();

  constructor(id: string, metadata: Record<string, unknown> = {}) {
    this.id = id;
    this.metadata = metadata;
  }

  add(message: Message): void {
    this.messages.push(message);
    this.participants.add(message.from);
    this.participants.add(message.to);
  }

  fork(fromMessageId: string): Conversation {
    const index = this.messages.findIndex((message) => message.id === fromMessageId);
    if (index < 0) {
      throw new Error(`Message ${fromMessageId} not found in conversation ${this.id}`);
    }

    const fork = new Conversation(`${this.id}:fork:${fromMessageId}`, {
      ...this.metadata,
      forkedFrom: fromMessageId
    });

    for (const message of this.messages.slice(0, index + 1)) {
      fork.add(message);
    }

    return fork;
  }

  async *replay(speed = 1): AsyncIterable<Message> {
    if (speed <= 0) {
      throw new Error("Replay speed must be greater than zero");
    }

    for (let index = 0; index < this.messages.length; index += 1) {
      const message = this.messages[index];
      const next = this.messages[index + 1];
      yield message;

      if (!next) {
        continue;
      }

      const delay = Math.max(0, (next.timestamp - message.timestamp) / speed);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  snapshot(): ConversationSnapshot {
    return {
      id: this.id,
      metadata: { ...this.metadata },
      messages: [...this.messages],
      participants: [...this.participants]
    };
  }
}

