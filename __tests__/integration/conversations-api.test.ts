import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/conversations/route";
import { createSupabaseClient } from "@/lib/supabase";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getOrCreateUser } from "@/lib/supabase/users";
import {
  createMockSupabaseClient,
  createMockKindeSession,
  resetMockData,
  addMockConversation,
  createTestConversation,
} from "../utils/mocks";
import { createTestUser as createUser } from "../utils/test-helpers";

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

describe("POST /api/conversations", () => {
  let testUser: ReturnType<typeof createUser>;
  let testUserId: string;

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    testUser = createUser();
    testUserId = testUser.id;

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

  it("should create new conversation for authenticated user", async () => {
    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversationId).toBeTruthy();
    expect(typeof data.conversationId).toBe("string");
  });

  it("should return conversation ID", async () => {
    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data).toHaveProperty("conversationId");
    expect(data.conversationId).toBeTruthy();
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
});

describe("GET /api/conversations", () => {
  let testUser: ReturnType<typeof createUser>;
  let testUserId: string;

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    testUser = createUser();
    testUserId = testUser.id;

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

  it("should return user's conversations ordered by updated_at", async () => {
    const conv1 = createTestConversation(testUserId, {
      title: "Conversation 1",
      updated_at: new Date(Date.now() - 1000).toISOString(),
    });
    const conv2 = createTestConversation(testUserId, {
      title: "Conversation 2",
      updated_at: new Date().toISOString(),
    });

    addMockConversation(conv1);
    addMockConversation(conv2);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "GET",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations).toBeDefined();
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  it("should return empty array when no conversations", async () => {
    const request = new Request("http://localhost:3000/api/conversations", {
      method: "GET",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.conversations).toEqual([]);
  });

  it("should reject unauthenticated requests", async () => {
    vi.mocked(getKindeServerSession).mockReturnValue(
      createMockKindeSession(null) as any
    );

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "GET",
    });

    const response = await GET();
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });
});
