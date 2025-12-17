/**
 * Timeout utilities for handling request timeouts
 */

import { TimeoutError } from "@/lib/errors/app-errors";

// Timeout constants (in milliseconds)
export const TIMEOUT_CONFIG = {
  /** Timeout for OpenAI API calls (classification, profile generation) */
  OPENAI_API: 30000, // 30 seconds
  /** Timeout for database operations */
  DATABASE: 10000, // 10 seconds
  /** Timeout for streaming operations (longer due to response generation) */
  STREAMING: 55000, // 55 seconds (under maxDuration of 60s)
  /** Timeout for self-reference classification (quick operation) */
  CLASSIFICATION: 10000, // 10 seconds
} as const;

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name of the operation (for error messages)
 * @returns The resolved value of the promise
 * @throws TimeoutError if the operation exceeds the timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Creates an AbortController with automatic timeout
 * Useful for fetch requests that support AbortSignal
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with controller, signal, and cleanup function
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    controller,
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * Wraps a function that accepts an AbortSignal with timeout handling
 * @param fn - Function that accepts an AbortSignal and returns a promise
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name of the operation (for error messages)
 * @returns The resolved value of the function
 */
export async function withAbortTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const { signal, cleanup } = createTimeoutController(timeoutMs);

  try {
    const result = await fn(signal);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(operationName, timeoutMs, error);
    }
    throw error;
  } finally {
    cleanup();
  }
}
