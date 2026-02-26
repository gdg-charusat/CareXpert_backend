/**
 * Integration tests for the centralized error handler middleware.
 *
 * We build a minimal Express app that deliberately throws various error types
 * so we can assert that the middleware serialises them correctly.
 */
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { AppError, NotFoundError, ValidationError } from "../utils/AppError";
import { ApiError } from "../utils/ApiError"; // legacy compat
import { errorHandler, notFoundHandler } from "../middlewares/errorHandler.middleware";

// ── Build a lightweight test app ─────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());

  // Routes that intentionally throw errors
  app.get("/throw/app-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError("Custom app error", 422, true));
  });

  app.get("/throw/not-found-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError("User not found"));
  });

  app.get("/throw/validation-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new ValidationError("Invalid input", [{ field: "email" }]));
  });

  app.get("/throw/legacy-api-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new ApiError(409, "Duplicate entry"));
  });

  app.get("/throw/generic-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error("Something blew up"));
  });

  app.get("/throw/non-error", (_req: Request, _res: Response, next: NextFunction) => {
    next("just a string");
  });

  app.get("/throw/syntax-error", (req: Request, _res: Response, next: NextFunction) => {
    // Simulate a malformed JSON body parse error
    const syntaxErr = new SyntaxError("Unexpected token") as any;
    syntaxErr.body = {};
    next(syntaxErr);
  });

  app.get("/throw/multer-error", (_req: Request, _res: Response, next: NextFunction) => {
    const multerErr: any = new Error("File too large");
    multerErr.name = "MulterError";
    multerErr.code = "LIMIT_FILE_SIZE";
    next(multerErr);
  });

  app.get("/ok", (_req: Request, res: Response) => {
    res.json({ success: true, data: "pong" });
  });

  // 404 + central error handler (order matters)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = buildApp();

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("errorHandler middleware (integration)", () => {
  describe("AppError", () => {
    it("returns the correct status and JSON envelope", async () => {
      const res = await request(app).get("/throw/app-error");

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 422,
        message: "Custom app error",
      });
    });
  });

  describe("NotFoundError", () => {
    it("returns 404 with message", async () => {
      const res = await request(app).get("/throw/not-found-error");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
      expect(res.body.success).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("returns 422 and includes errors array", async () => {
      const res = await request(app).get("/throw/validation-error");

      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual([{ field: "email" }]);
    });
  });

  describe("legacy ApiError (backward-compat)", () => {
    it("maps legacy ApiError to the same envelope shape", async () => {
      const res = await request(app).get("/throw/legacy-api-error");

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 409,
        message: "Duplicate entry",
      });
    });
  });

  describe("generic Error", () => {
    it("returns 500 in development with message", async () => {
      // Tests run with NODE_ENV = test (not 'production') so message is shown
      const res = await request(app).get("/throw/generic-error");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("non-Error objects", () => {
    it("returns 500 for string errors", async () => {
      const res = await request(app).get("/throw/non-error");
      expect(res.status).toBe(500);
    });
  });

  describe("SyntaxError (malformed JSON body)", () => {
    it("maps to 400 Bad Request", async () => {
      const res = await request(app).get("/throw/syntax-error");
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/malformed json/i);
    });
  });

  describe("MulterError", () => {
    it("returns 400 for LIMIT_FILE_SIZE", async () => {
      const res = await request(app).get("/throw/multer-error");
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/maximum allowed size/i);
    });
  });

  describe("notFoundHandler (unregistered routes)", () => {
    it("returns 404 for unknown paths", async () => {
      const res = await request(app).get("/this/route/does/not/exist");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe("happy path", () => {
    it("does not intercept successful responses", async () => {
      const res = await request(app).get("/ok");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
