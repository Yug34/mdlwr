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
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "message-service.ts:52",
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
          }),
        }
      ).catch(() => {});
      // #endregion
      if (userContent) {
        // Check if we need to set conversation title
        await this.setConversationTitleIfNeeded(conversationId, userContent);

        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "message-service.ts:70",
              message: "About to store user message",
              data: {
                conversationId,
                userContent,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "I",
            }),
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
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "message-service.ts:85",
              message: "User message stored successfully",
              data: {
                conversationId,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "I",
            }),
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
    const hasUserMessages = await this.conversationsRepo.hasUserMessages(
      conversationId
    );
    // #region agent log
    const logData3 = {
      location: "message-service.ts:72",
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
    if (hasUserMessages) {
      return; // Not the first message
    }

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
