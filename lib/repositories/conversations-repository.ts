/**
 * Repository for conversation database operations
 */

import { createSupabaseClient } from "@/lib/supabase";
import { Conversation, ConversationListItem } from "@/lib/types";
import {
  DatabaseError,
  NotFoundError,
  AuthorizationError,
} from "@/lib/errors/app-errors";

export class ConversationsRepository {
  /**
   * Create a new conversation
   */
  async create(
    userId: string,
    title: string | null = null
  ): Promise<Conversation> {
    const supabase = createSupabaseClient();

    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        title,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(
        `Failed to create conversation: ${error.message}`,
        error
      );
    }

    if (!conversation) {
      throw new DatabaseError(
        "Failed to create conversation: No data returned"
      );
    }

    return conversation as Conversation;
  }

  /**
   * Get a conversation by ID
   */
  async findById(conversationId: string): Promise<Conversation | null> {
    const supabase = createSupabaseClient();

    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(
        `Failed to fetch conversation: ${error.message}`,
        error
      );
    }

    return conversation as Conversation;
  }

  /**
   * Get a conversation by ID and verify ownership
   * @throws {NotFoundError} if conversation doesn't exist
   * @throws {AuthorizationError} if conversation doesn't belong to user
   */
  async findByIdAndVerifyOwner(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    const conversation = await this.findById(conversationId);

    if (!conversation) {
      throw new NotFoundError("Conversation");
    }

    if (conversation.user_id !== userId) {
      throw new AuthorizationError("Access denied to conversation");
    }

    return conversation;
  }

  /**
   * Get all conversations for a user
   */
  async findByUserId(userId: string): Promise<ConversationListItem[]> {
    const supabase = createSupabaseClient();

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch conversations: ${error.message}`,
        error
      );
    }

    return (conversations || []) as ConversationListItem[];
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    const supabase = createSupabaseClient();

    const { error } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);

    if (error) {
      throw new DatabaseError(
        `Failed to update conversation title: ${error.message}`,
        error
      );
    }
  }

  /**
   * Check if a conversation has any user messages
   */
  async hasUserMessages(conversationId: string): Promise<boolean> {
    const supabase = createSupabaseClient();

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("role", "user");

    if (error) {
      throw new DatabaseError(
        `Failed to check messages: ${error.message}`,
        error
      );
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get conversation title
   */
  async getTitle(conversationId: string): Promise<string | null> {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", conversationId)
      .single();

    if (error) {
      throw new DatabaseError(
        `Failed to fetch conversation title: ${error.message}`,
        error
      );
    }

    return data?.title ?? null;
  }
}
