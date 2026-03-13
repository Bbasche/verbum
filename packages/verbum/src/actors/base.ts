import type { Actor, ActorType } from "../types.js";

export abstract class BaseActor implements Actor {
  readonly id: string;
  readonly type: ActorType;
  readonly capabilities: string[];

  protected constructor(config: { id: string; type: ActorType; capabilities?: string[] }) {
    this.id = config.id;
    this.type = config.type;
    this.capabilities = config.capabilities ?? [];
  }

  abstract receive(message: Parameters<Actor["receive"]>[0], context: Parameters<Actor["receive"]>[1]): ReturnType<Actor["receive"]>;
}
