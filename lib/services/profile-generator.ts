import { createSupabaseClient } from "@/lib/supabase";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ConversationMessage } from "@/lib/types";
import {
  DEFAULT_CHAT_MODEL,
  CLASSIFICATION_MODEL,
  PROFILE_GENERATION_MAX_TOKENS,
} from "@/lib/constants/ai-config";
import {
  RECENT_CONVERSATION_DAYS,
  MAX_RECENT_CONVERSATIONS,
} from "@/lib/constants/conversation-config";
import {
  withTimeout,
  TIMEOUT_CONFIG,
} from "@/lib/utils/timeout";

/**
 * Fetch recent conversations for a user
 * Gets messages from last 30 days or last 10 conversations, whichever is more
 * @param userId - The Supabase user ID
 * @returns Array of messages from recent conversations
 */
export async function fetchRecentConversations(
  userId: string
): Promise<ConversationMessage[]> {
  const supabase = createSupabaseClient();

  // Calculate date N days ago
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - RECENT_CONVERSATION_DAYS);
  const daysAgoISO = daysAgo.toISOString();

  // First, get recent conversations with timeout
  const conversationsPromise = supabase
    .from("conversations")
    .select("id, created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgoISO)
    .order("created_at", { ascending: false })
    .limit(MAX_RECENT_CONVERSATIONS);

  const { data: conversations, error: convError } = await withTimeout(
    conversationsPromise,
    TIMEOUT_CONFIG.DATABASE,
    "Fetch conversations"
  );

  if (convError) {
    console.error("Error fetching conversations:", convError);
    return [];
  }

  // If we have conversations, fetch their messages
  if (conversations && conversations.length > 0) {
    const conversationIds = conversations.map((conv) => conv.id);

    const messagesPromise = supabase
      .from("messages")
      .select("id, role, content, parts, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    const { data: messages, error: messagesError } = await withTimeout(
      messagesPromise,
      TIMEOUT_CONFIG.DATABASE,
      "Fetch messages"
    );

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return [];
    }

    return (messages || []).filter(
      (msg): msg is ConversationMessage =>
        msg.role === "user" || msg.role === "assistant"
    );
  }

  return [];
}

/**
 * Generate a personality profile from conversation history using LLM
 * @param messages - Array of messages from conversation history
 * @param openai - OpenAI client instance
 * @param abortSignal - Optional AbortSignal for cancellation
 * @returns Generated personality profile text
 */
export async function generatePersonalityProfile(
  messages: ConversationMessage[],
  openai: ReturnType<typeof createOpenAI>,
  abortSignal?: AbortSignal
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
              ?.map((part) =>
                part.type === "text" && part.text ? part.text : ""
              )
              .join("") || "";
      return `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
    })
    .join("\n\n");

  // Generate profile using LLM with timeout
  const generatePromise = generateText({
    model: openai(DEFAULT_CHAT_MODEL),
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
    abortSignal,
  });

  const result = await withTimeout(
    generatePromise,
    TIMEOUT_CONFIG.OPENAI_API,
    "Profile generation"
  );

  return result.text;
}

/**
 * Detect if a message is a self-reference query using LLM
 * @param message - The user's message text
 * @param openai - OpenAI client instance
 * @param abortSignal - Optional AbortSignal for cancellation
 * @returns True if the message is asking about themselves, false otherwise
 */
export async function isSelfReferenceQuery(
  message: string,
  openai: ReturnType<typeof createOpenAI>,
  abortSignal?: AbortSignal
): Promise<boolean> {
  if (!message || message.trim().length === 0) {
    return false;
  }

  try {
    const generatePromise = generateText({
      model: openai(CLASSIFICATION_MODEL), // Use cheaper model for classification
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
      temperature: 0,
      abortSignal,
    });

    const result = await withTimeout(
      generatePromise,
      TIMEOUT_CONFIG.CLASSIFICATION,
      "Self-reference classification"
    );

    const classification = result.text.toLowerCase().trim();
    return classification.startsWith("yes");
  } catch (error) {
    console.error("Error in self-reference detection:", error);
    // Fallback to false on error (including timeout)
    return false;
  }
}
