import type { ConversationSnapshot, Message, MessageContent } from "../types.js";
import type { ModelAdapter, ModelAdapterContext, ModelAdapterResult } from "../actors/model.js";
import { contentToText } from "../message.js";

interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  choices: OpenAIChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIErrorResponse {
  error: { message: string; type: string; code: string | null };
}

function verbumRoleToOpenAI(role: Message["role"]): OpenAIMessage["role"] {
  switch (role) {
    case "user":
      return "user";
    case "assistant":
      return "assistant";
    case "system":
      return "system";
    case "tool":
      return "tool";
    default:
      return "user";
  }
}

function verbumContentToOpenAIString(content: MessageContent): string {
  return contentToText(content);
}

function buildMessages(
  conversation: ConversationSnapshot,
  currentMessage: Message,
  system?: string
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  // Add system prompt first if provided.
  if (system) {
    result.push({ role: "system", content: system });
  }

  const allMessages = conversation.messages;

  for (const msg of allMessages) {
    const role = verbumRoleToOpenAI(msg.role);

    if (msg.content.type === "tool_call") {
      // Represent tool calls as assistant messages with tool_calls array.
      result.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: `call_${msg.id}`,
            type: "function",
            function: {
              name: msg.content.name,
              arguments:
                typeof msg.content.input === "string"
                  ? msg.content.input
                  : JSON.stringify(msg.content.input)
            }
          }
        ]
      });
    } else if (msg.content.type === "tool_result") {
      // Tool results need a tool_call_id reference.
      // Use the parent message id as the tool_call_id reference.
      result.push({
        role: "tool",
        content: msg.content.error
          ? `Error: ${msg.content.error}`
          : typeof msg.content.output === "string"
            ? msg.content.output
            : JSON.stringify(msg.content.output),
        tool_call_id: msg.parentId ? `call_${msg.parentId}` : "unknown"
      });
    } else {
      // Merge consecutive system messages that come from the conversation
      // with the pre-injected system prompt (already handled above).
      if (role === "system" && result.length > 0 && result[0].role === "system") {
        result[0].content = `${result[0].content}\n\n${verbumContentToOpenAIString(msg.content)}`;
      } else {
        result.push({
          role,
          content: verbumContentToOpenAIString(msg.content)
        });
      }
    }
  }

  // If empty conversation, add the triggering message.
  if (allMessages.length === 0) {
    result.push({
      role: verbumRoleToOpenAI(currentMessage.role),
      content: verbumContentToOpenAIString(currentMessage.content)
    });
  }

  return result;
}

function openAIToolCallToVerbumContent(tc: OpenAIToolCall): MessageContent {
  let input: unknown;
  try {
    input = JSON.parse(tc.function.arguments);
  } catch {
    input = tc.function.arguments;
  }
  return { type: "tool_call", name: tc.function.name, input };
}

export function openaiAdapter(config: OpenAIConfig = {}): ModelAdapter {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  const model = config.model ?? "gpt-4o";
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");

  return {
    async generate(context: ModelAdapterContext): Promise<ModelAdapterResult> {
      if (!apiKey) {
        throw new Error(
          "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config."
        );
      }

      const messages = buildMessages(
        context.conversation,
        context.message,
        context.system
      );

      const body: Record<string, unknown> = {
        model,
        messages
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();

        let errorMessage: string;
        try {
          const parsed = JSON.parse(errorBody) as OpenAIErrorResponse;
          errorMessage = parsed.error?.message ?? errorBody;
        } catch {
          errorMessage = errorBody;
        }

        if (response.status === 429) {
          throw new Error(`OpenAI rate limit exceeded: ${errorMessage}`);
        }

        throw new Error(
          `OpenAI API error (${response.status}): ${errorMessage}`
        );
      }

      const data = (await response.json()) as OpenAIResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error("OpenAI returned no choices in the response.");
      }

      const choice = data.choices[0];
      const assistantMessage = choice.message;

      // If the response has tool calls, return them as MessageDrafts.
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const drafts = assistantMessage.tool_calls.map((tc) => ({
          to: context.message.from,
          role: "assistant" as const,
          content: openAIToolCallToVerbumContent(tc),
          metadata: {
            provider: "openai",
            model,
            finishReason: choice.finish_reason,
            toolCallId: tc.id,
            usage: data.usage
          }
        }));

        // If there's also text content, prepend it.
        if (assistantMessage.content) {
          drafts.unshift({
            to: context.message.from,
            role: "assistant" as const,
            content: { type: "text" as const, text: assistantMessage.content },
            metadata: {
              provider: "openai",
              model,
              finishReason: choice.finish_reason,
              toolCallId: undefined as unknown as string,
              usage: data.usage
            }
          });
        }

        return drafts;
      }

      // Simple text response.
      return assistantMessage.content ?? "";
    }
  };
}
