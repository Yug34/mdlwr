/**
 * Standardized error handling for API routes
 */

import { NextResponse } from "next/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  TimeoutError,
} from "@/lib/errors/app-errors";
import { ApiErrorResponse } from "@/lib/types";

/**
 * Handle errors and return standardized API error responses
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Handle known application errors
  if (error instanceof AppError) {
    // Use user-friendly message for timeout errors
    const message =
      error instanceof TimeoutError
        ? "The request took too long to complete. Please try again."
        : error.message;

    return NextResponse.json(
      {
        error: message,
        ...(error instanceof AuthenticationError && {
          details: "Authentication required",
        }),
        ...(error instanceof AuthorizationError && {
          details: "Access denied",
        }),
        ...(error instanceof TimeoutError && {
          details: "Request timeout",
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
  defaultStatusCode: number = 500
): Response {
  // Use AppError's statusCode if available
  const statusCode =
    error instanceof AppError ? error.statusCode : defaultStatusCode;

  // Use user-friendly message for timeout errors
  let message: string;
  if (error instanceof TimeoutError) {
    message = "The request took too long to complete. Please try again.";
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = "Internal server error";
  }

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
