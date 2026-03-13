import { replyTo } from "../message.js";
import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

export interface ToolActorConfig<Input = unknown, Output = unknown> {
  id: string;
  description?: string;
  capabilities?: string[];
  execute(input: Input, context: { message: Message; actorContext: ActorContext }): Promise<Output> | Output;
}

export class ToolActor<Input = unknown, Output = unknown> extends BaseActor {
  readonly description?: string;
  readonly execute: ToolActorConfig<Input, Output>["execute"];

  constructor(config: ToolActorConfig<Input, Output>) {
    super({
      id: config.id,
      type: "tool",
      capabilities: config.capabilities ?? [config.id]
    });
    this.description = config.description;
    this.execute = config.execute;
  }

  async receive(message: Message, actorContext: ActorContext): Promise<MessageDraft[]> {
    const input =
      message.content.type === "tool_call"
        ? (message.content.input as Input)
        : ({ text: message.content.type === "text" ? message.content.text : undefined } as Input);

    try {
      const result = await this.execute(input, { message, actorContext });
      return [
        replyTo(message, {
          from: this.id,
          to: message.from,
          role: "tool",
          content: { type: "tool_result", output: result }
        })
      ];
    } catch (error) {
      return [
        replyTo(message, {
          from: this.id,
          to: message.from,
          role: "tool",
          content: {
            type: "tool_result",
            output: null,
            error: error instanceof Error ? error.message : String(error)
          }
        })
      ];
    }
  }
}

