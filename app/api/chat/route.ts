import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAuthenticatedUser } from "@/lib/api/auth-helpers";
import { getUserProfile, saveUserProfile } from "@/lib/supabase/profiles";
import {
  isSelfReferenceQuery,
  fetchRecentConversations,
  generatePersonalityProfile,
} from "@/lib/services/profile-generator";
import { ConversationService } from "@/lib/services/conversation-service";
import { MessageService } from "@/lib/services/message-service";
import {
  extractLastUserMessageContent,
  getLastUserMessage,
  extractMessageContent,
} from "@/lib/utils/message-utils";
import { validateChatRequest } from "@/lib/validation/schemas";
import { createErrorResponse } from "@/lib/api/error-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/constants/ai-config";
import { MIN_MESSAGES_FOR_PROFILE } from "@/lib/constants/conversation-config";
import { ChatRequest, InputMessage } from "@/lib/types";
import { ValidationError } from "@/lib/errors/app-errors";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Validate request
    const body = await req.json();
    let validatedRequest: ChatRequest;
    try {
      validatedRequest = validateChatRequest(body);
    } catch (error) {
      throw new ValidationError("Invalid request data", error);
    }

    const { messages, conversationId } = validatedRequest;

    // Get authenticated user (optional)
    const authenticatedUser = await getAuthenticatedUser();
    const userId = authenticatedUser?.userId ?? null;

    // Resolve or create conversation
    const conversationService = new ConversationService();
    const finalConversationId =
      await conversationService.resolveOrCreateConversation({
        userId,
        conversationId,
        messages,
      });

    // Initialize OpenAI client
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Check for self-reference query and get profile if needed (only for authenticated users)
    const userMessageContent = extractLastUserMessageContent(messages);
    let profileText: string | null = null;

    if (userMessageContent && userId) {
      const isSelfRef = await isSelfReferenceQuery(userMessageContent, openai);

      if (isSelfRef) {
        // Try to get existing profile
        const existingProfile = await getUserProfile(userId);

        if (existingProfile?.profile_data?.profile_text) {
          profileText = existingProfile.profile_data.profile_text;
        } else {
          // Generate new profile
          try {
            const recentMessages = await fetchRecentConversations(userId);

            if (recentMessages.length >= MIN_MESSAGES_FOR_PROFILE) {
              profileText = await generatePersonalityProfile(
                recentMessages,
                openai
              );
              await saveUserProfile(userId, {
                profile_text: profileText,
              });
            } else {
              profileText =
                "I don't have enough conversation history yet to create a personality profile. Keep chatting and I'll learn more about you!";
            }
          } catch (error) {
            console.error("Error generating profile:", error);
            profileText = null; // Fall back to normal response
          }
        }
      }
    }

    // Prepare system message with profile if available
    const systemMessage = profileText
      ? `You are a helpful assistant. Here's what you know about the user based on past conversations:\n\n${profileText}\n\nUse this information to provide a personalized response when the user asks about themselves.`
      : undefined;

    // Stream response
    // Convert messages to the format expected by AI SDK
    // The AI SDK expects messages with content or parts, but our InputMessage may have optional parts
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content || extractMessageContent(msg),
      ...(msg.parts && { parts: msg.parts }),
    }));

    const result = streamText({
      model: openai(DEFAULT_CHAT_MODEL),
      ...(systemMessage && { system: systemMessage }),
      messages: convertToModelMessages(
        formattedMessages as Parameters<typeof convertToModelMessages>[0]
      ),
    });

    // Store messages after streaming completes (only for authenticated users)
    const lastUserMessage = getLastUserMessage(messages);

    // Store user message immediately if we have userId
    // This ensures the message is stored even if the stream promise fails
    if (userId && lastUserMessage) {
      try {
        const messageService = new MessageService();
        // Store just the user message first - title will be set here
        const userContent = extractMessageContent(lastUserMessage);
        if (userContent) {
          await messageService.storeMessages({
            conversationId: finalConversationId,
            userMessage: lastUserMessage,
            assistantContent: "", // Empty for now, will be updated when stream completes
            userId,
          });
        }
      } catch (error) {
        console.error("Error storing user message:", error);
      }
    }

    // Store assistant message when stream completes
    // Store the promise explicitly to prevent garbage collection and ensure it's tracked
    let assistantSavePromise: Promise<void> | null = null;
    if (userId) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "route.ts:142",
            message: "Setting up result.text promise handler",
            data: { userId, conversationId: finalConversationId },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "post-fix",
            hypothesisId: "A",
          }),
        }
      ).catch(() => {});
      // #endregion
      // Store promise to ensure it's tracked and doesn't get garbage collected
      assistantSavePromise = result.text
        .then(async (fullText) => {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "route.ts:144",
                message: "result.text promise resolved",
                data: {
                  fullTextLength: fullText?.length || 0,
                  fullTextIsEmpty: !fullText,
                  fullTextType: typeof fullText,
                  userId,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "post-fix",
                hypothesisId: "E",
              }),
            }
          ).catch(() => {});
          // #endregion
          // Re-fetch authenticated user inside the promise to ensure we have userId
          // This handles cases where authentication state might have changed
          let currentUserId: string | null = userId;
          if (!currentUserId) {
            try {
              const authUser = await getAuthenticatedUser();
              currentUserId = authUser?.userId ?? null;
              // #region agent log
              fetch(
                "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "route.ts:151",
                    message: "Re-fetched userId in promise",
                    data: { currentUserId },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix",
                    hypothesisId: "C",
                  }),
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
                    location: "route.ts:153",
                    message: "Error re-fetching user in promise",
                    data: { error: String(error) },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix",
                    hypothesisId: "C",
                  }),
                }
              ).catch(() => {});
              // #endregion
              console.error("Error re-fetching user in promise:", error);
            }
          }

          // If still no userId, skip
          if (!currentUserId) {
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "route.ts:159",
                  message: "Skipping save due to null userId",
                  data: { currentUserId },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix",
                  hypothesisId: "C",
                }),
              }
            ).catch(() => {});
            // #endregion
            return;
          }

          try {
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "route.ts:163",
                  message: "About to call storeMessages for assistant",
                  data: {
                    conversationId: finalConversationId,
                    assistantContentLength: fullText?.length || 0,
                    userId: currentUserId,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix",
                  hypothesisId: "D",
                }),
              }
            ).catch(() => {});
            // #endregion
            const messageService = new MessageService();
            // Only store assistant message here since user message was already stored above
            await messageService.storeMessages({
              conversationId: finalConversationId,
              userMessage: undefined, // Already stored above
              assistantContent: fullText,
              userId: currentUserId, // Use the re-fetched userId
            });
            // #region agent log
            fetch(
              "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "route.ts:171",
                  message: "storeMessages completed successfully",
                  data: { conversationId: finalConversationId },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix",
                  hypothesisId: "D",
                }),
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
                  location: "route.ts:173",
                  message: "Error in storeMessages",
                  data: {
                    error: String(error),
                    errorStack: error instanceof Error ? error.stack : null,
                    conversationId: finalConversationId,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix",
                  hypothesisId: "D",
                }),
              }
            ).catch(() => {});
            // #endregion
            console.error("Error storing messages:", error);
          }
        })
        .catch((error) => {
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "route.ts:176",
                message: "result.text promise rejected",
                data: {
                  error: String(error),
                  errorStack: error instanceof Error ? error.stack : null,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "post-fix",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion
          console.error("Error getting stream text:", error);
        })
        .then(() => {
          // Ensure promise resolves even if there's no explicit return
          // #region agent log
          fetch(
            "http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "route.ts:359",
                message: "Assistant save promise completed successfully",
                data: { conversationId: finalConversationId },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "post-fix",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
          // #endregion
          return;
        })
        .catch(() => {
          // Additional error handling - already logged above
        });

      // Explicitly keep reference to promise to prevent garbage collection
      // In serverless environments, storing the promise ensures it's tracked
      // and the runtime knows to wait for it before terminating
      // Store in a way that prevents GC but doesn't block the response
      if (assistantSavePromise) {
        // Ensure the promise is in the closure and tracked by the runtime
        // This pattern helps in serverless environments where the function
        // should stay alive as long as there are pending promises
        assistantSavePromise.catch(() => {
          // Silently handle any errors - they're already logged above
        });
      }
    }

    // Add conversationId to response headers so frontend can update URL
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "route.ts:181",
        message: "Returning HTTP response (before promise completes)",
        data: { conversationId: finalConversationId, userId },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    const response = result.toUIMessageStreamResponse();
    response.headers.set("X-Conversation-Id", finalConversationId);
    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return createErrorResponse(error);
  }
}
