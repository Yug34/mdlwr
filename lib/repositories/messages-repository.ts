/**
 * Repository for message database operations
 */

import { createSupabaseClient } from "@/lib/supabase";
import {
  Message,
  MessageRole,
  MessagePart,
  ConversationMessage,
} from "@/lib/types";
import { DatabaseError } from "@/lib/errors/app-errors";

export class MessagesRepository {
  /**
   * Create a new message
   */
  async create(
    conversationId: string,
    role: MessageRole,
    content: string,
    parts: MessagePart[] | null = null
  ): Promise<Message> {
    const supabase = createSupabaseClient();

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        parts,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(
        `Failed to create message: ${error.message}`,
        error
      );
    }

    if (!message) {
      throw new DatabaseError("Failed to create message: No data returned");
    }

    return message as Message;
  }

  /**
   * Get all messages for a conversation
   */
  async findByConversationId(conversationId: string): Promise<Message[]> {
    const supabase = createSupabaseClient();

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, role, content, parts, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch messages: ${error.message}`,
        error
      );
    }

    return (messages || []) as Message[];
  }

  /**
   * Get messages from specific conversations
   */
  async findByConversationIds(
    conversationIds: string[]
  ): Promise<ConversationMessage[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    const supabase = createSupabaseClient();

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, role, content, parts, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch messages: ${error.message}`,
        error
      );
    }

    // Filter to only user/assistant messages for conversation history
    return (messages || []).filter(
      (msg): msg is ConversationMessage =>
        msg.role === "user" || msg.role === "assistant"
    );
  }

  /**
   * Find conversation ID from message IDs
   * Returns the conversation_id if found, null otherwise
   */
  async findConversationIdByMessageIds(
    messageIds: string[]
  ): Promise<string | null> {
    if (messageIds.length === 0) {
      return null;
    }

    const supabase = createSupabaseClient();

    const { data: messages, error } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("id", messageIds)
      .limit(1);

    if (error) {
      throw new DatabaseError(
        `Failed to find conversation ID: ${error.message}`,
        error
      );
    }

    return messages && messages.length > 0 ? messages[0].conversation_id : null;
  }
}
