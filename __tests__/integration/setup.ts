/**
 * Integration test setup.
 *
 * This file configures the test environment for integration tests.
 * Integration tests use a REAL database but mock EXTERNAL SERVICES only:
 * - AI SDK (streamText, etc.)
 * - OpenAI client
 * - Kinde authentication
 *
 * The database operations are performed against a real test Supabase instance.
 */

import { vi, beforeAll, afterAll, afterEach } from "vitest";
import { cleanupTestData, resetTestDbClient } from "../utils/test-db";

// Set up test environment variables for the real test database
// These should be set in your CI environment or local .env.test file
// Falls back to the main Supabase credentials if test-specific ones aren't set
beforeAll(() => {
  // Ensure we have database credentials
  if (!process.env.TEST_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn(
      "⚠️  No test database configured. Set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY for proper integration testing."
    );
  }

  // Use test credentials if available, otherwise fall back to main credentials
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.TEST_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Keep the OpenAI key as a mock value - we don't want to hit the real API
  process.env.OPENAI_API_KEY = "test-openai-key";
});

// Clean up test data after each test
afterEach(async () => {
  await cleanupTestData();
  vi.clearAllMocks();
});

// Reset the database client after all tests
afterAll(() => {
  resetTestDbClient();
});

// ============================================================================
// Mock ONLY external services (not database)
// ============================================================================

// Mock AI SDK - external service
vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

// Mock OpenAI client - external service
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

// Mock Kinde auth - external service
vi.mock("@kinde-oss/kinde-auth-nextjs/server", () => ({
  getKindeServerSession: vi.fn(),
}));

// ============================================================================
// Helper to create mock Kinde session
// ============================================================================
export function createMockKindeSession(
  user: { id: string; email?: string | null } | null
) {
  return {
    getUser: vi.fn(() => Promise.resolve(user)),
  };
}

// ============================================================================
// Helper to create mock OpenAI client
// ============================================================================
export function createMockOpenAIClient() {
  const mockClient = vi.fn((modelName: string) => ({
    model: modelName,
  }));
  (mockClient as any)["gpt-4.1"] = { model: "gpt-4.1" };
  (mockClient as any)["gpt-4o-mini"] = { model: "gpt-4o-mini" };
  return mockClient;
}

// ============================================================================
// Helper to create mock streamText response
// ============================================================================
export function createMockStreamTextResponse(
  responseText: string = "Mock assistant response"
) {
  return {
    text: Promise.resolve(responseText),
    toUIMessageStreamResponse: () => {
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: {"type":"text","text":"${responseText}"}\n\n`
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
  };
}
