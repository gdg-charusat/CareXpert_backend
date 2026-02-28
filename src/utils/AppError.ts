/**
 * Custom Application Error Class
 * Extends Error with additional properties for HTTP status and operational errors
 */
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  success: boolean;
  code?: string;
  errors: any[];

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, errors: any[] = []) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.success = false;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a Bad Request error (400)
   */
  static badRequest(message: string, code?: string): AppError {
    const err = new AppError(message, 400, true);
    err.code = code;
    return err;
  }

  /**
   * Create an Unauthorized error (401)
   */
  static unauthorized(message: string = 'Unauthorized', code?: string): AppError {
    const err = new AppError(message, 401, true);
    err.code = code;
    return err;
  }

  /**
   * Create a Forbidden error (403)
   */
  static forbidden(message: string = 'Forbidden', code?: string): AppError {
    const err = new AppError(message, 403, true);
    err.code = code;
    return err;
  }

  /**
   * Create a Not Found error (404)
   */
  static notFound(message: string = 'Resource not found', code?: string): AppError {
    const err = new AppError(message, 404, true);
    err.code = code;
    return err;
  }

  /**
   * Create a Conflict error (409)
   */
  static conflict(message: string, code?: string): AppError {
    const err = new AppError(message, 409, true);
    err.code = code;
    return err;
  }

  /**
   * Create a Too Many Requests error (429)
   */
  static tooManyRequests(message: string = 'Too many requests', code?: string): AppError {
    const err = new AppError(message, 429, true);
    err.code = code;
    return err;
  }

  /**
   * Create an Internal Server Error (500)
   */
  static internal(message: string = 'Internal server error', code?: string): AppError {
    const err = new AppError(message, 500, false);
    err.code = code;
    return err;
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.errors.length > 0 && { errors: this.errors }),
    };
  }
}

// ─── Convenience Error Subclasses ───────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', errors: any[] = []) {
    super(message, 400, true, errors);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', errors: any[] = []) {
    super(message, 401, true, errors);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', errors: any[] = []) {
    super(message, 403, true, errors);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', errors: any[] = []) {
    super(message, 404, true, errors);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', errors: any[] = []) {
    super(message, 409, true, errors);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error', errors: any[] = []) {
    super(message, 422, true, errors);
    this.name = 'ValidationError';
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal Server Error', errors: any[] = []) {
    super(message, 500, false, errors);
    this.name = 'InternalError';
  }
}

export default AppError;
