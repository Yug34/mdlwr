import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/error-handler";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { MessagesRepository } from "@/lib/repositories/messages-repository";
import { GetMessagesResponse } from "@/lib/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;

    // Authenticate user
    const { userId } = await requireAuth();

    // Verify the conversation belongs to the user
    const conversationsRepo = new ConversationsRepository();
    await conversationsRepo.findByIdAndVerifyOwner(conversationId, userId);

    // Fetch messages for the conversation
    const messagesRepo = new MessagesRepository();
    const messages = await messagesRepo.findByConversationId(conversationId);

    // Transform messages to match the format expected by the chat client
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts: msg.parts || [{ type: "text", text: msg.content }],
    }));

    return NextResponse.json<GetMessagesResponse>({
      messages: formattedMessages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
