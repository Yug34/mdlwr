/**
 * Zod validation schemas for API requests
 */

import { z } from "zod";

/**
 * Message part schema
 */
export const messagePartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough(); // Allow additional properties

/**
 * Input message schema
 */
export const inputMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().optional(),
    parts: z.array(messagePartSchema).optional(),
  })
  .refine((data) => data.content || (data.parts && data.parts.length > 0), {
    message: "Message must have either content or parts",
  });

/**
 * Chat API request schema
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(inputMessageSchema)
    .min(1, "At least one message is required"),
  conversationId: z.string().uuid().nullable().optional(),
});

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
