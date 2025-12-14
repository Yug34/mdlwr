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
  addMockMessage,
  createTestConversation,
  createTestMessage,
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

describe("End-to-End: Personality Profile Flow", () => {
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

    const mockOpenAI = createMockOpenAIClient();
    vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
  });

  it("should complete full flow: send messages, ask 'Who am I', generate and return profile", async () => {
    // Setup: User has sent 3-5 messages about various topics
    addMockConversation(testConversation);
    const messages = [
      createTestMessage(
        testConversation.id,
        "user",
        "I love coding in TypeScript"
      ),
      createTestMessage(
        testConversation.id,
        "assistant",
        "That's great! TypeScript is awesome."
      ),
      createTestMessage(
        testConversation.id,
        "user",
        "I work as a full-stack developer"
      ),
      createTestMessage(
        testConversation.id,
        "assistant",
        "Interesting! What's your favorite framework?"
      ),
      createTestMessage(
        testConversation.id,
        "user",
        "I prefer React for frontend development"
      ),
    ];

    messages.forEach((msg) => addMockMessage(msg));

    // Mock conversation history fetch
    vi.mocked(fetchRecentConversations).mockResolvedValue(messages as any);

    // Mock profile generation
    const generatedProfile =
      "You are a full-stack developer who loves TypeScript and prefers React for frontend development. You have a passion for coding and enjoy working with modern web technologies.";
    vi.mocked(generatePersonalityProfile).mockResolvedValue(generatedProfile);

    // Mock profile save
    vi.mocked(saveUserProfile).mockResolvedValue({
      id: "profile-1",
      user_id: testUserId,
      profile_data: { profile_text: generatedProfile },
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any);

    // Mock self-reference detection
    vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
    vi.mocked(getUserProfile).mockResolvedValue(null); // No existing profile

    // Mock streamText response
    vi.mocked(streamText).mockReturnValue({
      text: Promise.resolve(`Based on our conversations, ${generatedProfile}`),
      toUIMessageStreamResponse: () => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: {"type":"text","text":"Based on our conversations, ${generatedProfile}"}\n\n`
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
        response.headers.set("X-Conversation-Id", testConversation.id);
        return response;
      },
    } as any);

    // Step 1: User sends initial messages (already in mock data)
    // Step 2: User asks "Who am I"
    const request = createMockRequest({
      messages: [
        { role: "user", content: "I love coding in TypeScript" },
        { role: "assistant", content: "That's great! TypeScript is awesome." },
        { role: "user", content: "I work as a full-stack developer" },
        {
          role: "assistant",
          content: "Interesting! What's your favorite framework?",
        },
        { role: "user", content: "I prefer React for frontend development" },
        { role: "assistant", content: "React is a great choice!" },
        { role: "user", content: "Who am I?" },
      ],
      conversationId: testConversation.id,
    });

    const response = await POST(request);

    // Assertions
    expect(response.status).toBe(200);
    expect(isSelfReferenceQuery).toHaveBeenCalledWith(
      "Who am I?",
      expect.anything()
    );
    expect(fetchRecentConversations).toHaveBeenCalledWith(testUserId);
    expect(generatePersonalityProfile).toHaveBeenCalledWith(
      messages,
      expect.anything()
    );
    expect(saveUserProfile).toHaveBeenCalledWith(testUserId, {
      profile_text: generatedProfile,
    });
    expect(streamText).toHaveBeenCalled();
  });

  it("should use cached profile for subsequent 'Tell me about myself' query", async () => {
    addMockConversation(testConversation);

    // Existing profile in database
    const existingProfile = {
      id: "profile-1",
      user_id: testUserId,
      profile_data: {
        profile_text: "You are a developer who loves TypeScript and React.",
      },
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
    vi.mocked(getUserProfile).mockResolvedValue(existingProfile as any);

    vi.mocked(streamText).mockReturnValue({
      text: Promise.resolve(
        "Based on our conversations, you are a developer who loves TypeScript and React."
      ),
      toUIMessageStreamResponse: () => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"text","text":"Based on our conversations, you are a developer who loves TypeScript and React."}\n\n'
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
        response.headers.set("X-Conversation-Id", testConversation.id);
        return response;
      },
    } as any);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Tell me about myself" }],
      conversationId: testConversation.id,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(getUserProfile).toHaveBeenCalledWith(testUserId);
    expect(fetchRecentConversations).not.toHaveBeenCalled(); // Should not fetch if profile exists
    expect(generatePersonalityProfile).not.toHaveBeenCalled(); // Should not generate if profile exists
    expect(saveUserProfile).not.toHaveBeenCalled(); // Should not save if profile exists
  });

  it("should handle case with insufficient conversation history", async () => {
    addMockConversation(testConversation);

    // Only one message
    const singleMessage = createTestMessage(
      testConversation.id,
      "user",
      "Hello"
    );
    addMockMessage(singleMessage);

    vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
    vi.mocked(getUserProfile).mockResolvedValue(null);
    vi.mocked(fetchRecentConversations).mockResolvedValue([
      singleMessage,
    ] as any);

    vi.mocked(streamText).mockReturnValue({
      text: Promise.resolve(
        "I don't have enough conversation history yet to create a personality profile."
      ),
      toUIMessageStreamResponse: () => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"text","text":"I don\'t have enough conversation history yet to create a personality profile."}\n\n'
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
        response.headers.set("X-Conversation-Id", testConversation.id);
        return response;
      },
    } as any);

    const request = createMockRequest({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "Who am I?" },
      ],
      conversationId: testConversation.id,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(isSelfReferenceQuery).toHaveBeenCalled();
    expect(fetchRecentConversations).toHaveBeenCalled();
    // Should not generate profile with insufficient history
    expect(generatePersonalityProfile).not.toHaveBeenCalled();
  });
});
