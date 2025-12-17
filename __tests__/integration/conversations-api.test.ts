/**
 * Integration tests for POST/GET /api/conversations
 *
 * These tests use a REAL database but mock ONLY external services:
 * - Kinde authentication
 *
 * This approach validates the full integration between the API and database layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, GET } from "@/app/api/conversations/route";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Real database utilities
import {
  createTestUserInDb,
  createTestConversationInDb,
  cleanupTestData,
  getConversationFromDb,
  trackForCleanup,
} from "../utils/test-db";

// Integration test setup - mocks only external services
import { createMockKindeSession } from "./setup";

// Import from setup to ensure mocks are initialized
import "./setup";

describe("POST /api/conversations - Integration Tests", () => {
  let testUser: { id: string; kinde_user_id: string; email: string };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create real test user in the database
    testUser = await createTestUserInDb();

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

  it("should create new conversation for authenticated user", async () => {
    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversationId).toBeTruthy();
    expect(typeof data.conversationId).toBe("string");

    // Verify conversation was created in real database
    trackForCleanup("conversations", data.conversationId);
    const conversation = await getConversationFromDb(data.conversationId);
    expect(conversation).toBeTruthy();
    expect(conversation?.user_id).toBe(testUser.id);
  });

  it("should return conversation ID", async () => {
    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data).toHaveProperty("conversationId");
    expect(data.conversationId).toBeTruthy();

    // Track for cleanup
    trackForCleanup("conversations", data.conversationId);
  });

  it("should reject unauthenticated requests", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should create multiple conversations for same user", async () => {
    const request1 = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });
    const request2 = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.conversationId).not.toBe(data2.conversationId);

    // Track for cleanup
    trackForCleanup("conversations", data1.conversationId);
    trackForCleanup("conversations", data2.conversationId);
  });
});

describe("GET /api/conversations - Integration Tests", () => {
  let testUser: { id: string; kinde_user_id: string; email: string };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create real test user in the database
    testUser = await createTestUserInDb();

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

  it("should return user's conversations ordered by updated_at", async () => {
    // Create conversations with different timestamps
    const conv1 = await createTestConversationInDb(testUser.id, {
      title: "Conversation 1",
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 50));

    const conv2 = await createTestConversationInDb(testUser.id, {
      title: "Conversation 2",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations).toBeDefined();
    expect(Array.isArray(data.conversations)).toBe(true);
    expect(data.conversations.length).toBe(2);

    // Most recent should be first (descending order by updated_at)
    expect(data.conversations[0].id).toBe(conv2.id);
    expect(data.conversations[1].id).toBe(conv1.id);
  });

  it("should return empty array when no conversations", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations).toEqual([]);
  });

  it("should reject unauthenticated requests", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );

    const response = await GET();
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should not return other users' conversations", async () => {
    // Create another user with a conversation
    const otherUser = await createTestUserInDb();
    await createTestConversationInDb(otherUser.id, {
      title: "Other User's Conversation",
    });

    // Create a conversation for our test user
    await createTestConversationInDb(testUser.id, {
      title: "My Conversation",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations.length).toBe(1);
    expect(data.conversations[0].title).toBe("My Conversation");
  });

  it("should include conversation metadata", async () => {
    await createTestConversationInDb(testUser.id, {
      title: "Test Conversation",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations[0]).toHaveProperty("id");
    expect(data.conversations[0]).toHaveProperty("title");
    expect(data.conversations[0]).toHaveProperty("created_at");
    expect(data.conversations[0]).toHaveProperty("updated_at");
  });
});
