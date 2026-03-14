import type { ConversationSnapshot, Message, MessageContent } from "../types.js";
import type { ModelAdapter, ModelAdapterContext, ModelAdapterResult } from "../actors/model.js";
import { contentToText } from "../message.js";

interface AnthropicConfig {
  apiKey?: string;
  model?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicErrorResponse {
  type: "error";
  error: { type: string; message: string };
}

function verbumToAnthropicRole(role: Message["role"]): "user" | "assistant" {
  switch (role) {
    case "user":
    case "tool":
      return "user";
    case "assistant":
      return "assistant";
    case "system":
      return "user";
    default:
      return "user";
  }
}

function verbumContentToAnthropic(content: MessageContent): AnthropicContentBlock {
  switch (content.type) {
    case "text":
      return { type: "text", text: content.text };
    case "tool_call":
      return {
        type: "tool_use",
        id: `call_${Date.now()}`,
        name: content.name,
        input: content.input
      };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: "unknown",
        content: content.error
          ? `Error: ${content.error}`
          : typeof content.output === "string"
            ? content.output
            : JSON.stringify(content.output)
      };
    case "json":
      return { type: "text", text: JSON.stringify(content.value) };
    default:
      return { type: "text", text: contentToText(content) };
  }
}

function buildMessages(
  conversation: ConversationSnapshot,
  currentMessage: Message
): AnthropicMessage[] {
  const allMessages = conversation.messages;
  const result: AnthropicMessage[] = [];

  for (const msg of allMessages) {
    if (msg.role === "system") continue;

    const role = verbumToAnthropicRole(msg.role);
    const block = verbumContentToAnthropic(msg.content);

    // Anthropic requires alternating user/assistant turns.
    // Merge consecutive same-role messages into a single multi-block message.
    const last = result[result.length - 1];
    if (last && last.role === role) {
      if (typeof last.content === "string") {
        last.content = [{ type: "text", text: last.content }, block];
      } else {
        last.content.push(block);
      }
    } else {
      result.push({ role, content: [block] });
    }
  }

  // Anthropic requires the first message to be from the user.
  // If it starts with assistant, prepend a synthetic user message.
  if (result.length > 0 && result[0].role === "assistant") {
    result.unshift({ role: "user", content: "Continue." });
  }

  // If the conversation is empty, use the current message.
  if (result.length === 0) {
    const role = verbumToAnthropicRole(currentMessage.role);
    const block = verbumContentToAnthropic(currentMessage.content);
    result.push({ role, content: [block] });
  }

  return result;
}

function extractSystemPrompt(conversation: ConversationSnapshot, system?: string): string | undefined {
  const systemMessages = conversation.messages.filter((m) => m.role === "system");
  const parts: string[] = [];

  if (system) parts.push(system);
  for (const msg of systemMessages) {
    parts.push(contentToText(msg.content));
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function anthropicBlockToVerbumContent(block: AnthropicContentBlock): MessageContent {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return { type: "tool_call", name: block.name, input: block.input };
    case "tool_result":
      return { type: "tool_result", output: block.content };
    default:
      return { type: "text", text: JSON.stringify(block) };
  }
}

export function anthropicAdapter(config: AnthropicConfig = {}): ModelAdapter {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = config.model ?? "claude-sonnet-4-20250514";

  return {
    async generate(context: ModelAdapterContext): Promise<ModelAdapterResult> {
      if (!apiKey) {
        throw new Error(
          "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config."
        );
      }

      const systemPrompt = extractSystemPrompt(context.conversation, context.system);
      const messages = buildMessages(context.conversation, context.message);

      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        messages
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();

        let errorMessage: string;
        try {
          const parsed = JSON.parse(errorBody) as AnthropicErrorResponse;
          errorMessage = parsed.error?.message ?? errorBody;
        } catch {
          errorMessage = errorBody;
        }

        if (response.status === 429) {
          throw new Error(`Anthropic rate limit exceeded: ${errorMessage}`);
        }

        throw new Error(
          `Anthropic API error (${response.status}): ${errorMessage}`
        );
      }

      const data = (await response.json()) as AnthropicResponse;

      // If the response has a single text block, return the simple string form.
      if (
        data.content.length === 1 &&
        data.content[0].type === "text"
      ) {
        return data.content[0].text;
      }

      // Multiple content blocks: return an array of MessageDrafts.
      const drafts = data.content.map((block) => ({
        to: context.message.from,
        role: "assistant" as const,
        content: anthropicBlockToVerbumContent(block),
        metadata: {
          provider: "anthropic",
          model,
          stopReason: data.stop_reason,
          usage: data.usage
        }
      }));

      return drafts;
    }
  };
}
