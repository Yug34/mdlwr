import { randomUUID } from "crypto";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { InputMessage } from "@/lib/types";
import {
  NotFoundError,
  AuthorizationError,
  DatabaseError,
} from "@/lib/errors/app-errors";
import { MAX_CONVERSATION_TITLE_LENGTH } from "@/lib/constants/conversation-config";
import { withTimeout, TIMEOUT_CONFIG } from "@/lib/utils/timeout";

export interface ResolveConversationParams {
  userId: string | null;
  conversationId?: string | null;
  messages?: InputMessage[];
  firstMessageContent?: string;
}

export class ConversationService {
  constructor(
    private conversationsRepo = new ConversationsRepository(),
    private messagesRepo = new MessagesRepository()
  ) {}

  /**
   * Resolve or create a conversation ID
   * Handles all edge cases for conversation resolution
   * For unauthenticated users (userId is null), returns session-only conversation IDs
   * When creating a new conversation, sets the title from firstMessageContent if provided
   */
  async resolveOrCreateConversation(
    params: ResolveConversationParams
  ): Promise<string> {
    const { userId, conversationId, messages, firstMessageContent } = params;

    // For unauthenticated users, use session-only conversation IDs
    if (userId === null) {
      if (conversationId && conversationId.trim() !== "") {
        // Return the provided conversationId (session-only, not persisted)
        return conversationId;
      }
      // Generate a new UUID for session-only conversations
      return randomUUID();
    }

    // Authenticated user flow
    // If conversationId is provided, verify it and return it (or create new if invalid)
    if (conversationId && conversationId.trim() !== "") {
      return this.verifyOrCreateConversation(
        userId,
        conversationId,
        firstMessageContent
      );
    }

    // No conversationId provided - try to find one from existing messages
    const foundConversationId = await this.findConversationIdFromMessages(
      messages || []
    );

    if (foundConversationId) {
      // Verify the found conversation belongs to the user
      try {
        const conversation = await withTimeout(
          this.conversationsRepo.findByIdAndVerifyOwner(
            foundConversationId,
            userId
          ),
          TIMEOUT_CONFIG.DATABASE,
          "Verify found conversation ownership"
        );
        return conversation.id;
      } catch (error) {
        // Conversation doesn't exist or doesn't belong to user, create new one
        if (
          error instanceof NotFoundError ||
          error instanceof AuthorizationError
        ) {
          return this.createConversation(userId, firstMessageContent);
        }
        throw error;
      }
    }

    // No existing conversation found, create a new one with title from first message
    return this.createConversation(userId, firstMessageContent);
  }

  /**
   * Verify conversation exists and belongs to user, or create new one if invalid
   */
  private async verifyOrCreateConversation(
    userId: string,
    conversationId: string,
    firstMessageContent?: string
  ): Promise<string> {
    try {
      const conversation = await withTimeout(
        this.conversationsRepo.findByIdAndVerifyOwner(conversationId, userId),
        TIMEOUT_CONFIG.DATABASE,
        "Verify conversation ownership"
      );
      return conversation.id;
    } catch (error) {
      // If conversation doesn't exist or access denied, create a new one
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        return this.createConversation(userId, firstMessageContent);
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
      return await withTimeout(
        this.messagesRepo.findConversationIdByMessageIds(messageIds),
        TIMEOUT_CONFIG.DATABASE,
        "Find conversation from messages"
      );
    } catch (error) {
      // Log but don't fail - we'll just create a new conversation
      console.error("Error finding conversation from messages:", error);
      return null;
    }
  }

  /**
   * Generate a title from message content
   */
  private generateTitleFromContent(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length <= MAX_CONVERSATION_TITLE_LENGTH) {
      return trimmed;
    }
    return trimmed.substring(0, MAX_CONVERSATION_TITLE_LENGTH).trim() + "...";
  }

  /**
   * Create a new conversation
   * Only called for authenticated users (userId is never null here)
   * Sets the title from firstMessageContent if provided
   */
  private async createConversation(
    userId: string,
    firstMessageContent?: string
  ): Promise<string> {
    try {
      const title = firstMessageContent
        ? this.generateTitleFromContent(firstMessageContent)
        : null;
      const conversation = await withTimeout(
        this.conversationsRepo.create(userId, title),
        TIMEOUT_CONFIG.DATABASE,
        "Create conversation"
      );
      return conversation.id;
    } catch (error) {
      throw new DatabaseError("Failed to create conversation", error);
    }
  }
}
