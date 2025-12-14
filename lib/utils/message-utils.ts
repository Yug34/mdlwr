/**
 * Utilities for working with messages
 */

import {
  InputMessage,
  MessagePart,
  isMessageContentString,
  isMessageParts,
} from "@/lib/types";

/**
 * Extract text content from a message object
 * Handles both string content and parts array formats
 */
export function extractMessageContent(
  message: InputMessage | { content?: string; parts?: MessagePart[] }
): string {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "message-utils.ts:16",
      message: "extractMessageContent called",
      data: {
        hasContent: !!message.content,
        contentType: typeof message.content,
        hasParts: !!message.parts,
        partsLength: message.parts?.length,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  // If content is directly a string, return it
  if (message.content && typeof message.content === "string") {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "message-utils.ts:20",
        message: "Extracted from content string",
        data: {
          content: message.content,
          contentLength: message.content.length,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    return message.content;
  }

  // If message has parts array, extract text from parts
  if (message.parts && Array.isArray(message.parts)) {
    const extracted = message.parts
      .map((part: MessagePart) => {
        if (part.type === "text" && part.text) {
          return part.text;
        }
        return "";
      })
      .join("");
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "message-utils.ts:27",
        message: "Extracted from parts",
        data: {
          extracted,
          extractedLength: extracted.length,
          partsCount: message.parts.length,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    return extracted;
  }

  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "message-utils.ts:36",
      message: "extractMessageContent returning empty string",
      data: { hasContent: !!message.content, hasParts: !!message.parts },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
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
