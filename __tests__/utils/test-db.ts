/**
 * Test database utilities for integration tests.
 * Uses a real Supabase test instance instead of mocks.
 *
 * Environment variables required:
 * - TEST_SUPABASE_URL: URL of the test Supabase instance
 * - TEST_SUPABASE_SERVICE_KEY: Service role key for the test instance
 *
 * If not provided, falls back to main Supabase credentials (not recommended for production).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

let testClient: SupabaseClient | null = null;

// Track created test data for cleanup
const testDataIds = {
  users: new Set<string>(),
  conversations: new Set<string>(),
  messages: new Set<string>(),
  profiles: new Set<string>(),
};

/**
 * Get or create the test database client
 */
export function getTestDbClient(): SupabaseClient {
  if (testClient) {
    return testClient;
  }

  const supabaseUrl =
    process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.TEST_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing test database credentials. Set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY environment variables."
    );
  }

  testClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return testClient;
}

/**
 * Reset the test database client singleton (useful for test isolation)
 */
export function resetTestDbClient(): void {
  testClient = null;
}

/**
 * Create a test user in the database
 */
export async function createTestUserInDb(
  overrides?: Partial<{
    kinde_user_id: string;
    email: string;
  }>
): Promise<{ id: string; kinde_user_id: string; email: string }> {
  const client = getTestDbClient();
  const kindeUserId = overrides?.kinde_user_id ?? `kp_test_${nanoid()}`;
  const email = overrides?.email ?? `test_${nanoid()}@example.com`;

  const { data, error } = await client
    .from("users")
    .insert({
      kinde_user_id: kindeUserId,
      email,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  testDataIds.users.add(data.id);
  return data;
}

/**
 * Create a test conversation in the database
 */
export async function createTestConversationInDb(
  userId: string,
  overrides?: Partial<{
    title: string;
    metadata: Record<string, unknown>;
  }>
): Promise<{ id: string; user_id: string; title: string | null }> {
  const client = getTestDbClient();

  const { data, error } = await client
    .from("conversations")
    .insert({
      user_id: userId,
      title: overrides?.title ?? null,
      metadata: overrides?.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test conversation: ${error.message}`);
  }

  testDataIds.conversations.add(data.id);
  return data;
}

/**
 * Create a test message in the database
 */
export async function createTestMessageInDb(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  overrides?: Partial<{
    parts: Array<{ type: string; text: string }>;
    metadata: Record<string, unknown>;
  }>
): Promise<{
  id: string;
  conversation_id: string;
  role: string;
  content: string;
}> {
  const client = getTestDbClient();

  const { data, error } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      parts: overrides?.parts ?? [{ type: "text", text: content }],
      metadata: overrides?.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test message: ${error.message}`);
  }

  testDataIds.messages.add(data.id);
  return data;
}

/**
 * Create a test user profile in the database
 */
export async function createTestProfileInDb(
  userId: string,
  profileText: string
): Promise<{
  id: string;
  user_id: string;
  profile_data: { profile_text: string };
}> {
  const client = getTestDbClient();

  const { data, error } = await client
    .from("user_profiles")
    .upsert({
      user_id: userId,
      profile_data: { profile_text: profileText },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test profile: ${error.message}`);
  }

  testDataIds.profiles.add(data.id);
  return data;
}

/**
 * Clean up all test data created during tests.
 * Call this in afterEach or afterAll hooks.
 */
export async function cleanupTestData(): Promise<void> {
  const client = getTestDbClient();

  // Delete in reverse order of dependencies
  // Messages depend on conversations, conversations depend on users

  if (testDataIds.messages.size > 0) {
    await client
      .from("messages")
      .delete()
      .in("id", Array.from(testDataIds.messages));
    testDataIds.messages.clear();
  }

  if (testDataIds.profiles.size > 0) {
    await client
      .from("user_profiles")
      .delete()
      .in("id", Array.from(testDataIds.profiles));
    testDataIds.profiles.clear();
  }

  if (testDataIds.conversations.size > 0) {
    await client
      .from("conversations")
      .delete()
      .in("id", Array.from(testDataIds.conversations));
    testDataIds.conversations.clear();
  }

  if (testDataIds.users.size > 0) {
    await client.from("users").delete().in("id", Array.from(testDataIds.users));
    testDataIds.users.clear();
  }
}

/**
 * Get a conversation by ID from the test database
 */
export async function getConversationFromDb(
  conversationId: string
): Promise<{ id: string; user_id: string; title: string | null } | null> {
  const client = getTestDbClient();
  const { data, error } = await client
    .from("conversations")
    .select()
    .eq("id", conversationId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data;
}

/**
 * Get messages for a conversation from the test database
 */
export async function getMessagesFromDb(
  conversationId: string
): Promise<Array<{ id: string; role: string; content: string }>> {
  const client = getTestDbClient();
  const { data, error } = await client
    .from("messages")
    .select()
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get a user profile from the test database
 */
export async function getProfileFromDb(
  userId: string
): Promise<{
  id: string;
  user_id: string;
  profile_data: { profile_text: string };
} | null> {
  const client = getTestDbClient();
  const { data, error } = await client
    .from("user_profiles")
    .select()
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get profile: ${error.message}`);
  }

  return data;
}

/**
 * Track externally created data for cleanup
 */
export function trackForCleanup(
  table: "users" | "conversations" | "messages" | "profiles",
  id: string
): void {
  testDataIds[table].add(id);
}
