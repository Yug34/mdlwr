import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  createTestConversation,
  createTestMessage,
  createTestProfile,
  type TestUser,
  type TestConversation,
  type TestMessage,
  type TestProfile,
} from "./test-helpers";

// Re-export helper functions for convenience
export {
  createTestUser,
  createTestConversation,
  createTestMessage,
  createTestProfile,
};

// In-memory storage for mocked data
let mockUsers: TestUser[] = [];
let mockConversations: TestConversation[] = [];
let mockMessages: TestMessage[] = [];
let mockProfiles: TestProfile[] = [];

/**
 * Reset all mock data
 */
export function resetMockData() {
  mockUsers = [];
  mockConversations = [];
  mockMessages = [];
  mockProfiles = [];
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient(): Partial<SupabaseClient> {
  const mockClient = {
    from: vi.fn((table: string) => {
      // Create chainable builder function for select queries
      const createChainableBuilder = (
        filters: Array<{ type: string; column: string; value: any }> = []
      ) => {
        const builder: any = {
          eq: vi.fn((column: string, value: any) => {
            return createChainableBuilder([
              ...filters,
              { type: "eq", column, value },
            ]);
          }),
          gte: vi.fn((column: string, value: any) => {
            return createChainableBuilder([
              ...filters,
              { type: "gte", column, value },
            ]);
          }),
          in: vi.fn((column: string, values: any[]) => {
            return createChainableBuilder([
              ...filters,
              { type: "in", column, value: values },
            ]);
          }),
          order: vi.fn((column: string, options?: { ascending?: boolean }) => {
            let filtered: any[] = [];

            if (table === "conversations") {
              filtered = [...mockConversations];
            } else if (table === "messages") {
              filtered = [...mockMessages];
            }

            // Apply filters
            for (const filter of filters) {
              if (filter.type === "eq") {
                filtered = filtered.filter(
                  (item) =>
                    item[filter.column as keyof typeof item] === filter.value
                );
              } else if (filter.type === "gte") {
                filtered = filtered.filter(
                  (item) =>
                    (item[filter.column as keyof typeof item] as string) >=
                    filter.value
                );
              } else if (filter.type === "in") {
                filtered = filtered.filter((item) =>
                  filter.value.includes(
                    item[filter.column as keyof typeof item]
                  )
                );
              }
            }

            // Sort
            filtered.sort((a, b) => {
              const aVal = a[column as keyof typeof a] as string;
              const bVal = b[column as keyof typeof b] as string;
              return options?.ascending === false
                ? bVal.localeCompare(aVal)
                : aVal.localeCompare(bVal);
            });

            const orderBuilder: any = {
              limit: vi.fn((limit: number) => {
                return Promise.resolve({
                  data: filtered.slice(0, limit),
                  error: null,
                });
              }),
              data: filtered,
              error: null,
            };
            return orderBuilder;
          }),
          limit: vi.fn((limit: number) => {
            let filtered: any[] = [];

            if (table === "conversations") {
              filtered = [...mockConversations];
            } else if (table === "messages") {
              filtered = [...mockMessages];
            }

            // Apply filters
            for (const filter of filters) {
              if (filter.type === "eq") {
                filtered = filtered.filter(
                  (item) =>
                    item[filter.column as keyof typeof item] === filter.value
                );
              } else if (filter.type === "gte") {
                filtered = filtered.filter(
                  (item) =>
                    (item[filter.column as keyof typeof item] as string) >=
                    filter.value
                );
              }
            }

            return Promise.resolve({
              data: filtered.slice(0, limit),
              error: null,
            });
          }),
          single: vi.fn(() => {
            let result: any = null;
            let filtered: any[] = [];

            if (table === "users") {
              filtered = [...mockUsers];
            } else if (table === "conversations") {
              filtered = [...mockConversations];
            } else if (table === "messages") {
              filtered = [...mockMessages];
            } else if (table === "user_profiles") {
              filtered = [...mockProfiles];
            }

            // Apply filters
            for (const filter of filters) {
              if (filter.type === "eq") {
                filtered = filtered.filter(
                  (item) =>
                    item[filter.column as keyof typeof item] === filter.value
                );
              } else if (filter.type === "gte") {
                filtered = filtered.filter(
                  (item) =>
                    (item[filter.column as keyof typeof item] as string) >=
                    filter.value
                );
              } else if (filter.type === "in") {
                filtered = filtered.filter((item) =>
                  filter.value.includes(
                    item[filter.column as keyof typeof item]
                  )
                );
              }
            }

            result = filtered[0] || null;
            return Promise.resolve({
              data: result || null,
              error: result ? null : { code: "PGRST116" },
            });
          }),
          data: [] as any[],
          error: null,
        };
        return builder;
      };

      const queryBuilder: any = {
        select: vi.fn(
          (columns?: string, options?: { count?: string; head?: boolean }) => {
            // Handle count queries (select("*", { count: "exact", head: true }))
            if (options?.head && options?.count) {
              const countBuilder = {
                eq: vi.fn((column: string, value: any) => {
                  const eqBuilder = {
                    eq: vi.fn((column2: string, value2: any) => {
                      let count = 0;
                      if (table === "messages") {
                        count = mockMessages.filter(
                          (m) =>
                            m[column as keyof TestMessage] === value &&
                            m[column2 as keyof TestMessage] === value2
                        ).length;
                      }
                      return Promise.resolve({ count, error: null });
                    }),
                  };
                  return eqBuilder;
                }),
              };
              return countBuilder;
            }

            // Regular select queries
            return createChainableBuilder();
          }
        ),
        insert: vi.fn((data: any) => {
          const insertBuilder = {
            select: vi.fn((columns?: string) => {
              const selectBuilder = {
                single: vi.fn(() => {
                  let newItem: any = null;
                  if (table === "users") {
                    newItem = createTestUser(
                      Array.isArray(data) ? data[0] : data
                    );
                    mockUsers.push(newItem);
                  } else if (table === "conversations") {
                    newItem = createTestConversation(
                      Array.isArray(data) ? data[0].user_id : data.user_id,
                      Array.isArray(data) ? data[0] : data
                    );
                    mockConversations.push(newItem);
                  } else if (table === "messages") {
                    newItem = createTestMessage(
                      Array.isArray(data)
                        ? data[0].conversation_id
                        : data.conversation_id,
                      Array.isArray(data) ? data[0].role : data.role,
                      Array.isArray(data) ? data[0].content : data.content,
                      Array.isArray(data) ? data[0] : data
                    );
                    mockMessages.push(newItem);
                  }
                  return Promise.resolve({ data: newItem, error: null });
                }),
              };
              return selectBuilder;
            }),
            data: null,
            error: null,
          };
          return insertBuilder;
        }),
        update: vi.fn((data: any) => {
          const updateBuilder = {
            eq: vi.fn((column: string, value: any) => {
              if (table === "conversations") {
                const conv = mockConversations.find(
                  (c) => c[column as keyof TestConversation] === value
                );
                if (conv) {
                  Object.assign(conv, data);
                }
              }
              return Promise.resolve({ data: null, error: null });
            }),
            data: null,
            error: null,
          };
          return updateBuilder;
        }),
        upsert: vi.fn((data: any) => {
          const upsertBuilder = {
            select: vi.fn((columns?: string) => {
              const selectBuilder = {
                single: vi.fn(() => {
                  if (table === "user_profiles") {
                    const profileData = Array.isArray(data) ? data[0] : data;
                    const existing = mockProfiles.find(
                      (p) => p.user_id === profileData.user_id
                    );
                    if (existing) {
                      Object.assign(existing, profileData);
                      return Promise.resolve({
                        data: existing,
                        error: null,
                      });
                    } else {
                      const newProfile = createTestProfile(
                        profileData.user_id,
                        profileData.profile_data.profile_text,
                        profileData
                      );
                      mockProfiles.push(newProfile);
                      return Promise.resolve({
                        data: newProfile,
                        error: null,
                      });
                    }
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
              };
              return selectBuilder;
            }),
            data: null,
            error: null,
          };
          return upsertBuilder;
        }),
      };
      return queryBuilder;
    }),
  };

  return mockClient as any;
}

/**
 * Mock OpenAI client - returns a function that when called with a model name returns a model object
 */
export function createMockOpenAIClient() {
  const mockClient = vi.fn((modelName: string) => {
    return {
      model: modelName,
    };
  });
  // Also add model properties for direct access
  (mockClient as any)["gpt-4.1"] = { model: "gpt-4.1" };
  (mockClient as any)["gpt-4o-mini"] = { model: "gpt-4o-mini" };
  return mockClient;
}

/**
 * Mock Kinde auth session
 */
export function createMockKindeSession(
  user: { id: string; email?: string | null } | null
) {
  return {
    getUser: vi.fn(() => Promise.resolve(user)),
  };
}

/**
 * Helper to add test data
 */
export function addMockUser(user: TestUser) {
  mockUsers.push(user);
}

export function addMockConversation(conversation: TestConversation) {
  mockConversations.push(conversation);
}

export function addMockMessage(message: TestMessage) {
  mockMessages.push(message);
}

export function addMockProfile(profile: TestProfile) {
  mockProfiles.push(profile);
}
