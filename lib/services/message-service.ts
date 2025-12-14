/**
 * Service for message storage and related operations
 */

import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { InputMessage, MessagePart } from "@/lib/types";
import { extractMessageContent } from "@/lib/utils/message-utils";
import { MAX_CONVERSATION_TITLE_LENGTH } from "@/lib/constants/conversation-config";

export interface StoreMessagesParams {
  conversationId: string;
  userMessage: InputMessage | undefined;
  assistantContent: string;
}

export class MessageService {
  constructor(
    private messagesRepo = new MessagesRepository(),
    private conversationsRepo = new ConversationsRepository()
  ) {}

  /**
   * Store user and assistant messages
   * Also handles setting conversation title if it's the first user message
   */
  async storeMessages(params: StoreMessagesParams): Promise<void> {
    const { conversationId, userMessage, assistantContent } = params;

    // Store user message first (if exists)
    if (userMessage && userMessage.role === "user") {
      const userContent = extractMessageContent(userMessage);
      if (userContent) {
        // Check if we need to set conversation title
        await this.setConversationTitleIfNeeded(conversationId, userContent);

        // Store user message
        await this.messagesRepo.create(
          conversationId,
          "user",
          userContent,
          (userMessage.parts || null) as MessagePart[] | null
        );
      }
    }

    // Store assistant message
    if (assistantContent) {
      await this.messagesRepo.create(
        conversationId,
        "assistant",
        assistantContent,
        [{ type: "text", text: assistantContent }]
      );
    }
  }

  /**
   * Set conversation title if it's the first user message
   */
  private async setConversationTitleIfNeeded(
    conversationId: string,
    userContent: string
  ): Promise<void> {
    // Check if conversation already has a title
    const existingTitle = await this.conversationsRepo.getTitle(conversationId);
    if (existingTitle && existingTitle.trim() !== "") {
      return; // Already has a title
    }

    // Check if this is the first user message
    const hasUserMessages = await this.conversationsRepo.hasUserMessages(
      conversationId
    );
    if (hasUserMessages) {
      return; // Not the first message
    }

    // Set title to first user message (truncate if needed)
    const title =
      userContent.length > MAX_CONVERSATION_TITLE_LENGTH
        ? userContent.substring(0, MAX_CONVERSATION_TITLE_LENGTH).trim() + "..."
        : userContent.trim();

    await this.conversationsRepo.updateTitle(conversationId, title);
  }
}
