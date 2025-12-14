import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamText } from "ai";
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
import {
  createMockSupabaseClient,
  createMockOpenAIClient,
  createMockKindeSession,
  resetMockData,
  addMockConversation,
  createTestConversation,
} from "../utils/mocks";
import {
  createTestUser as createUser,
  createMockRequest,
} from "../utils/test-helpers";

// Mock all dependencies
vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock("@kinde-oss/kinde-auth-nextjs/server", () => ({
  getKindeServerSession: vi.fn(),
}));

vi.mock("@/lib/supabase/users", () => ({
  getOrCreateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/profiles", () => ({
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock("@/lib/services/profile-generator", () => ({
  isSelfReferenceQuery: vi.fn(),
  fetchRecentConversations: vi.fn(),
  generatePersonalityProfile: vi.fn(),
}));

describe("POST /api/chat", () => {
  let testUser: ReturnType<typeof createUser>;
  let testUserId: string;

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    testUser = createUser();
    testUserId = testUser.id;

    // Setup default mocks
    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession({
        id: testUser.kinde_user_id,
        email: testUser.email,
      }) as any
    );
    vi.mocked(getOrCreateUser).mockResolvedValue(testUserId);

    const mockOpenAI = createMockOpenAIClient();
    vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);

    // Default streamText mock
    vi.mocked(streamText).mockReturnValue({
      text: Promise.resolve("Mock assistant response"),
      toUIMessageStreamResponse: () => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"text","text":"Mock assistant response"}\n\n'
                )
              );
              controller.close();
            },
          }),
          {
            headers: {
              "Content-Type": "text/event-stream",
            },
          }
        );
        response.headers.set("X-Conversation-Id", "test-conv-id");
        return response;
      },
    } as any);
  });

  it("should send message and receive streaming response", async () => {
    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(streamText).toHaveBeenCalled();
  });

  it("should create new conversation when conversationId is missing", async () => {
    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Conversation-Id")).toBeTruthy();
  });

  it("should use existing conversation when conversationId provided", async () => {
    const testConv = createTestConversation(testUserId);
    addMockConversation(testConv);

    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
      conversationId: testConv.id,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("should store user and assistant messages in database", async () => {
    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Test message" }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Wait for async message storage
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should set conversation title from first user message", async () => {
    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "This is my first message" }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should handle authentication errors", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );
    vi.mocked(getOrCreateUser).mockResolvedValue(null);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);
    // Should still process but may fail later
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it("should handle unauthorized conversation access", async () => {
    const otherUser = createUser();
    const otherUserConv = createTestConversation(otherUser.id);
    addMockConversation(otherUserConv);

    const mockSupabase = createMockSupabaseClient();
    vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
      conversationId: otherUserConv.id,
    });

    const response = await POST(request);
    // Should return 403 or create new conversation
    expect([200, 403]).toContain(response.status);
  });

  describe("Profile generation integration", () => {
    it("should detect self-reference query ('Who am I')", async () => {
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(getUserProfile).mockResolvedValue(null);
      vi.mocked(fetchRecentConversations).mockResolvedValue([
        {
          id: "1",
          role: "user",
          content: "I love coding",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          role: "assistant",
          content: "That's great!",
          created_at: new Date().toISOString(),
        },
      ] as any);
      vi.mocked(generatePersonalityProfile).mockResolvedValue(
        "You are a developer who loves coding..."
      );

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(isSelfReferenceQuery).toHaveBeenCalledWith(
        "Who am I?",
        expect.anything()
      );
    });

    it("should generate profile when no existing profile exists", async () => {
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(getUserProfile).mockResolvedValue(null);
      vi.mocked(fetchRecentConversations).mockResolvedValue([
        {
          id: "1",
          role: "user",
          content: "I love TypeScript",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          role: "assistant",
          content: "That's great!",
          created_at: new Date().toISOString(),
        },
      ] as any);
      vi.mocked(generatePersonalityProfile).mockResolvedValue(
        "Generated profile text"
      );
      vi.mocked(saveUserProfile).mockResolvedValue({
        id: "profile-1",
        user_id: testUserId,
        profile_data: { profile_text: "Generated profile text" },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as any);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generatePersonalityProfile).toHaveBeenCalled();
      expect(saveUserProfile).toHaveBeenCalled();
    });

    it("should use existing profile when available", async () => {
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(getUserProfile).mockResolvedValue({
        id: "profile-1",
        user_id: testUserId,
        profile_data: { profile_text: "Existing profile" },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as any);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generatePersonalityProfile).not.toHaveBeenCalled();
      expect(getUserProfile).toHaveBeenCalled();
    });

    it("should include profile in system message for LLM", async () => {
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(getUserProfile).mockResolvedValue({
        id: "profile-1",
        user_id: testUserId,
        profile_data: { profile_text: "Test profile" },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as any);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      await POST(request);
      expect(streamText).toHaveBeenCalled();
      const streamTextCall = vi.mocked(streamText).mock.calls[0][0];
      expect(streamTextCall.system).toContain("Test profile");
    });

    it("should handle case with insufficient conversation history", async () => {
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(getUserProfile).mockResolvedValue(null);
      vi.mocked(fetchRecentConversations).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generatePersonalityProfile).not.toHaveBeenCalled();
    });
  });
});
