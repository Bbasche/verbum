import { randomUUID } from "node:crypto";

import type { Message, MessageContent, MessageDraft } from "./types.js";

export function createMessage(draft: MessageDraft): Message {
  if (!draft.from) {
    throw new Error("Message drafts require a `from` value before they can be created");
  }

  if (!draft.conversationId) {
    throw new Error("Message drafts require a `conversationId` before they can be created");
  }

  return {
    ...draft,
    id: draft.id ?? randomUUID(),
    from: draft.from,
    conversationId: draft.conversationId,
    timestamp: draft.timestamp ?? Date.now(),
    metadata: draft.metadata ?? {}
  };
}

export function createTextMessage(
  from: string,
  to: string,
  text: string,
  conversationId: string,
  role: Message["role"] = "user"
): Message {
  return createMessage({
    from,
    to,
    role,
    conversationId,
    content: { type: "text", text }
  });
}

export function replyTo(
  message: Message,
  draft: Omit<MessageDraft, "conversationId" | "parentId">
): MessageDraft {
  return {
    ...draft,
    conversationId: message.conversationId,
    parentId: message.id
  };
}

export function contentToText(content: MessageContent): string {
  switch (content.type) {
    case "text":
      return content.text;
    case "tool_call":
      return `${content.name}(${JSON.stringify(content.input)})`;
    case "tool_result":
      return content.error
        ? `error: ${content.error}`
        : JSON.stringify(content.output, null, 2);
    case "json":
      return JSON.stringify(content.value, null, 2);
    default:
      return "";
  }
}

export function ensureText(content: MessageContent): string {
  if (content.type !== "text") {
    throw new Error(`Expected text content, received ${content.type}`);
  }

  return content.text;
}
