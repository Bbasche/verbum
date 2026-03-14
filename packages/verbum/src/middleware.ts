import type { Message } from "./types.js";

/**
 * Middleware receives a message and a `next` function.
 * It can inspect/modify the message, short-circuit by returning early,
 * or add side effects before/after calling `next()`.
 */
export type Middleware = (
  message: Message,
  next: () => Promise<Message[]>
) => Promise<Message[]>;

/**
 * Runs a chain of middleware around a core handler.
 * Middleware executes in registration order (first registered = outermost).
 */
export class MiddlewareRunner {
  private readonly stack: Middleware[] = [];

  use(middleware: Middleware): this {
    this.stack.push(middleware);
    return this;
  }

  async run(
    message: Message,
    handler: () => Promise<Message[]>
  ): Promise<Message[]> {
    if (this.stack.length === 0) {
      return handler();
    }

    // Build the chain from inside out.
    // The innermost function is the original handler.
    // Each middleware wraps the next one.
    let index = this.stack.length - 1;

    const compose = (i: number): (() => Promise<Message[]>) => {
      if (i < 0) {
        return handler;
      }

      return () => this.stack[i](message, compose(i - 1));
    };

    return compose(index)();
  }
}

// ---------------------------------------------------------------------------
// Pre-built middleware factories
// ---------------------------------------------------------------------------

/**
 * Logs every message dispatch.
 * Uses the provided logger or falls back to `console.log`.
 */
export function loggingMiddleware(
  logger?: (msg: string) => void
): Middleware {
  const log = logger ?? console.log;

  return async (message, next) => {
    const contentPreview =
      message.content.type === "text"
        ? message.content.text.slice(0, 80)
        : message.content.type;

    log(
      `[verbum] ${message.from} -> ${message.to} (${message.content.type}) ${contentPreview}`
    );

    const start = Date.now();
    const results = await next();
    const elapsed = Date.now() - start;

    log(
      `[verbum] ${message.from} -> ${message.to} completed in ${elapsed}ms (${results.length} messages)`
    );

    return results;
  };
}

/**
 * Extracts token usage from message metadata and reports it via the callback.
 *
 * Looks for `metadata.tokens` shaped as `{ input?: number, output?: number }`.
 * Inspects both the incoming message and every message in the result transcript.
 */
export function costTrackingMiddleware(
  onCost: (
    msg: Message,
    tokens: { input?: number; output?: number }
  ) => void
): Middleware {
  const extractTokens = (
    msg: Message
  ): { input?: number; output?: number } | null => {
    const meta = msg.metadata;
    if (!meta) return null;

    const tokens = meta.tokens as
      | { input?: number; output?: number }
      | undefined;
    if (
      tokens &&
      typeof tokens === "object" &&
      (typeof tokens.input === "number" || typeof tokens.output === "number")
    ) {
      return tokens;
    }

    // Also check top-level usage fields
    if (
      typeof meta.inputTokens === "number" ||
      typeof meta.outputTokens === "number"
    ) {
      return {
        input: meta.inputTokens as number | undefined,
        output: meta.outputTokens as number | undefined,
      };
    }

    return null;
  };

  return async (message, next) => {
    // Check the incoming message
    const incomingTokens = extractTokens(message);
    if (incomingTokens) {
      onCost(message, incomingTokens);
    }

    const results = await next();

    // Check each result message
    for (const msg of results) {
      const tokens = extractTokens(msg);
      if (tokens) {
        onCost(msg, tokens);
      }
    }

    return results;
  };
}

/**
 * Rate-limits message dispatches.
 *
 * Throws an error if the rate limit is exceeded.
 * When `perActor` is true, limits are tracked per target actor.
 * Otherwise a single global limit applies.
 */
export function rateLimitMiddleware(config: {
  maxPerMinute: number;
  perActor?: boolean;
}): Middleware {
  const { maxPerMinute, perActor = false } = config;

  // Each bucket stores timestamps of recent dispatches
  const buckets = new Map<string, number[]>();

  const prune = (timestamps: number[], now: number): number[] => {
    const cutoff = now - 60_000;
    // Find the first index that is within the window
    let start = 0;
    while (start < timestamps.length && timestamps[start] <= cutoff) {
      start++;
    }
    return start === 0 ? timestamps : timestamps.slice(start);
  };

  return async (message, next) => {
    const key = perActor ? message.to : "__global__";
    const now = Date.now();

    let timestamps = buckets.get(key) ?? [];
    timestamps = prune(timestamps, now);

    if (timestamps.length >= maxPerMinute) {
      throw new Error(
        `Rate limit exceeded: ${maxPerMinute} messages per minute${
          perActor ? ` for actor "${message.to}"` : ""
        }`
      );
    }

    timestamps.push(now);
    buckets.set(key, timestamps);

    return next();
  };
}
