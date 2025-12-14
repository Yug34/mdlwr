import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/error-handler";
import { ConversationsRepository } from "@/lib/repositories/conversations-repository";
import { CreateConversationResponse } from "@/lib/types";

export async function POST(req: Request) {
  try {
    // #region agent log
    const requestBody = await req.json().catch(() => ({}));
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations/route.ts:7",
        message: "POST /api/conversations - request body",
        data: {
          body: requestBody,
          titleValue: requestBody?.title,
          titleType: typeof requestBody?.title,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    // Authenticate user
    const { userId } = await requireAuth();

    // #region agent log
    const titleToUse = requestBody?.title ?? null;
    fetch("http://127.0.0.1:7242/ingest/10e0db4e-6c5c-4a4b-b4df-391e1068d6a0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "conversations/route.ts:14",
        message: "Title value before creating conversation",
        data: {
          titleToUse,
          titleType: typeof titleToUse,
          isNull: titleToUse === null,
          isUndefined: titleToUse === undefined,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    // Create a new conversation
    const conversationsRepo = new ConversationsRepository();
    const newConversation = await conversationsRepo.create(userId, titleToUse);

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
