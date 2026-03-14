import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

import { replyTo } from "../message.js";
import type { ActorContext, Message, MessageDraft } from "../types.js";
import { BaseActor } from "./base.js";

// ---------------------------------------------------------------------------
// MCP JSON-RPC types (minimal subset)
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MCPActor config
// ---------------------------------------------------------------------------

export interface MCPActorConfig {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  capabilities?: string[];
  /** Timeout in ms for individual JSON-RPC calls. Defaults to 30 000. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// MCPActor
// ---------------------------------------------------------------------------

export class MCPActor extends BaseActor {
  private readonly command: string;
  private readonly args: string[];
  private readonly envVars: Record<string, string>;
  private readonly timeoutMs: number;

  private process: ChildProcess | null = null;
  private initialized = false;
  private tools: McpToolDefinition[] = [];

  /** Monotonically increasing JSON-RPC id counter */
  private nextId = 1;

  /** Pending JSON-RPC responses keyed by request id */
  private pending = new Map<
    number | string,
    {
      resolve: (value: JsonRpcResponse) => void;
      reject: (reason: Error) => void;
    }
  >();

  /** Buffer for partial lines from stdout */
  private stdoutBuffer = "";

  constructor(config: MCPActorConfig) {
    super({
      id: config.id,
      type: "tool",
      capabilities: config.capabilities ?? ["mcp"],
    });
    this.command = config.command;
    this.args = config.args ?? [];
    this.envVars = config.env ?? {};
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // -----------------------------------------------------------------------
  // Actor interface
  // -----------------------------------------------------------------------

  async receive(
    message: Message,
    _actorContext: ActorContext
  ): Promise<MessageDraft[]> {
    await this.ensureInitialized();

    // tool_call → call the MCP tool
    if (message.content.type === "tool_call") {
      return this.handleToolCall(message);
    }

    // text → return the list of available tools
    if (message.content.type === "text") {
      return this.handleTextQuery(message);
    }

    // Anything else → echo tools list
    return this.handleTextQuery(message);
  }

  /**
   * Shuts down the MCP server child process.
   */
  dispose(): void {
    this.killProcess();
  }

  /**
   * Returns the tools discovered from the MCP server.
   * Triggers initialization if not yet done.
   */
  async getTools(): Promise<McpToolDefinition[]> {
    await this.ensureInitialized();
    return [...this.tools];
  }

  // -----------------------------------------------------------------------
  // Private – message handlers
  // -----------------------------------------------------------------------

  private async handleToolCall(message: Message): Promise<MessageDraft[]> {
    if (message.content.type !== "tool_call") {
      throw new Error("Expected tool_call content");
    }

    const { name, input } = message.content;

    try {
      const response = await this.rpcCall("tools/call", {
        name,
        arguments: input ?? {},
      });

      if (response.error) {
        return [
          replyTo(message, {
            from: this.id,
            to: message.from,
            role: "tool",
            content: {
              type: "tool_result",
              output: null,
              error: response.error.message,
            },
          }),
        ];
      }

      return [
        replyTo(message, {
          from: this.id,
          to: message.from,
          role: "tool",
          content: {
            type: "tool_result",
            output: response.result,
          },
        }),
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
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      ];
    }
  }

  private async handleTextQuery(message: Message): Promise<MessageDraft[]> {
    return [
      replyTo(message, {
        from: this.id,
        to: message.from,
        role: "tool",
        content: {
          type: "json",
          value: {
            tools: this.tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        },
      }),
    ];
  }

  // -----------------------------------------------------------------------
  // Private – MCP lifecycle
  // -----------------------------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.process && !this.process.killed) {
      return;
    }

    // If there was a previous process that crashed, clean up
    if (this.process) {
      this.killProcess();
    }

    this.spawnProcess();
    await this.initialize();
    await this.discoverTools();
    this.initialized = true;
  }

  private spawnProcess(): void {
    const env = { ...process.env, ...this.envVars };

    this.process = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    this.stdoutBuffer = "";

    this.process.stdout!.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf8");
      this.processBuffer();
    });

    this.process.stderr!.on("data", (_chunk: Buffer) => {
      // MCP servers may emit logs on stderr — silently discard
    });

    this.process.on("exit", () => {
      // Reject all pending requests
      for (const [id, { reject }] of this.pending) {
        reject(new Error("MCP server process exited unexpectedly"));
        this.pending.delete(id);
      }
      this.initialized = false;
    });

    this.process.on("error", (err) => {
      for (const [id, { reject }] of this.pending) {
        reject(err);
        this.pending.delete(id);
      }
      this.initialized = false;
    });
  }

  private killProcess(): void {
    if (!this.process) return;

    try {
      this.process.kill();
    } catch {
      // Already dead — ignore
    }

    // Reject pending
    for (const [id, { reject }] of this.pending) {
      reject(new Error("MCP server process was disposed"));
      this.pending.delete(id);
    }

    this.process = null;
    this.initialized = false;
    this.stdoutBuffer = "";
  }

  /**
   * MCP initialize handshake.
   */
  private async initialize(): Promise<void> {
    const response = await this.rpcCall("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "verbum-mcp-actor",
        version: "0.1.0",
      },
    });

    if (response.error) {
      throw new Error(
        `MCP initialize failed: ${response.error.message}`
      );
    }

    // Send initialized notification (no id — it's a notification)
    this.sendNotification("notifications/initialized", {});
  }

  /**
   * Discover tools via tools/list.
   */
  private async discoverTools(): Promise<void> {
    const response = await this.rpcCall("tools/list", {});

    if (response.error) {
      throw new Error(
        `MCP tools/list failed: ${response.error.message}`
      );
    }

    const result = response.result as { tools?: McpToolDefinition[] } | undefined;
    this.tools = result?.tools ?? [];
  }

  // -----------------------------------------------------------------------
  // Private – JSON-RPC transport (stdio)
  // -----------------------------------------------------------------------

  private rpcCall(
    method: string,
    params: Record<string, unknown>
  ): Promise<JsonRpcResponse> {
    if (!this.process || this.process.killed) {
      return Promise.reject(
        new Error("MCP server process is not running")
      );
    }

    const id = this.nextId++;

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `MCP RPC call "${method}" timed out after ${this.timeoutMs}ms`
          )
        );
      }, this.timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timeout);
          reject(reason);
        },
      });

      const line = JSON.stringify(request) + "\n";
      this.process!.stdin!.write(line);
    });
  }

  private sendNotification(
    method: string,
    params: Record<string, unknown>
  ): void {
    if (!this.process || this.process.killed) return;

    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };

    const line = JSON.stringify(notification) + "\n";
    this.process.stdin!.write(line);
  }

  /**
   * Process the stdout buffer, extracting complete JSON-RPC messages.
   *
   * MCP stdio transport uses newline-delimited JSON.
   */
  private processBuffer(): void {
    const lines = this.stdoutBuffer.split("\n");

    // The last element may be a partial line — keep it in the buffer
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: JsonRpcResponse;
      try {
        parsed = JSON.parse(trimmed) as JsonRpcResponse;
      } catch {
        // Not valid JSON — skip (could be server log output)
        continue;
      }

      // Only process responses (messages with an id and no method)
      if (
        parsed.id != null &&
        !("method" in parsed)
      ) {
        const pending = this.pending.get(parsed.id);
        if (pending) {
          this.pending.delete(parsed.id);
          pending.resolve(parsed);
        }
      }
      // Notifications from server (method present, no id) are silently ignored
    }
  }
}
