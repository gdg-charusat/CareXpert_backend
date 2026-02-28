/**
 * Custom Application Error Class
 * Extends Error with additional properties for HTTP status and operational errors
 */
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a Bad Request error (400)
   */
  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code);
  }

  /**
   * Create an Unauthorized error (401)
   */
  static unauthorized(message: string = 'Unauthorized', code?: string): AppError {
    return new AppError(message, 401, code);
  }

  /**
   * Create a Forbidden error (403)
   */
  static forbidden(message: string = 'Forbidden', code?: string): AppError {
    return new AppError(message, 403, code);
  }

  /**
   * Create a Not Found error (404)
   */
  static notFound(message: string = 'Resource not found', code?: string): AppError {
    return new AppError(message, 404, code);
  }

  /**
   * Create a Conflict error (409)
   */
  static conflict(message: string, code?: string): AppError {
    return new AppError(message, 409, code);
  }

  /**
   * Create a Too Many Requests error (429)
   */
  static tooManyRequests(message: string = 'Too many requests', code?: string): AppError {
    return new AppError(message, 429, code);
  }

  /**
   * Create an Internal Server Error (500)
   */
  static internal(message: string = 'Internal server error', code?: string): AppError {
    return new AppError(message, 500, code);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.code && { code: this.code }),
    };
  }
}

export default AppError;
