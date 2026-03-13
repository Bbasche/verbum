import { replyTo } from "../message.js";
import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

export interface ModelAdapterContext {
  actorId: string;
  provider: string;
  model: string;
  system?: string;
  message: Message;
  conversation: ActorContext["conversation"];
}

export interface ModelAdapter {
  generate(context: ModelAdapterContext): Promise<ModelAdapterResult> | ModelAdapterResult;
}

export type ModelAdapterResult =
  | string
  | MessageDraft
  | MessageDraft[]
  | { text: string; routeTo?: string; metadata?: Record<string, unknown> };

export interface ModelActorConfig {
  id: string;
  provider: string;
  model: string;
  system?: string;
  adapter: ModelAdapter;
  capabilities?: string[];
}

export class ModelActor extends BaseActor {
  readonly provider: string;
  readonly model: string;
  readonly system?: string;
  private readonly adapter: ModelAdapter;

  constructor(config: ModelActorConfig) {
    super({
      id: config.id,
      type: "model",
      capabilities: config.capabilities ?? [config.provider, config.model]
    });
    this.provider = config.provider;
    this.model = config.model;
    this.system = config.system;
    this.adapter = config.adapter;
  }

  async receive(message: Message, actorContext: ActorContext): Promise<MessageDraft[]> {
    const result = await this.adapter.generate({
      actorId: this.id,
      provider: this.provider,
      model: this.model,
      system: this.system,
      message,
      conversation: actorContext.conversation
    });

    if (typeof result === "string") {
      return [
        replyTo(message, {
          from: this.id,
          to: message.from,
          role: "assistant",
          content: { type: "text", text: result }
        })
      ];
    }

    if (Array.isArray(result)) {
      return result.map((draft) => ({
        ...draft,
        from: draft.from ?? this.id,
        conversationId: draft.conversationId ?? message.conversationId,
        parentId: draft.parentId ?? message.id
      }));
    }

    if ("text" in result) {
      return [
        replyTo(message, {
          from: this.id,
          to: result.routeTo ?? message.from,
          role: "assistant",
          metadata: result.metadata,
          content: { type: "text", text: result.text }
        })
      ];
    }

    return [
      {
        ...result,
        from: result.from ?? this.id,
        conversationId: result.conversationId ?? message.conversationId,
        parentId: result.parentId ?? message.id
      }
    ];
  }
}

export function scriptedModel(
  handler: (context: ModelAdapterContext) => Promise<ModelAdapterResult> | ModelAdapterResult
): ModelAdapter {
  return {
    generate: handler
  };
}
