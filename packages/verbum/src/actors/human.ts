import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

export interface HumanTransport {
  deliver(message: Message): Promise<void> | void;
}

export interface HumanActorConfig {
  id: string;
  transport: HumanTransport;
  capabilities?: string[];
}

export class HumanActor extends BaseActor {
  private readonly transport: HumanTransport;

  constructor(config: HumanActorConfig) {
    super({
      id: config.id,
      type: "human",
      capabilities: config.capabilities ?? ["deliver"]
    });
    this.transport = config.transport;
  }

  async receive(message: Message, _actorContext: ActorContext): Promise<MessageDraft[]> {
    await this.transport.deliver(message);
    return [];
  }
}

export class ConsoleTransport implements HumanTransport {
  deliver(message: Message): void {
    const content =
      message.content.type === "text" ? message.content.text : JSON.stringify(message.content, null, 2);
    console.log(`[${message.from} -> ${message.to}] ${content}`);
  }
}

