import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/error-handler";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;

    // Authenticate user
    const { userId } = await requireAuth();

    // Fetch and verify ownership
    const conversationsRepo = new ConversationsRepository();
    const conversation = await conversationsRepo.findByIdAndVerifyOwner(
      conversationId,
      userId
    );

    return NextResponse.json({ conversation });
  } catch (error) {
    return handleApiError(error);
  }
}
