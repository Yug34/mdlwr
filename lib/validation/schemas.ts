/**
 * Zod validation schemas for API requests
 */

import { z } from "zod";
import {
  MAX_MESSAGE_LENGTH,
  MAX_TOTAL_MESSAGES_LENGTH,
} from "@/lib/constants/ai-config";

/**
 * Maximum number of messages allowed in a single request
 */
const MAX_MESSAGES_COUNT = 100;

/**
 * Message part schema with length validation
 */
export const messagePartSchema = z
  .object({
    type: z.string(),
    text: z
      .string()
      .max(
        MAX_MESSAGE_LENGTH,
        `Text exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      )
      .optional(),
  })
  .passthrough(); // Allow additional properties

/**
 * Input message schema with length validation
 */
export const inputMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z
      .string()
      .max(
        MAX_MESSAGE_LENGTH,
        `Content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      )
      .optional(),
    parts: z.array(messagePartSchema).optional(),
  })
  .refine((data) => data.content || (data.parts && data.parts.length > 0), {
    message: "Message must have either content or parts",
  });

/**
 * Chat API request schema with message count and total length validation
 */
export const chatRequestSchema = z
  .object({
    messages: z
      .array(inputMessageSchema)
      .min(1, "At least one message is required")
      .max(MAX_MESSAGES_COUNT, `Too many messages (max ${MAX_MESSAGES_COUNT})`),
    conversationId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => {
      // Calculate total length of all message content
      const totalLength = data.messages.reduce((acc, msg) => {
        let msgLength = 0;
        if (msg.content) {
          msgLength += msg.content.length;
        }
        if (msg.parts) {
          msgLength += msg.parts.reduce((partAcc, part) => {
            return partAcc + (part.text?.length ?? 0);
          }, 0);
        }
        return acc + msgLength;
      }, 0);
      return totalLength <= MAX_TOTAL_MESSAGES_LENGTH;
    },
    {
      message: `Total message content exceeds maximum length of ${MAX_TOTAL_MESSAGES_LENGTH} characters`,
    }
  );

/**
 * Create conversation request schema
 */
export const createConversationRequestSchema = z.object({
  title: z.string().nullable().optional(),
});

/**
 * Validate chat request
 */
export function validateChatRequest(
  data: unknown
): z.infer<typeof chatRequestSchema> {
  return chatRequestSchema.parse(data);
}

/**
 * Validate create conversation request
 */
export function validateCreateConversationRequest(
  data: unknown
): z.infer<typeof createConversationRequestSchema> {
  return createConversationRequestSchema.parse(data);
}
