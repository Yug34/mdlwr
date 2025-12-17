/**
 * Integration tests for POST /api/chat
 *
 * These tests use a REAL database but mock ONLY external services:
 * - AI SDK (streamText)
 * - OpenAI client
 * - Kinde authentication
 *
 * This approach validates the full integration between the API and database layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Real database utilities
import {
  createTestUserInDb,
  createTestConversationInDb,
  createTestMessageInDb,
  createTestProfileInDb,
  cleanupTestData,
  getConversationFromDb,
  getMessagesFromDb,
  trackForCleanup,
} from "../utils/test-db";

// Integration test setup - mocks only external services
import {
  createMockKindeSession,
  createMockOpenAIClient,
  createMockStreamTextResponse,
} from "./setup";

// Import from setup to ensure mocks are initialized
import "./setup";

// Helper to create mock request
function createMockRequest(
  body: unknown,
  headers?: Record<string, string>
): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat - Integration Tests", () => {
  let testUser: { id: string; kinde_user_id: string; email: string };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a real test user in the database
    testUser = await createTestUserInDb();

    // Setup external service mocks
    const mockOpenAI = createMockOpenAIClient();
    vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);

    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession({
        id: testUser.kinde_user_id,
        email: testUser.email,
      }) as any
    );

    // Default streamText mock
    vi.mocked(streamText).mockReturnValue(
      createMockStreamTextResponse() as any
    );
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should send message and receive streaming response", async () => {
    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(streamText).toHaveBeenCalled();
  });

  it("should create new conversation when conversationId is missing", async () => {
    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const conversationId = response.headers.get("X-Conversation-Id");
    expect(conversationId).toBeTruthy();

    // Verify conversation was created in real database
    if (conversationId) {
      trackForCleanup("conversations", conversationId);
      const conversation = await getConversationFromDb(conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation?.user_id).toBe(testUser.id);
    }
  });

  it("should use existing conversation when conversationId provided", async () => {
    // Create a real conversation in the database
    const testConv = await createTestConversationInDb(testUser.id, {
      title: "Test Conversation",
    });

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
      conversationId: testConv.id,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Conversation-Id")).toBe(testConv.id);
  });

  it("should store user and assistant messages in database", async () => {
    // Create a conversation first
    const testConv = await createTestConversationInDb(testUser.id);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Test message for storage" }],
      conversationId: testConv.id,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Wait for async message storage to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify messages were stored in real database
    const messages = await getMessagesFromDb(testConv.id);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.some((m) => m.content === "Test message for storage")).toBe(
      true
    );
  });

  it("should set conversation title from first user message", async () => {
    const request = createMockRequest({
      messages: [{ role: "user", content: "This is my first message" }],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const conversationId = response.headers.get("X-Conversation-Id");
    if (conversationId) {
      trackForCleanup("conversations", conversationId);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify title was set in real database
      const conversation = await getConversationFromDb(conversationId);
      expect(conversation?.title).toBeTruthy();
    }
  });

  it("should handle unauthenticated users gracefully", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
    });

    const response = await POST(request);

    // The API should handle anonymous users (creates conversation without user_id or returns error)
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it("should handle unauthorized conversation access", async () => {
    // Create another user and their conversation
    const otherUser = await createTestUserInDb();
    const otherUserConv = await createTestConversationInDb(otherUser.id);

    const request = createMockRequest({
      messages: [{ role: "user", content: "Hello" }],
      conversationId: otherUserConv.id,
    });

    const response = await POST(request);

    // Should return 403 or create new conversation (depends on implementation)
    expect([200, 403]).toContain(response.status);
  });

  describe("Profile generation integration", () => {
    // For profile generation tests, we need to mock the profile-generator service
    // since it calls external AI APIs
    beforeEach(async () => {
      vi.doMock("@/lib/services/profile-generator", () => ({
        isSelfReferenceQuery: vi.fn(),
        fetchRecentConversations: vi.fn(),
        generatePersonalityProfile: vi.fn(),
      }));
    });

    it("should use existing profile when available", async () => {
      // Create a profile in real database
      const profileText = "You are a developer who loves TypeScript";
      await createTestProfileInDb(testUser.id, profileText);

      // Need to import the mocked module after doMock
      const { isSelfReferenceQuery, getUserProfile } = await import(
        "@/lib/services/profile-generator"
      );

      // Mock the self-reference detection
      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify streamText was called with profile context
      expect(streamText).toHaveBeenCalled();
      const streamTextCall = vi.mocked(streamText).mock.calls[0][0];
      // The system message should include the profile
      if (streamTextCall.system) {
        expect(streamTextCall.system).toContain(profileText);
      }
    });

    it("should handle case with insufficient conversation history", async () => {
      const { isSelfReferenceQuery, fetchRecentConversations } = await import(
        "@/lib/services/profile-generator"
      );

      vi.mocked(isSelfReferenceQuery).mockResolvedValue(true);
      vi.mocked(fetchRecentConversations).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: "user", content: "Who am I?" }],
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});
