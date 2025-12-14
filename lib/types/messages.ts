/**
 * Message-related types for application logic
 */

import { Message, MessageRole, MessagePart } from "./database";

/**
 * Message for use in conversation history and profile generation
 */
export interface ConversationMessage extends Message {
  role: "user" | "assistant";
}

/**
 * Message content that can be in string or parts format
 */
export type MessageContent = string | MessagePart[];

/**
 * Input message format from API clients
 */
export interface InputMessage {
  id?: string;
  role: MessageRole;
  content?: string;
  parts?: MessagePart[];
}

/**
 * Extract text content from various message formats
 */
export function isMessageContentString(content: unknown): content is string {
  return typeof content === "string";
}

export function isMessageParts(parts: unknown): parts is MessagePart[] {
  return Array.isArray(parts);
}
