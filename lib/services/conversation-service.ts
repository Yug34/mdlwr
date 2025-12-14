/**
 * Service for conversation resolution and management
 */

import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { InputMessage } from "@/lib/types";
import {
  NotFoundError,
  AuthorizationError,
  DatabaseError,
} from "@/lib/errors/app-errors";

export interface ResolveConversationParams {
  userId: string;
  conversationId?: string | null;
  messages?: InputMessage[];
}

export class ConversationService {
  constructor(
    private conversationsRepo = new ConversationsRepository(),
    private messagesRepo = new MessagesRepository()
  ) {}

  /**
   * Resolve or create a conversation ID
   * Handles all edge cases for conversation resolution
   */
  async resolveOrCreateConversation(
    params: ResolveConversationParams
  ): Promise<string> {
    const { userId, conversationId, messages } = params;

    // If conversationId is provided, verify it and return it (or create new if invalid)
    if (conversationId && conversationId.trim() !== "") {
      return this.verifyOrCreateConversation(userId, conversationId);
    }

    // No conversationId provided - try to find one from existing messages
    const foundConversationId = await this.findConversationIdFromMessages(
      messages || []
    );

    if (foundConversationId) {
      // Verify the found conversation belongs to the user
      try {
        const conversation =
          await this.conversationsRepo.findByIdAndVerifyOwner(
            foundConversationId,
            userId
          );
        return conversation.id;
      } catch (error) {
        // Conversation doesn't exist or doesn't belong to user, create new one
        if (
          error instanceof NotFoundError ||
          error instanceof AuthorizationError
        ) {
          return this.createConversation(userId);
        }
        throw error;
      }
    }

    // No existing conversation found, create a new one
    return this.createConversation(userId);
  }

  /**
   * Verify conversation exists and belongs to user, or create new one if invalid
   */
  private async verifyOrCreateConversation(
    userId: string,
    conversationId: string
  ): Promise<string> {
    try {
      const conversation = await this.conversationsRepo.findByIdAndVerifyOwner(
        conversationId,
        userId
      );
      return conversation.id;
    } catch (error) {
      // If conversation doesn't exist or access denied, create a new one
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        return this.createConversation(userId);
      }
      throw error;
    }
  }

  /**
   * Try to find conversation ID from message IDs in the request
   */
  private async findConversationIdFromMessages(
    messages: InputMessage[]
  ): Promise<string | null> {
    if (!messages || messages.length === 0) {
      return null;
    }

    // Find messages that have IDs (indicating they're already in the database)
    const messageIds = messages
      .map((msg) => msg.id)
      .filter((id): id is string => Boolean(id && typeof id === "string"));

    if (messageIds.length === 0) {
      return null;
    }

    try {
      return await this.messagesRepo.findConversationIdByMessageIds(messageIds);
    } catch (error) {
      // Log but don't fail - we'll just create a new conversation
      console.error("Error finding conversation from messages:", error);
      return null;
    }
  }

  /**
   * Create a new conversation
   */
  private async createConversation(userId: string): Promise<string> {
    try {
      const conversation = await this.conversationsRepo.create(userId, null);
      return conversation.id;
    } catch (error) {
      throw new DatabaseError("Failed to create conversation", error);
    }
  }
}
