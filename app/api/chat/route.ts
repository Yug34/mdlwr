import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "@/lib/api/auth-helpers";
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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "chat/route.ts:27",
        message: "POST /api/chat - request body received",
        data: {
          hasTitle: !!body.title,
          titleValue: body.title,
          titleType: typeof body.title,
          hasMessages: !!body.messages,
          messagesLength: body.messages?.length,
          hasConversationId: !!body.conversationId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    let validatedRequest: ChatRequest;
    try {
      validatedRequest = validateChatRequest(body);
    } catch (error) {
      throw new ValidationError("Invalid request data", error);
    }

    const { messages, conversationId } = validatedRequest;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "chat/route.ts:38",
        message: "After validation - extracted values",
        data: {
          conversationId,
          messagesLength: messages?.length,
          firstUserMessage: messages?.find((m) => m.role === "user"),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion

    // Authenticate user
    const { userId } = await requireAuth();

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

    // Check for self-reference query and get profile if needed
    const userMessageContent = extractLastUserMessageContent(messages);
    let profileText: string | null = null;

    if (userMessageContent) {
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

    // Store messages after streaming completes
    const lastUserMessage = getLastUserMessage(messages);
    result.text
      .then(async (fullText) => {
        try {
          const messageService = new MessageService();
          await messageService.storeMessages({
            conversationId: finalConversationId,
            userMessage: lastUserMessage,
            assistantContent: fullText,
          });
        } catch (error) {
          console.error("Error storing messages:", error);
        }
      })
      .catch((error) => {
        console.error("Error getting stream text:", error);
      });

    // Add conversationId to response headers so frontend can update URL
    const response = result.toUIMessageStreamResponse();
    response.headers.set("X-Conversation-Id", finalConversationId);
    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return createErrorResponse(error);
  }
}
