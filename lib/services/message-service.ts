/**
 * Service for message storage and related operations
 */

import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { InputMessage, MessagePart } from "@/lib/types";
import { extractMessageContent } from "@/lib/utils/message-utils";
import { MAX_CONVERSATION_TITLE_LENGTH } from "@/lib/constants/conversation-config";
import { appendFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

// Helper to write debug logs to file
async function writeDebugLog(data: any) {
  try {
    const logPath = join(process.cwd(), ".cursor", "debug.log");
    const logDir = dirname(logPath);
    await mkdir(logDir, { recursive: true });
    await appendFile(logPath, JSON.stringify(data) + "\n");
  } catch (e) {
    console.error("[DEBUG LOG ERROR]", e);
  }
}

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

    // #region agent log
    const logData1 = {
      location: "message-service.ts:29",
      message: "storeMessages called",
      data: {
        conversationId,
        userId,
        hasUserMessage: !!userMessage,
        userMessageRole: userMessage?.role,
        hasAssistantContent: !!assistantContent,
        assistantContentLength: assistantContent?.length,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "I",
    };
    console.log("[DEBUG]", JSON.stringify(logData1));
    await writeDebugLog(logData1);
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData1),
    }).catch(() => {});
    // #endregion

    // Skip database operations for unauthenticated users (session-only conversations)
    if (userId === null) {
      // #region agent log
      const logData2 = {
        location: "message-service.ts:35",
        message: "Skipping storeMessages - userId is null (unauthenticated)",
        data: { conversationId },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      };
      console.log("[DEBUG]", JSON.stringify(logData2));
      await writeDebugLog(logData2);
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logData2),
        }
      ).catch(() => {});
      // #endregion
      return;
    }

    // Store user message first (if exists)
    if (userMessage && userMessage.role === "user") {
      const userContent = extractMessageContent(userMessage);
      // #region agent log
      const logDataBeforeTitle = {
        location: "message-service.ts:98",
        message: "About to set title and store user message",
        data: {
          conversationId,
          userContent,
          userContentLength: userContent?.length,
          hasContent: !!userContent,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      };
      console.log("[DEBUG]", JSON.stringify(logDataBeforeTitle));
      await writeDebugLog(logDataBeforeTitle);
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logDataBeforeTitle),
        }
      ).catch(() => {});
      // #endregion
      if (userContent) {
        // Check if we need to set conversation title
        // IMPORTANT: Do this BEFORE storing the message to avoid race conditions
        try {
          await this.setConversationTitleIfNeeded(conversationId, userContent);
        } catch (error) {
          // Log error but continue - we'll try to set title again after storing message
          const logError = {
            location: "message-service.ts:130",
            message: "ERROR in setConversationTitleIfNeeded",
            data: {
              conversationId,
              error: error instanceof Error ? error.message : String(error),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "J",
          };
          console.error("[DEBUG ERROR]", JSON.stringify(logError));
          await writeDebugLog(logError);
        }

        // #region agent log
        const logDataBeforeStore = {
          location: "message-service.ts:147",
          message: "About to store user message",
          data: {
            conversationId,
            userContent,
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "I",
        };
        console.log("[DEBUG]", JSON.stringify(logDataBeforeStore));
        await writeDebugLog(logDataBeforeStore);
        fetch(
          "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logDataBeforeStore),
          }
        ).catch(() => {});
        // #endregion
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
            const logRetry = {
              location: "message-service.ts:175",
              message: "Title set on retry after message storage",
              data: { conversationId, title },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "J",
            };
            console.log("[DEBUG]", JSON.stringify(logRetry));
            await writeDebugLog(logRetry);
          } catch (error) {
            const logRetryError = {
              location: "message-service.ts:185",
              message: "ERROR setting title on retry",
              data: {
                conversationId,
                title,
                error: error instanceof Error ? error.message : String(error),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "J",
            };
            console.error("[DEBUG ERROR]", JSON.stringify(logRetryError));
            await writeDebugLog(logRetryError);
          }
        }

        // #region agent log
        const logDataAfterStore = {
          location: "message-service.ts:198",
          message: "User message stored successfully",
          data: {
            conversationId,
            finalTitle: await this.conversationsRepo.getTitle(conversationId),
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "I",
        };
        console.log("[DEBUG]", JSON.stringify(logDataAfterStore));
        await writeDebugLog(logDataAfterStore);
        fetch(
          "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logDataAfterStore),
          }
        ).catch(() => {});
        // #endregion
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
    // #region agent log
    const logData6 = {
      location: "message-service.ts:191",
      message: "setConversationTitleIfNeeded called",
      data: {
        conversationId,
        userContent,
        userContentLength: userContent?.length,
        isEmpty: !userContent || userContent.trim() === "",
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    };
    console.log("[DEBUG]", JSON.stringify(logData6));
    await writeDebugLog(logData6);
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData6),
    }).catch(() => {});
    // #endregion
    // Check if conversation already has a title
    const existingTitle = await this.conversationsRepo.getTitle(conversationId);
    // #region agent log
    const logData7 = {
      location: "message-service.ts:216",
      message: "Existing title check",
      data: {
        existingTitle,
        hasTitle: !!(existingTitle && existingTitle.trim() !== ""),
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    };
    console.log("[DEBUG]", JSON.stringify(logData7));
    await writeDebugLog(logData7);
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData7),
    }).catch(() => {});
    // #endregion
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
    // #region agent log
    const logData3 = {
      location: "message-service.ts:247",
      message: "hasUserMessages check",
      data: { hasUserMessages, conversationId },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    };
    console.log("[DEBUG]", JSON.stringify(logData3));
    await writeDebugLog(logData3);
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData3),
    }).catch(() => {});
    // #endregion

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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "message-service.ts:79",
        message: "Title to be set",
        data: {
          title,
          titleLength: title?.length,
          isEmpty: !title || title.trim() === "",
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    try {
      await this.conversationsRepo.updateTitle(conversationId, title);
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:163",
            message: "Title update completed successfully",
            data: { conversationId, title },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion

      // Verify the title was actually set by reading it back
      const verifyTitle = await this.conversationsRepo.getTitle(conversationId);
      // #region agent log
      const logData8 = {
        location: "message-service.ts:285",
        message: "Title verification after update",
        data: {
          conversationId,
          expectedTitle: title,
          actualTitle: verifyTitle,
          matches: verifyTitle === title,
          isNull: verifyTitle === null,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "F",
      };
      console.log("[DEBUG]", JSON.stringify(logData8));
      await writeDebugLog(logData8);
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(logData8),
        }
      ).catch(() => {});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:193",
            message: "ERROR in updateTitle",
            data: {
              conversationId,
              title,
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              errorName: error instanceof Error ? error.name : undefined,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion
      // Re-throw to let the caller handle it
      throw error;
    }
  }
}
