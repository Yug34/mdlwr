/**
 * Custom application error classes
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 500, "DATABASE_ERROR");
  }
}

export class TimeoutError extends AppError {
  constructor(
    operation: string,
    timeoutMs: number,
    public readonly originalError?: unknown
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`, 504, "TIMEOUT_ERROR");
  }
}
