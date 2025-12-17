import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { after } from "next/server";
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
import {
  sanitizeMessages,
  logSanitizationWarning,
} from "@/lib/utils/sanitization";
import {
  withTimeout,
  createTimeoutController,
  TIMEOUT_CONFIG,
} from "@/lib/utils/timeout";
import { validateChatRequest } from "@/lib/validation/schemas";
import { createErrorResponse } from "@/lib/api/error-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/constants/ai-config";
import { MIN_MESSAGES_FOR_PROFILE } from "@/lib/constants/conversation-config";
import { ChatRequest, InputMessage } from "@/lib/types";
import { ValidationError, TimeoutError } from "@/lib/errors/app-errors";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  // Create abort controller for request-level timeout handling
  const { signal: requestSignal, cleanup: cleanupRequestTimeout } =
    createTimeoutController(TIMEOUT_CONFIG.STREAMING);

  try {
    // Validate request
    const body = await req.json();
    let validatedRequest: ChatRequest;
    try {
      validatedRequest = validateChatRequest(body);
    } catch (error) {
      throw new ValidationError("Invalid request data", error);
    }

    const { messages: rawMessages, conversationId } = validatedRequest;

    // Sanitize user input before processing
    const sanitizationResult = sanitizeMessages(rawMessages);
    const messages = sanitizationResult.messages;

    // Get authenticated user (optional)
    const authenticatedUser = await getAuthenticatedUser();
    const userId = authenticatedUser?.userId ?? null;

    // Log sanitization warnings for monitoring (non-blocking)
    if (
      sanitizationResult.hasInjectionPatterns ||
      sanitizationResult.wasTruncated
    ) {
      logSanitizationWarning({
        hasInjectionPatterns: sanitizationResult.hasInjectionPatterns,
        wasTruncated: sanitizationResult.wasTruncated,
        totalLength: sanitizationResult.totalLength,
        userId,
      });
    }

    // Resolve or create conversation with timeout
    // Pass first message content so title can be set when creating a new conversation
    const userMessageContent = extractLastUserMessageContent(messages);
    const conversationService = new ConversationService();
    const finalConversationId = await withTimeout(
      conversationService.resolveOrCreateConversation({
        userId,
        conversationId,
        messages,
        firstMessageContent: userMessageContent || undefined,
      }),
      TIMEOUT_CONFIG.DATABASE,
      "Conversation resolution"
    );

    // Initialize OpenAI client
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Check for self-reference query and get profile if needed (only for authenticated users)
    let profileText: string | null = null;

    if (userMessageContent && userId) {
      // Pass abort signal for cancellation on timeout
      const isSelfRef = await isSelfReferenceQuery(
        userMessageContent,
        openai,
        requestSignal
      );

      if (isSelfRef) {
        // Try to get existing profile with timeout
        const existingProfile = await withTimeout(
          getUserProfile(userId),
          TIMEOUT_CONFIG.DATABASE,
          "Get user profile"
        );

        if (existingProfile?.profile_data?.profile_text) {
          profileText = existingProfile.profile_data.profile_text;
        } else {
          // Generate new profile
          try {
            const recentMessages = await fetchRecentConversations(userId);

            if (recentMessages.length >= MIN_MESSAGES_FOR_PROFILE) {
              profileText = await generatePersonalityProfile(
                recentMessages,
                openai,
                requestSignal
              );
              // Save profile with timeout (non-critical, so we catch errors)
              await withTimeout(
                saveUserProfile(userId, {
                  profile_text: profileText,
                }),
                TIMEOUT_CONFIG.DATABASE,
                "Save user profile"
              );
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
      abortSignal: requestSignal,
    });

    // Store messages after streaming completes (only for authenticated users)
    const lastUserMessage = getLastUserMessage(messages);

    // Store user message immediately if we have userId
    // This ensures the message is stored even if the stream promise fails
    // Note: Title is already set during conversation creation above
    if (userId && lastUserMessage) {
      try {
        const messageService = new MessageService();
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
    // Use Next.js `after` function to ensure the save completes even after response is sent
    // This is critical in serverless environments where the function may terminate after response
    if (userId) {
      // Use `after` to ensure the promise completes even after response is sent
      // This prevents serverless function termination from killing the async work
      after(async () => {
        try {
          const fullText = await result.text;

          // Re-fetch authenticated user to ensure we have userId
          // This handles cases where authentication state might have changed
          let currentUserId: string | null = userId;
          if (!currentUserId) {
            try {
              const authUser = await getAuthenticatedUser();
              currentUserId = authUser?.userId ?? null;
            } catch (error) {
              console.error("Error re-fetching user in after():", error);
            }
          }

          // If still no userId, skip
          if (!currentUserId) {
            return;
          }

          try {
            const messageService = new MessageService();
            // Only store assistant message here since user message was already stored above
            await messageService.storeMessages({
              conversationId: finalConversationId,
              userMessage: undefined, // Already stored above
              assistantContent: fullText,
              userId: currentUserId, // Use the re-fetched userId
            });
          } catch (error) {
            console.error("Error storing messages:", error);
          }
        } catch (error) {
          console.error("Error in after() callback:", error);
        }
      });
    }

    // Add conversationId and auth status to response headers so frontend can update URL
    const response = result.toUIMessageStreamResponse();
    response.headers.set("X-Conversation-Id", finalConversationId);
    response.headers.set("X-Authenticated", userId ? "true" : "false");

    // Clean up request timeout since response is being sent
    cleanupRequestTimeout();

    return response;
  } catch (error) {
    // Clean up request timeout on error
    cleanupRequestTimeout();

    // Log appropriate message based on error type
    if (error instanceof TimeoutError) {
      console.error("Chat API timeout:", error.message);
    } else {
      console.error("Chat API error:", error);
    }

    return createErrorResponse(error);
  }
}
