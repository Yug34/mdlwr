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
  userId: string | null;
}

export class MessageService {
  constructor(
    private messagesRepo = new MessagesRepository(),
    private conversationsRepo = new ConversationsRepository()
  ) {}

  /**
   * Store user and assistant messages
   * Also handles setting conversation title if it's the first user message
   * Only stores messages in database for authenticated users (userId is not null)
   */
  async storeMessages(params: StoreMessagesParams): Promise<void> {
    const { conversationId, userMessage, assistantContent, userId } = params;

    // Skip database operations for unauthenticated users (session-only conversations)
    if (userId === null) {
      return;
    }

    // Store user message first (if exists)
    if (userMessage && userMessage.role === "user") {
      const userContent = extractMessageContent(userMessage);
      if (userContent) {
        // Check if we need to set conversation title
        // IMPORTANT: Do this BEFORE storing the message to avoid race conditions
        try {
          await this.setConversationTitleIfNeeded(conversationId, userContent);
        } catch (error) {
          // Log error but continue - we'll try to set title again after storing message
          console.error("Error setting conversation title:", error);
        }

        // Store user message
        await this.messagesRepo.create(
          conversationId,
          "user",
          userContent,
          (userMessage.parts || null) as MessagePart[] | null
        );

        // After storing the message, verify and ensure title is set
        // This is a fallback in case the previous title setting failed
        const currentTitle = await this.conversationsRepo.getTitle(
          conversationId
        );
        if (!currentTitle || currentTitle.trim() === "") {
          // Title is still null/empty, try setting it again
          const title =
            userContent.length > MAX_CONVERSATION_TITLE_LENGTH
              ? userContent.substring(0, MAX_CONVERSATION_TITLE_LENGTH).trim() +
                "..."
              : userContent.trim();
          try {
            await this.conversationsRepo.updateTitle(conversationId, title);
          } catch (error) {
            console.error("Error setting title on retry:", error);
          }
        }
      }
    }

    // Store assistant message
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "message-service.ts:80",
        message: "Checking assistantContent before saving",
        data: {
          assistantContentLength: assistantContent?.length || 0,
          assistantContentIsEmpty: !assistantContent,
          assistantContentType: typeof assistantContent,
          conversationId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    if (assistantContent) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:81",
            message: "About to create assistant message in DB",
            data: {
              conversationId,
              assistantContentLength: assistantContent.length,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "post-fix",
            hypothesisId: "D",
          }),
        }
      ).catch(() => {});
      // #endregion
      await this.messagesRepo.create(
        conversationId,
        "assistant",
        assistantContent,
        [{ type: "text", text: assistantContent }]
      );
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:87",
            message: "Assistant message created in DB successfully",
            data: { conversationId },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "post-fix",
            hypothesisId: "D",
          }),
        }
      ).catch(() => {});
      // #endregion
    } else {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:88",
            message:
              "Skipping assistant message save - assistantContent is empty",
            data: { assistantContent, conversationId },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {});
      // #endregion
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
    // IMPORTANT: We check this BEFORE storing the current message to ensure
    // we catch the first message correctly. However, if the check happens
    // after a previous call already stored a message, we need to handle that.
    const hasUserMessages = await this.conversationsRepo.hasUserMessages(
      conversationId
    );

    // If there are already user messages, don't set the title
    // UNLESS the title is still null (edge case: title setting failed previously)
    if (hasUserMessages && existingTitle !== null) {
      return; // Not the first message and title already exists (even if empty string)
    }

    // If we get here, either:
    // 1. No user messages exist yet (first message) - set title
    // 2. User messages exist but title is still null (retry setting title)

    // Set title to first user message (truncate if needed)
    const title =
      userContent.length > MAX_CONVERSATION_TITLE_LENGTH
        ? userContent.substring(0, MAX_CONVERSATION_TITLE_LENGTH).trim() + "..."
        : userContent.trim();

    await this.conversationsRepo.updateTitle(conversationId, title);
  }
}
