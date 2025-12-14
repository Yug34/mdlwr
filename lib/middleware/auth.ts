/**
 * Authentication middleware for API routes
 *
 * Note: Next.js App Router doesn't support traditional middleware wrappers
 * for route handlers. This file provides helper functions that can be called
 * at the start of route handlers to enforce authentication.
 */

import { requireAuth, AuthenticatedUser } from "@/lib/api/auth-helpers";
import { handleApiError } from "@/lib/api/error-handler";
import { NextResponse } from "next/server";

/**
 * Middleware function to wrap route handlers that require authentication
 * Returns the authenticated user if successful, or null if authentication fails
 *
 * Usage in route handler:
 * ```ts
 * const authResult = await withAuth(async (user) => {
 *   // Your route logic here
 *   // user is guaranteed to be authenticated
 * });
 * if (authResult instanceof NextResponse) {
 *   return authResult; // Error response
 * }
 * ```
 */
export async function withAuth<T>(
  handler: (user: AuthenticatedUser) => Promise<T>
): Promise<T | NextResponse> {
  try {
    const user = await requireAuth();
    return await handler(user);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Simple wrapper that ensures authentication and returns user
 * Returns error response if authentication fails
 */
export async function ensureAuth(): Promise<
  { user: AuthenticatedUser } | NextResponse
> {
  try {
    const user = await requireAuth();
    return { user };
  } catch (error) {
    return handleApiError(error);
  }
}
