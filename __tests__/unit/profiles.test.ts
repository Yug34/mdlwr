import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserProfile, saveUserProfile } from "@/lib/supabase/profiles";
import { createSupabaseClient } from "@/lib/supabase";
import {
  createMockSupabaseClient,
  resetMockData,
  addMockProfile,
  createTestProfile,
} from "../utils/mocks";
import {
  createTestUser,
  createTestProfile as createProfile,
} from "../utils/test-helpers";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("profiles", () => {
  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("should return profile when exists", async () => {
      const testUser = createTestUser();
      const testProfile = createProfile(testUser.id, "This is a test profile");
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      addMockProfile(testProfile);

      const result = await getUserProfile(testUser.id);
      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUser.id);
      expect(result?.profile_data.profile_text).toBe("This is a test profile");
    });

    it("should return null when profile doesn't exist", async () => {
      const testUser = createTestUser();
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const result = await getUserProfile(testUser.id);
      expect(result).toBeNull();
    });
  });

  describe("saveUserProfile", () => {
    it("should create new profile", async () => {
      const testUser = createTestUser();
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const profileData = {
        profile_text: "New profile text",
      };

      const result = await saveUserProfile(testUser.id, profileData);
      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUser.id);
      expect(result?.profile_data.profile_text).toBe("New profile text");
    });

    it("should update existing profile (upsert)", async () => {
      const testUser = createTestUser();
      const existingProfile = createProfile(testUser.id, "Old profile");
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      addMockProfile(existingProfile);

      const profileData = {
        profile_text: "Updated profile text",
      };

      const result = await saveUserProfile(testUser.id, profileData);
      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUser.id);
      expect(result?.profile_data.profile_text).toBe("Updated profile text");
    });
  });
});
