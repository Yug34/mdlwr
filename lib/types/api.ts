/**
 * API request and response types
 */

import { InputMessage } from "./messages";
import { ConversationListItem } from "./conversations";

/**
 * Chat API request payload
 */
export interface ChatRequest {
  messages: InputMessage[];
  conversationId?: string | null;
}

/**
 * Chat API response (streaming)
 * Note: Actual response is a stream, this is for type documentation
 */
export interface ChatResponse {
  // Streamed via SSE
}

/**
 * Create conversation response
 */
export interface CreateConversationResponse {
  conversationId: string;
}

/**
 * Get conversations response
 */
export interface GetConversationsResponse {
  conversations: ConversationListItem[];
}

/**
 * Get messages response
 */
export interface GetMessagesResponse {
  messages: Array<{
    id: string;
    role: string;
    content: string;
    parts: unknown;
  }>;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  details?: string;
}
