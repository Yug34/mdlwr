/**
 * Authentication helper utilities
 */

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getOrCreateUser } from "@/lib/supabase/users";
import { AuthenticationError } from "@/lib/errors/app-errors";

export interface AuthenticatedUser {
  userId: string;
  kindeId: string;
  email?: string | null;
}

/**
 * Get the authenticated user from Kinde session and ensure they exist in Supabase
 * @throws {AuthenticationError} if user is not authenticated
 * @returns The authenticated user information
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const { getUser } = getKindeServerSession();
  const kindeUser = await getUser();

  if (!kindeUser?.id) {
    throw new AuthenticationError("Authentication required");
  }

  const userId = await getOrCreateUser(kindeUser);
  if (!userId) {
    throw new AuthenticationError("Failed to create or retrieve user");
  }

  return {
    userId,
    kindeId: kindeUser.id,
    email: kindeUser.email,
  };
}

/**
 * Get the authenticated user if available, or return null
 * Does not throw if user is not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
