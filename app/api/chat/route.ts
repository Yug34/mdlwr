import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createSupabaseClient } from "@/lib/supabase";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, conversationId } = await req.json();

    console.log("messages", messages);
    console.log("conversationId", conversationId);

    const supabase = createSupabaseClient();

    // Get authenticated user from Kinde session
    let userId: string | null = null;
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    // If we have a Kinde user, look them up in the database
    if (user?.id) {
      const { data: dbUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("kinde_user_id", user.id)
        .single();

      if (!userError && dbUser) {
        userId = dbUser.id;
        console.log("Found user ID:", userId);
      } else if (userError) {
        console.log("User not found in database for kinde_user_id:", user.id);
      }
    }

    // Create conversation ID if chat is empty (no conversationId provided)
    let finalConversationId = conversationId;
    if (!finalConversationId) {
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

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = streamText({
      model: openai("gpt-4.1"),
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

    return result.toUIMessageStreamResponse();
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
