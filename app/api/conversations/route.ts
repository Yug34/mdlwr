import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/error-handler";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { CreateConversationResponse } from "@/lib/types";

export async function POST() {
  try {
    // Authenticate user
    const { userId } = await requireAuth();

    // Create a new conversation
    const conversationsRepo = new ConversationsRepository();
    const newConversation = await conversationsRepo.create(userId, null);

    return NextResponse.json<CreateConversationResponse>({
      conversationId: newConversation.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    // Authenticate user
    const { userId } = await requireAuth();

    // Fetch conversations for the user
    const conversationsRepo = new ConversationsRepository();
    const conversations = await conversationsRepo.findByUserId(userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
