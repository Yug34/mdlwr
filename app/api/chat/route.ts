import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
 
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
 
export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
 
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
 
    const result = streamText({
      model: openai("gpt-4.1"),
      messages: convertToModelMessages(messages),
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
      },
    );
  }
}