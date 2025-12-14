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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:17",
        message: "ConversationsRepository.create called",
        data: {
          title,
          titleType: typeof title,
          isNull: title === null,
          isUndefined: title === undefined,
          titleLength: title?.length,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    const supabase = createSupabaseClient();

    const insertData = { title, user_id: userId };
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:25",
        message: "Data being inserted to database",
        data: { insertData, titleInInsert: insertData.title },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert(insertData)
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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:154",
        message: "updateTitle called",
        data: {
          conversationId,
          title,
          titleType: typeof title,
          titleLength: title?.length,
          isNull: title === null,
          isUndefined: title === undefined,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion
    const supabase = createSupabaseClient();

    const { error, data } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId)
      .select();

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:162",
        message: "updateTitle database response",
        data: {
          conversationId,
          hasError: !!error,
          errorMessage: error?.message,
          errorCode: error?.code,
          errorDetails: error?.details,
          updatedRows: data?.length,
          updatedTitle: data?.[0]?.title,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion

    if (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "conversations-repository.ts:167",
            message: "updateTitle ERROR - throwing DatabaseError",
            data: {
              conversationId,
              title,
              errorMessage: error.message,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion
      throw new DatabaseError(
        `Failed to update conversation title: ${error.message}`,
        error
      );
    }

    // Verify the update actually worked
    if (!data || data.length === 0) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "conversations-repository.ts:185",
            message: "updateTitle WARNING - no rows updated",
            data: {
              conversationId,
              title,
              dataLength: data?.length,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion
    }
  }

  /**
   * Check if a conversation has any user messages
   */
  async hasUserMessages(conversationId: string): Promise<boolean> {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:271",
        message: "hasUserMessages called",
        data: { conversationId },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      }),
    }).catch(() => {});
    // #endregion
    const supabase = createSupabaseClient();

    const { count, error, data } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("role", "user");

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:280",
        message: "hasUserMessages query result",
        data: {
          conversationId,
          count,
          countValue: count ?? 0,
          hasError: !!error,
          errorMessage: error?.message,
          errorCode: error?.code,
          hasUserMessages: (count ?? 0) > 0,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      }),
    }).catch(() => {});
    // #endregion

    if (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "conversations-repository.ts:300",
            message: "hasUserMessages ERROR",
            data: {
              conversationId,
              errorMessage: error.message,
              errorCode: error.code,
              errorDetails: error.details,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "I",
          }),
        }
      ).catch(() => {});
      // #endregion
      throw new DatabaseError(
        `Failed to check messages: ${error.message}`,
        error
      );
    }

    const result = (count ?? 0) > 0;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations-repository.ts:320",
        message: "hasUserMessages returning",
        data: {
          conversationId,
          result,
          count,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      }),
    }).catch(() => {});
    // #endregion
    return result;
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
