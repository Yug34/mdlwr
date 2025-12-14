import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createSupabaseClient } from "@/lib/supabase";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getOrCreateUser } from "@/lib/supabase/users";
import { getUserProfile, saveUserProfile } from "@/lib/supabase/profiles";
import {
  isSelfReferenceQuery,
  fetchRecentConversations,
  generatePersonalityProfile,
} from "@/lib/services/profile-generator";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, conversationId } = await req.json();

    const supabase = createSupabaseClient();

    // Get authenticated user from Kinde session and ensure they exist in Supabase
    let userId: string | null = null;
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    // Get or create user in Supabase
    if (user) {
      userId = await getOrCreateUser(user);
      if (!userId) {
        return new Response(
          JSON.stringify({
            error: "Failed to create or retrieve user",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create conversation ID if chat is empty (no conversationId provided)
    let finalConversationId = conversationId;

    // Only create a new conversation if conversationId is truly missing (null, undefined, or empty string)
    // If a conversationId is provided, verify it exists and belongs to the user
    if (!finalConversationId || finalConversationId.trim() === "") {
      // Before creating a new conversation, check if any messages in the current session
      // already exist in the database and have a conversation_id
      let foundConversationId: string | null = null;

      if (messages && Array.isArray(messages) && messages.length > 0) {
        // Find messages that have IDs (indicating they're already in the database)
        const messageIds = messages
          .map((msg: any) => msg.id)
          .filter((id: any) => id && typeof id === "string");

        if (messageIds.length > 0) {
          // Query the database to get conversation_id from existing messages
          const { data: existingMessages, error: msgError } = await supabase
            .from("messages")
            .select("conversation_id")
            .in("id", messageIds)
            .limit(1);

          if (!msgError && existingMessages && existingMessages.length > 0) {
            foundConversationId = existingMessages[0].conversation_id;
            console.log(
              "Found existing conversation from previous messages:",
              foundConversationId
            );
          }
        }
      }

      // If we found a conversation ID from existing messages, use it
      if (foundConversationId) {
        // Verify the conversation exists and belongs to the user
        const { data: existingConv, error: convCheckError } = await supabase
          .from("conversations")
          .select("id, user_id")
          .eq("id", foundConversationId)
          .single();

        if (
          !convCheckError &&
          existingConv &&
          existingConv.user_id === userId
        ) {
          finalConversationId = foundConversationId;
          console.log(
            "Using conversation from previous messages:",
            finalConversationId
          );
        } else {
          // Conversation doesn't exist or doesn't belong to user, create new one
          const { data: newConversation, error: convError } = await supabase
            .from("conversations")
            .insert({
              title: null,
              user_id: userId,
            })
            .select()
            .single();

          if (convError) {
            console.error("Error creating conversation:", convError);
            throw new Error("Failed to create conversation");
          }

          finalConversationId = newConversation.id;
          console.log("Created new conversation:", finalConversationId);
        }
      } else {
        // No existing messages found, create a new conversation
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            title: null,
            user_id: userId,
          })
          .select()
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
          throw new Error("Failed to create conversation");
        }

        finalConversationId = newConversation.id;
        console.log("Created new conversation:", finalConversationId);
      }
    } else {
      // Verify the conversation exists and belongs to the user
      const { data: existingConv, error: convCheckError } = await supabase
        .from("conversations")
        .select("id, user_id")
        .eq("id", finalConversationId)
        .single();

      if (convCheckError || !existingConv) {
        console.error(
          "Conversation not found or access denied:",
          finalConversationId
        );
        // If conversation doesn't exist, create a new one
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            title: null,
            user_id: userId,
          })
          .select()
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
          throw new Error("Failed to create conversation");
        }

        finalConversationId = newConversation.id;
        console.log(
          "Created new conversation (previous not found):",
          finalConversationId
        );
      } else if (existingConv.user_id !== userId) {
        console.error("Conversation access denied for user:", userId);
        return new Response(
          JSON.stringify({ error: "Unauthorized access to conversation" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      } else {
        console.log("Using existing conversation:", finalConversationId);
      }
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Extract last user message for self-reference detection
    const lastUserMessage = messages[messages.length - 1];
    const extractContent = (message: any): string => {
      if (typeof message.content === "string") {
        return message.content;
      }
      if (message.parts && Array.isArray(message.parts)) {
        return message.parts
          .map((part: any) => {
            if (part.type === "text" && part.text) {
              return part.text;
            }
            return "";
          })
          .join("");
      }
      return "";
    };

    const userMessageContent =
      lastUserMessage && lastUserMessage.role === "user"
        ? extractContent(lastUserMessage)
        : "";

    // Check if this is a self-reference query
    let profileText: string | null = null;
    if (userMessageContent && userId) {
      const isSelfRef = await isSelfReferenceQuery(userMessageContent, openai);

      if (isSelfRef) {
        console.log(
          "Self-reference query detected, fetching/generating profile"
        );

        // Try to get existing profile
        const existingProfile = await getUserProfile(userId);

        if (existingProfile?.profile_data?.profile_text) {
          // Use existing profile
          profileText = existingProfile.profile_data.profile_text;
          console.log("Using existing profile");
        } else {
          // Generate new profile
          console.log("Generating new profile from conversation history");
          try {
            const recentMessages = await fetchRecentConversations(userId);

            // Require at least 2 messages to generate a meaningful profile
            if (recentMessages.length >= 2) {
              profileText = await generatePersonalityProfile(
                recentMessages,
                openai
              );

              // Save profile to database
              await saveUserProfile(userId, {
                profile_text: profileText,
              });
              console.log("Profile generated and saved");
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

    const result = streamText({
      model: openai("gpt-4.1"),
      ...(systemMessage && { system: systemMessage }),
      messages: convertToModelMessages(messages),
    });

    // Store messages after streaming completes
    result.text
      .then(async (fullText) => {
        try {
          const supabase = createSupabaseClient();

          // Get the last user message (the one that triggered this response)
          const lastUserMessage = messages[messages.length - 1];

          // Extract content from message parts
          const extractContent = (message: any): string => {
            if (typeof message.content === "string") {
              return message.content;
            }
            if (message.parts && Array.isArray(message.parts)) {
              return message.parts
                .map((part: any) => {
                  if (part.type === "text" && part.text) {
                    return part.text;
                  }
                  return "";
                })
                .join("");
            }
            return "";
          };

          // Store user message
          if (lastUserMessage && lastUserMessage.role === "user") {
            const userContent = extractContent(lastUserMessage);
            if (userContent) {
              // Check if this is the first message and conversation needs a title
              const { data: conversation, error: convFetchError } =
                await supabase
                  .from("conversations")
                  .select("title")
                  .eq("id", finalConversationId)
                  .single();

              if (
                !convFetchError &&
                (!conversation?.title || conversation.title.trim() === "")
              ) {
                // Check if this is the first user message
                const { count } = await supabase
                  .from("messages")
                  .select("*", { count: "exact", head: true })
                  .eq("conversation_id", finalConversationId)
                  .eq("role", "user");

                // If no user messages exist yet (count is 0), this is the first one
                if (count === 0) {
                  // Set title to first user message (truncate to 100 chars)
                  const title =
                    userContent.length > 100
                      ? userContent.substring(0, 100).trim() + "..."
                      : userContent.trim();

                  await supabase
                    .from("conversations")
                    .update({ title })
                    .eq("id", finalConversationId);
                }
              }

              const { error: userMsgError } = await supabase
                .from("messages")
                .insert({
                  conversation_id: finalConversationId,
                  role: "user",
                  content: userContent,
                  parts: lastUserMessage.parts || null,
                });

              if (userMsgError) {
                console.error("Error storing user message:", userMsgError);
              } else {
                console.log(
                  "Stored user message for conversation:",
                  finalConversationId
                );
              }
            }
          }

          // Store assistant message
          if (fullText) {
            const { error: assistantMsgError } = await supabase
              .from("messages")
              .insert({
                conversation_id: finalConversationId,
                role: "assistant",
                content: fullText,
                parts: [{ type: "text", text: fullText }],
              });

            if (assistantMsgError) {
              console.error(
                "Error storing assistant message:",
                assistantMsgError
              );
            } else {
              console.log(
                "Stored assistant message for conversation:",
                finalConversationId
              );
            }
          }
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

    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
