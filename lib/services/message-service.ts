/**
 * Service for message storage and related operations
 */

import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { InputMessage, MessagePart } from "@/lib/types";
import { extractMessageContent } from "@/lib/utils/message-utils";
import { withTimeout, TIMEOUT_CONFIG } from "@/lib/utils/timeout";

export interface StoreMessagesParams {
  conversationId: string;
  userMessage: InputMessage | undefined;
  assistantContent: string;
  userId: string | null;
}

export class MessageService {
  constructor(private messagesRepo = new MessagesRepository()) {}

  /**
   * Store user and assistant messages
   * Note: Conversation title is set during conversation creation in ConversationService
   * Only stores messages in database for authenticated users (userId is not null)
   */
  async storeMessages(params: StoreMessagesParams): Promise<void> {
    const { conversationId, userMessage, assistantContent, userId } = params;

    // Skip database operations for unauthenticated users (session-only conversations)
    if (userId === null) {
      return;
    }

    // Store user message (if exists) with timeout
    if (userMessage && userMessage.role === "user") {
      const userContent = extractMessageContent(userMessage);
      if (userContent) {
        await withTimeout(
          this.messagesRepo.create(
            conversationId,
            "user",
            userContent,
            (userMessage.parts || null) as MessagePart[] | null
          ),
          TIMEOUT_CONFIG.DATABASE,
          "Store user message"
        );
      }
    }

    // Store assistant message with timeout
    if (assistantContent) {
      await withTimeout(
        this.messagesRepo.create(
          conversationId,
          "assistant",
          assistantContent,
          [{ type: "text", text: assistantContent }]
        ),
        TIMEOUT_CONFIG.DATABASE,
        "Store assistant message"
      );
    }
  }
}
