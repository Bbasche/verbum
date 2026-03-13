import { replyTo } from "../message.js";
import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

export interface MemoryEntry {
  id: string;
  text: string;
  tags: string[];
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryActorConfig {
  id: string;
  capabilities?: string[];
  initialEntries?: MemoryEntry[];
}

export class MemoryActor extends BaseActor {
  private readonly entries: MemoryEntry[];

  constructor(config: MemoryActorConfig) {
    super({
      id: config.id,
      type: "memory",
      capabilities: config.capabilities ?? ["remember", "recall", "search"]
    });
    this.entries = config.initialEntries ? [...config.initialEntries] : [];
  }

  all(): MemoryEntry[] {
    return [...this.entries];
  }

  async receive(message: Message, _actorContext: ActorContext): Promise<MessageDraft[]> {
    if (message.content.type === "tool_call") {
      if (message.content.name === "remember") {
        const payload = message.content.input as {
          text: string;
          tags?: string[];
          metadata?: Record<string, unknown>;
        };
        const entry = this.remember(payload.text, payload.tags ?? [], payload.metadata);
        return [
          replyTo(message, {
            from: this.id,
            to: message.from,
            role: "tool",
            content: { type: "tool_result", output: entry }
          })
        ];
      }

      if (message.content.name === "recall" || message.content.name === "search") {
        const payload = message.content.input as { query: string };
        return [
          replyTo(message, {
            from: this.id,
            to: message.from,
            role: "tool",
            content: { type: "tool_result", output: this.search(payload.query) }
          })
        ];
      }
    }

    if (message.content.type === "text") {
      const text = message.content.text.trim();
      const rememberPrefix = /^remember:\s*/i;

      if (rememberPrefix.test(text)) {
        const entry = this.remember(text.replace(rememberPrefix, ""));
        return [
          replyTo(message, {
            from: this.id,
            to: message.from,
            role: "assistant",
            content: { type: "text", text: `Stored memory ${entry.id}` }
          })
        ];
      }

      const matches = this.search(text);
      return [
        replyTo(message, {
          from: this.id,
          to: message.from,
          role: "assistant",
          content: {
            type: "json",
            value: {
              query: text,
              matches
            }
          }
        })
      ];
    }

    return [];
  }

  private remember(
    text: string,
    tags: string[] = [],
    metadata?: Record<string, unknown>
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem_${this.entries.length + 1}`,
      text,
      tags,
      createdAt: Date.now(),
      metadata
    };
    this.entries.unshift(entry);
    return entry;
  }

  private search(query: string): MemoryEntry[] {
    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean);

    return this.entries
      .map((entry) => {
        const haystack = `${entry.text} ${entry.tags.join(" ")}`.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { entry, score };
      })
      .filter((candidate) => candidate.score > 0 || terms.length === 0)
      .sort((left, right) => right.score - left.score || right.entry.createdAt - left.entry.createdAt)
      .slice(0, 5)
      .map((candidate) => candidate.entry);
  }
}

