/**
 * Utilities for working with messages
 */

import { InputMessage, MessagePart } from "@/lib/types";

/**
 * Extract text content from a message object
 * Handles both string content and parts array formats
 */
export function extractMessageContent(
  message: InputMessage | { content?: string; parts?: MessagePart[] }
): string {
  // If content is directly a string, return it
  if (message.content && typeof message.content === "string") {
    return message.content;
  }

  // If message has parts array, extract text from parts
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .map((part: MessagePart) => {
        if (part.type === "text" && part.text) {
          return part.text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

/**
 * Get the last user message from an array of messages
 */
export function getLastUserMessage(
  messages: InputMessage[]
): InputMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      return messages[i];
    }
  }
  return undefined;
}

/**
 * Extract text content from the last user message
 */
export function extractLastUserMessageContent(
  messages: InputMessage[]
): string {
  const lastUserMessage = getLastUserMessage(messages);
  if (!lastUserMessage) {
    return "";
  }
  return extractMessageContent(lastUserMessage);
}
