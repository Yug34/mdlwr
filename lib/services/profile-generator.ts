import { createSupabaseClient } from "@/lib/supabase";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: any;
  created_at: string;
}

/**
 * Fetch recent conversations for a user
 * Gets messages from last 30 days or last 10 conversations, whichever is more
 * @param userId - The Supabase user ID
 * @returns Array of messages from recent conversations
 */
export async function fetchRecentConversations(
  userId: string
): Promise<Message[]> {
  const supabase = createSupabaseClient();

  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  // First, get recent conversations (last 30 days or last 10)
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgoISO)
    .order("created_at", { ascending: false })
    .limit(10);

  if (convError) {
    console.error("Error fetching conversations:", convError);
    return [];
  }

  // If we have conversations, fetch their messages
  if (conversations && conversations.length > 0) {
    const conversationIds = conversations.map((conv) => conv.id);

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, role, content, parts, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return [];
    }

    return (messages || []) as Message[];
  }

  return [];
}

/**
 * Generate a personality profile from conversation history using LLM
 * @param messages - Array of messages from conversation history
 * @param openai - OpenAI client instance
 * @returns Generated personality profile text
 */
export async function generatePersonalityProfile(
  messages: Message[],
  openai: ReturnType<typeof createOpenAI>
): Promise<string> {
  if (messages.length === 0) {
    return "I don't have enough conversation history yet to create a personality profile. Keep chatting and I'll learn more about you!";
  }

  // Format messages for analysis
  const conversationText = messages
    .map((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : msg.parts
            ?.map((part: any) => (part.type === "text" ? part.text : ""))
            .join("") || "";
      return `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
    })
    .join("\n\n");

  // Generate profile using LLM
  const result = await generateText({
    model: openai("gpt-4.1"),
    prompt: `Analyze the following conversation history and create a personality profile of the user. 
Focus on consistent patterns, interests, communication style, preferences, and personality traits that appear across multiple conversations.

Conversation History:
${conversationText}

Create a natural, readable personality profile (200-500 words) that describes:
- Communication style and tone
- Interests and topics they engage with
- Personality traits and characteristics
- Preferences and values that emerge
- Any consistent patterns in how they think or express themselves

Write it as if you're describing a friend - natural and conversational, not clinical or bullet-pointed. Format it as a cohesive narrative.

Personality Profile:`,
    maxTokens: 1000,
  });

  return result.text;
}

/**
 * Detect if a message is a self-reference query using LLM
 * @param message - The user's message text
 * @param openai - OpenAI client instance
 * @returns True if the message is asking about themselves, false otherwise
 */
export async function isSelfReferenceQuery(
  message: string,
  openai: ReturnType<typeof createOpenAI>
): Promise<boolean> {
  if (!message || message.trim().length === 0) {
    return false;
  }

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"), // Use cheaper model for classification
      prompt: `Classify if this user message is asking about themselves, their personality, or what the assistant knows about them.

Respond with ONLY "yes" or "no" - nothing else.

Message: "${message}"

Examples of self-reference (respond "yes"):
- "Who am I?"
- "Tell me about myself"
- "What do you know about me?"
- "What are my interests?"
- "Describe my personality"
- "What am I like?"
- "Summarize me"
- "What are my preferences?"

Examples of NOT self-reference (respond "no"):
- "How does React work?"
- "What is TypeScript?"
- "Explain async/await"
- "Tell me a joke"
- "What's the weather?"

Classification:`,
      maxTokens: 5,
      temperature: 0,
    });

    const classification = result.text.toLowerCase().trim();
    return classification.startsWith("yes");
  } catch (error) {
    console.error("Error in self-reference detection:", error);
    // Fallback to false on error
    return false;
  }
}


