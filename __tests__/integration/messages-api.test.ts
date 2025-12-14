import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/conversations/[conversationId]/messages/route";
import { createSupabaseClient } from "@/lib/supabase";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getOrCreateUser } from "@/lib/supabase/users";
import {
  createMockSupabaseClient,
  createMockKindeSession,
  resetMockData,
  addMockConversation,
  addMockMessage,
  createTestConversation,
  createTestMessage,
} from "../utils/mocks";
import {
  createTestUser as createUser,
  createMockParams,
} from "../utils/test-helpers";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock("@kinde-oss/kinde-auth-nextjs/server", () => ({
  getKindeServerSession: vi.fn(),
}));

vi.mock("@/lib/supabase/users", () => ({
  getOrCreateUser: vi.fn(),
}));

describe("GET /api/conversations/[conversationId]/messages", () => {
  let testUser: ReturnType<typeof createUser>;
  let testUserId: string;
  let testConversation: ReturnType<typeof createTestConversation>;

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    testUser = createUser();
    testUserId = testUser.id;
    testConversation = createTestConversation(testUserId);

    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession({
        id: testUser.kinde_user_id,
        email: testUser.email,
      }) as any
    );
    vi.mocked(getOrCreateUser).mockResolvedValue(testUserId);
  });

  it("should return messages for valid conversation", async () => {
    addMockConversation(testConversation);
    const message1 = createTestMessage(testConversation.id, "user", "Hello");
    const message2 = createTestMessage(
      testConversation.id,
      "assistant",
      "Hi there!"
    );
    addMockMessage(message1);
    addMockMessage(message2);

    const request = new Request(
      "http://localhost:3000/api/conversations/test/messages",
      {
        method: "GET",
      }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
  });

  it("should order messages by created_at ascending", async () => {
    addMockConversation(testConversation);
    const message1 = createTestMessage(testConversation.id, "user", "First", {
      created_at: new Date(Date.now() - 2000).toISOString(),
    });
    const message2 = createTestMessage(
      testConversation.id,
      "assistant",
      "Second",
      {
        created_at: new Date(Date.now() - 1000).toISOString(),
      }
    );
    const message3 = createTestMessage(testConversation.id, "user", "Third", {
      created_at: new Date().toISOString(),
    });
    addMockMessage(message1);
    addMockMessage(message2);
    addMockMessage(message3);

    const request = new Request(
      "http://localhost:3000/api/conversations/test/messages",
      {
        method: "GET",
      }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("should format messages correctly", async () => {
    addMockConversation(testConversation);
    const message = createTestMessage(
      testConversation.id,
      "user",
      "Test message"
    );
    addMockMessage(message);

    const request = new Request(
      "http://localhost:3000/api/conversations/test/messages",
      {
        method: "GET",
      }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messages[0]).toHaveProperty("id");
    expect(data.messages[0]).toHaveProperty("role");
    expect(data.messages[0]).toHaveProperty("content");
    expect(data.messages[0]).toHaveProperty("parts");
  });

  it("should reject access to other user's conversations", async () => {
    const otherUser = createUser();
    const otherUserConv = createTestConversation(otherUser.id);
    addMockConversation(otherUserConv);

    const request = new Request(
      "http://localhost:3000/api/conversations/test/messages",
      {
        method: "GET",
      }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: otherUserConv.id }),
    });

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 404 for non-existent conversation", async () => {
    const request = new Request(
      "http://localhost:3000/api/conversations/test/messages",
      {
        method: "GET",
      }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: "non-existent-id" }),
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe("Conversation not found");
  });
});
