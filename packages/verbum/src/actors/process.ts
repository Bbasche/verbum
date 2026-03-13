import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { ensureText, replyTo } from "../message.js";
import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

export interface ProcessActorConfig {
  id: string;
  shell?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  capabilities?: string[];
}

export class ProcessActor extends BaseActor {
  private readonly shell: string;
  private readonly cwd: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private process?: ChildProcessWithoutNullStreams;
  private queue: Promise<string> = Promise.resolve("");

  constructor(config: ProcessActorConfig) {
    super({
      id: config.id,
      type: "process",
      capabilities: config.capabilities ?? ["shell", "command", "terminal"]
    });
    this.shell = config.shell ?? process.env.SHELL ?? "/bin/bash";
    this.cwd = config.cwd ?? process.cwd();
    this.env = { ...process.env, ...config.env };
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async receive(message: Message, _actorContext: ActorContext): Promise<MessageDraft[]> {
    const command = ensureText(message.content);
    const output = await this.run(command);
    return [
      replyTo(message, {
        from: this.id,
        to: message.from,
        role: "tool",
        content: { type: "text", text: output }
      })
    ];
  }

  async run(command: string): Promise<string> {
    const next = this.queue.then(() => this.execute(command));
    this.queue = next.catch(() => "");
    return next;
  }

  dispose(): void {
    if (!this.process) {
      return;
    }

    this.process.kill();
    this.process = undefined;
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process && !this.process.killed) {
      return this.process;
    }

    this.process = spawn(this.shell, [], {
      cwd: this.cwd,
      env: this.env,
      stdio: "pipe"
    });

    this.process.on("exit", () => {
      this.process = undefined;
    });

    return this.process;
  }

  private execute(command: string): Promise<string> {
    const child = this.ensureProcess();
    const marker = `__VERBUM_DONE__${randomUUID()}`;

    return new Promise((resolve, reject) => {
      let buffer = "";

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`ProcessActor timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const onData = (chunk: Buffer): void => {
        buffer += chunk.toString("utf8");

        if (!buffer.includes(marker)) {
          return;
        }

        cleanup();
        const [body] = buffer.split(marker);
        resolve(cleanOutput(body, command));
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        child.off("error", onError);
      };

      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.on("error", onError);

      child.stdin.write(`${command}\nprintf "\\n${marker}\\n"\n`);
    });
  }
}

function cleanOutput(output: string, command: string): string {
  return output
    .replace(/\u001B\[[0-9;]*[A-Za-z]/g, "")
    .split("\n")
    .filter((line) => line.trim() !== command.trim())
    .join("\n")
    .trim();
}

