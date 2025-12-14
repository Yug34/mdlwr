import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateUser } from "@/lib/supabase/users";
import { createSupabaseClient } from "@/lib/supabase";
import {
  createMockSupabaseClient,
  resetMockData,
  addMockUser,
} from "../utils/mocks";
import { createTestUser as createUser } from "../utils/test-helpers";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("users", () => {
  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();
  });

  describe("getOrCreateUser", () => {
    it("should return existing user ID", async () => {
      const kindeUser = { id: "kinde_123", email: "test@example.com" };
      const existingUser = createUser({ kinde_user_id: "kinde_123" });
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      addMockUser(existingUser);

      const result = await getOrCreateUser(kindeUser);
      expect(result).toBe(existingUser.id);
    });

    it("should create new user when doesn't exist", async () => {
      const kindeUser = { id: "kinde_new", email: "new@example.com" };
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const result = await getOrCreateUser(kindeUser);
      expect(result).not.toBeNull();
      expect(typeof result).toBe("string");
    });

    it("should handle errors gracefully", async () => {
      const kindeUser = null;
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const result = await getOrCreateUser(kindeUser);
      expect(result).toBeNull();
    });

    it("should handle missing kinde user ID", async () => {
      const kindeUser = { id: "", email: "test@example.com" };
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const result = await getOrCreateUser(kindeUser);
      expect(result).toBeNull();
    });
  });
});
