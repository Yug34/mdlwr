/**
 * Conversation-related types
 */

import { Conversation } from "./database";

/**
 * Conversation list item (typically used in UI)
 */
export interface ConversationListItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create conversation request payload
 */
export interface CreateConversationRequest {
  title?: string | null;
}

/**
 * Conversation with related metadata
 */
export interface ConversationWithMetadata extends Conversation {
  messageCount?: number;
  lastMessageAt?: string;
}
