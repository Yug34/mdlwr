/**
 * Integration tests for GET /api/conversations/[conversationId]/messages
 *
 * These tests use a REAL database but mock ONLY external services:
 * - Kinde authentication
 *
 * This approach validates the full integration between the API and database layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/conversations/[conversationId]/messages/route";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Real database utilities
import {
  createTestUserInDb,
  createTestConversationInDb,
  createTestMessageInDb,
  cleanupTestData,
} from "../utils/test-db";

// Integration test setup - mocks only external services
import { createMockKindeSession } from "./setup";

// Import from setup to ensure mocks are initialized
import "./setup";

// Helper to create mock params
function createMockParams(params: Record<string, string>) {
  return Promise.resolve(params);
}

describe("GET /api/conversations/[conversationId]/messages - Integration Tests", () => {
  let testUser: { id: string; kinde_user_id: string; email: string };
  let testConversation: { id: string; user_id: string; title: string | null };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create real test data in the database
    testUser = await createTestUserInDb();
    testConversation = await createTestConversationInDb(testUser.id, {
      title: "Test Conversation",
    });

    // Setup Kinde auth mock
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession({
        id: testUser.kinde_user_id,
        email: testUser.email,
      }) as any
    );
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should return messages for valid conversation", async () => {
    // Create real messages in the database
    await createTestMessageInDb(testConversation.id, "user", "Hello");
    await createTestMessageInDb(testConversation.id, "assistant", "Hi there!");

    const request = new Request(
      `http://localhost:3000/api/conversations/${testConversation.id}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.length).toBe(2);
    expect(data.messages[0].content).toBe("Hello");
    expect(data.messages[1].content).toBe("Hi there!");
  });

  it("should order messages by created_at ascending", async () => {
    // Create messages with specific timestamps
    const now = Date.now();
    await createTestMessageInDb(testConversation.id, "user", "First");
    // Small delay to ensure ordering
    await new Promise((resolve) => setTimeout(resolve, 50));
    await createTestMessageInDb(testConversation.id, "assistant", "Second");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await createTestMessageInDb(testConversation.id, "user", "Third");

    const request = new Request(
      `http://localhost:3000/api/conversations/${testConversation.id}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.messages.length).toBe(3);
    expect(data.messages[0].content).toBe("First");
    expect(data.messages[1].content).toBe("Second");
    expect(data.messages[2].content).toBe("Third");
  });

  it("should format messages correctly with parts", async () => {
    await createTestMessageInDb(testConversation.id, "user", "Test message", {
      parts: [{ type: "text", text: "Test message" }],
    });

    const request = new Request(
      `http://localhost:3000/api/conversations/${testConversation.id}/messages`,
      { method: "GET" }
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
    expect(data.messages[0].role).toBe("user");
    expect(data.messages[0].content).toBe("Test message");
  });

  it("should reject access to other user's conversations", async () => {
    // Create another user with their own conversation
    const otherUser = await createTestUserInDb();
    const otherUserConv = await createTestConversationInDb(otherUser.id, {
      title: "Other User's Conversation",
    });
    await createTestMessageInDb(otherUserConv.id, "user", "Private message");

    const request = new Request(
      `http://localhost:3000/api/conversations/${otherUserConv.id}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: otherUserConv.id }),
    });

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 404 for non-existent conversation", async () => {
    const fakeConversationId = "00000000-0000-0000-0000-000000000000";

    const request = new Request(
      `http://localhost:3000/api/conversations/${fakeConversationId}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: fakeConversationId }),
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe("Conversation not found");
  });

  it("should return empty array for conversation with no messages", async () => {
    const request = new Request(
      `http://localhost:3000/api/conversations/${testConversation.id}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages).toEqual([]);
  });

  it("should handle unauthenticated requests", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );

    const request = new Request(
      `http://localhost:3000/api/conversations/${testConversation.id}/messages`,
      { method: "GET" }
    );

    const response = await GET(request, {
      params: createMockParams({ conversationId: testConversation.id }),
    });

    expect(response.status).toBe(401);
  });
});
