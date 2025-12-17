import { createSupabaseClient } from "@/lib/supabase";
import { UserProfile } from "@/lib/types/database";

/**
 * Get user profile from database
 * @param userId - The Supabase user ID
 * @returns The user profile object, or null if not found
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const supabase = createSupabaseClient();

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No profile found - this is expected for new users
      return null;
    }
    console.error("Error fetching user profile:", error);
    return null;
  }

  return profile;
}

/**
 * Save or update user profile in database
 * @param userId - The Supabase user ID
 * @param profileData - The profile data to store (as JSONB)
 * @returns The saved profile object, or null if save failed
 */
export async function saveUserProfile(
  userId: string,
  profileData: { profile_text: string }
): Promise<UserProfile | null> {
  const supabase = createSupabaseClient();

  // Use upsert to handle both insert and update
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        profile_data: profileData,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving user profile:", error);
    return null;
  }

  return profile;
}
