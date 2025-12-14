/**
 * Standardized error handling for API routes
 */

import { NextResponse } from "next/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/errors/app-errors";
import { ApiErrorResponse } from "@/lib/types";

/**
 * Handle errors and return standardized API error responses
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Handle known application errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error instanceof AuthenticationError && {
          details: "Authentication required",
        }),
        ...(error instanceof AuthorizationError && {
          details: "Access denied",
        }),
      },
      { status: error.statusCode }
    );
  }

  // Handle unknown errors
  if (error instanceof Error) {
    console.error("Unhandled error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }

  // Handle non-Error objects
  console.error("Unknown error type:", error);
  return NextResponse.json(
    {
      error: "Internal server error",
    },
    { status: 500 }
  );
}

/**
 * Create a standardized error response (for use in non-Next.js contexts)
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500
): Response {
  const message =
    error instanceof Error ? error.message : "Internal server error";
  const details =
    error instanceof AppError
      ? undefined
      : process.env.NODE_ENV === "development"
      ? String(error)
      : undefined;

  return new Response(
    JSON.stringify({
      error: message,
      ...(details && { details }),
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}
