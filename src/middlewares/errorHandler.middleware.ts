import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { ApiError } from "../utils/ApiError"; // backwards-compat

const IS_PROD = process.env.NODE_ENV === "production";

// ─── Prisma error → HTTP status mapping ──────────────────────────────────────

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case "P2002": {
      const fields = (err.meta?.target as string[]) ?? ["field"];
      const appErr = new AppError(
        `A record with this ${fields.join(", ")} already exists.`,
        409,
        true
      );
      appErr.code = "P2002";
      return appErr;
    }
    case "P2025": {
      const appErr = new AppError("The requested record was not found.", 404, true);
      appErr.code = "P2025";
      return appErr;
    }

    case "P2003": {
      const appErr = new AppError(
        "Related record not found. Check the referenced ID.",
        400,
        true
      );
      appErr.code = "P2003";
      return appErr;
    }

    case "P2014": {
      const appErr = new AppError("Required relation is missing.", 400, true);
      appErr.code = "P2014";
      return appErr;
    }

    case "P2016": {
      const appErr = new AppError("Query interpretation error.", 400, true);
      appErr.code = "P2016";
      return appErr;
    }

    default: {
      const appErr = new AppError(
        IS_PROD ? "Database error." : `Prisma error ${err.code}: ${err.message}`,
        500,
        false
      );
      appErr.code = err.code;
      return appErr;
    }
  }
}

// ─── Shape of every error response ───────────────────────────────────────────
export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: any[];
  stack?: string; // only in development
}

// ─── Central error handler middleware ─────────────────────────────────────────
/**
 * Register this LAST in Express (after all routes).
 *
 * Express identifies a middleware as an error handler by its 4-argument signature.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ── 1. Normalise the error into an AppError ────────────────────────────────

  let appError: AppError;

  if (err instanceof AppError) {
    // Our own structured error
    appError = err;

  } else if (err instanceof ApiError) {
    appError = new AppError(err.message, err.statusCode, true, err.errors ?? []);

  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    appError = handlePrismaError(err);

  } else if (err instanceof Prisma.PrismaClientValidationError) {
    appError = new AppError("Invalid data supplied to the database.", 400);

  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    appError = new AppError("Database connection failed.", 503);

  } else if (
    typeof err === "object" &&
    err !== null &&
    (err as any).name === "MulterError"
  ) {
    const multerErr = err as any;
    const message =
      multerErr.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the maximum allowed size."
        : `File upload error: ${multerErr.message}`;
    appError = new AppError(message, 400);

  } else if (err instanceof SyntaxError && "body" in (err as any)) {
    appError = new AppError("Malformed JSON in request body.", 400);

  } else if (err instanceof Error) {
    appError = new AppError(
      IS_PROD ? "Internal server error." : err.message,
      500
    );

  } else {
    appError = new AppError("An unexpected error occurred.", 500);
  }

  // ── 2. Log non-operational (programmer) errors ─────────────────────────────
  if (!appError.isOperational) {
    console.error("UNHANDLED ERROR:", err);
  }

  // ── 3. Build and send the response ────────────────────────────────────────
  const body: ErrorResponse = {
    success: false,
    statusCode: appError.statusCode,
    message: appError.message,
  };

  if (appError.errors.length > 0) {
    body.errors = appError.errors;
  }

  if (!IS_PROD && appError.stack) {
    body.stack = appError.stack;
  }

  res.status(appError.statusCode).json(body);
};

// ── 4. 404 catch-all for unregistered routes ───────────────────────────────
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404));
};

// ── 5. asyncHandler – wraps async route handlers so thrown errors ──────────
//      are automatically forwarded to the error handler (no more try/catch boilerplate)
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
