import { nanoid } from "nanoid";

export interface TestUser {
  id: string;
  kinde_user_id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
}

export interface TestMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: any;
  created_at: string;
  metadata: any;
}

export interface TestProfile {
  id: string;
  user_id: string;
  profile_data: {
    profile_text: string;
  };
  last_updated: string;
  created_at: string;
}

/**
 * Create a test user
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: nanoid(),
    kinde_user_id: `kinde_${nanoid()}`,
    email: `test${nanoid()}@example.com`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test conversation
 */
export function createTestConversation(
  userId: string,
  overrides?: Partial<TestConversation>
): TestConversation {
  return {
    id: nanoid(),
    user_id: userId,
    title: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: null,
    ...overrides,
  };
}

/**
 * Create a test message
 */
export function createTestMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  overrides?: Partial<TestMessage>
): TestMessage {
  return {
    id: nanoid(),
    conversation_id: conversationId,
    role,
    content,
    parts: [{ type: "text", text: content }],
    created_at: new Date().toISOString(),
    metadata: null,
    ...overrides,
  };
}

/**
 * Create a test profile
 */
export function createTestProfile(
  userId: string,
  profileText: string,
  overrides?: Partial<TestProfile>
): TestProfile {
  return {
    id: nanoid(),
    user_id: userId,
    profile_data: {
      profile_text: profileText,
    },
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock request for API testing
 */
export function createMockRequest(
  body: any,
  headers?: Record<string, string>
): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Create a mock Next.js route params
 */
export function createMockParams(params: Record<string, string>) {
  return Promise.resolve(params);
}
