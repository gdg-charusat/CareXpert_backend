/**
 * AppError – the single source of truth for operational (user-facing) errors.
 *
 * Usage:
 *   throw new AppError("Doctor not found", 404);
 *   throw new AppError("Email already in use", 409, true, [{ field: "email" }]);
 *
 * `isOperational = true`  → known, expected errors (4xx, business logic failures)
 * `isOperational = false` → programmer errors / bugs (should never reach prod users)
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors: any[];
  public readonly success: false = false;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors: any[] = []
  ) {
    super(message);

    // Restore prototype chain (needed when targeting ES5-compiled JS)
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false as const,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.errors.length > 0 ? { errors: this.errors } : {}),
    };
  }
}

// ── Convenience sub-classes ───────────────────────────────────────────────────

/** 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors: any[] = []) {
    super(message, 400, true, errors);
  }
}

/** 401 Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, true);
  }
}

/** 403 Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, true);
  }
}

/** 404 Not Found */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, true);
  }
}

/** 409 Conflict */
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, true);
  }
}

/** 422 Unprocessable Entity – validation failures */
export class ValidationError extends AppError {
  constructor(message = "Validation failed", errors: any[] = []) {
    super(message, 422, true, errors);
  }
}

/** 500 Internal Server Error – non-operational (programmer bugs) */
export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, false);
  }
}
