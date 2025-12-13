import { createSupabaseClient } from "@/lib/supabase";

/**
 * Get or create a user in Supabase based on Kinde user ID
 * @param kindeUser - The Kinde user object from getKindeServerSession().getUser()
 * @returns The Supabase user ID, or null if user creation failed
 */
export async function getOrCreateUser(
  kindeUser: { id: string; email?: string | null } | null
): Promise<string | null> {
  if (!kindeUser?.id) {
    console.error("No Kinde user ID provided");
    return null;
  }

  const supabase = createSupabaseClient();

  // First, try to find existing user
  const { data: existingUser, error: findError } = await supabase
    .from("users")
    .select("id")
    .eq("kinde_user_id", kindeUser.id)
    .single();

  if (existingUser) {
    console.log("Found existing user:", existingUser.id);
    return existingUser.id;
  }

  // If user doesn't exist, create one
  if (findError && findError.code === "PGRST116") {
    // PGRST116 means no rows returned (user doesn't exist)
    console.log(
      "User not found, creating new user for kinde_user_id:",
      kindeUser.id
    );

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        kinde_user_id: kindeUser.id,
        email: kindeUser.email || null,
      })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      return null;
    }

    console.log("Created new user:", newUser.id);
    return newUser.id;
  }

  // Some other error occurred
  console.error("Error finding user:", findError);
  return null;
}

/**
 * Get user by Supabase user ID
 * @param userId - The Supabase user ID
 * @returns The user object, or null if not found
 */
export async function getUserById(userId: string) {
  const supabase = createSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }

  return user;
}
