import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError, InternalError } from "../utils/AppError";

describe("AppError", () => {
  describe("constructor", () => {
    it("creates an operational error with correct properties", () => {
      const err = new AppError("Something went wrong", 400, true);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe("Something went wrong");
      expect(err.statusCode).toBe(400);
      expect(err.isOperational).toBe(true);
      expect(err.success).toBe(false);
      expect(err.errors).toEqual([]);
      expect(err.name).toBe("AppError");
      expect(err.stack).toBeDefined();
    });

    it("defaults to statusCode 500 and isOperational true", () => {
      const err = new AppError("Oops");
      expect(err.statusCode).toBe(500);
    });

    it("accepts extra errors array", () => {
      const details = [{ field: "email", message: "Invalid" }];
      const err = new AppError("Validation", 422, true, details);
      expect(err.errors).toEqual(details);
    });

    it("marks non-operational errors correctly", () => {
      const err = new AppError("DB crash", 500, false);
      expect(err.isOperational).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("returns a clean JSON envelope", () => {
      const err = new AppError("Not found", 404, true);
      expect(err.toJSON()).toEqual({
        success: false,
        statusCode: 404,
        message: "Not found",
      });
    });

    it("includes errors array when not empty", () => {
      const errors = [{ code: "ERR001" }];
      const err = new AppError("Bad input", 400, true, errors);
      expect(err.toJSON()).toMatchObject({ errors });
    });
  });

  describe("convenience sub-classes", () => {
    it("BadRequestError → 400", () => {
      const e = new BadRequestError();
      expect(e.statusCode).toBe(400);
      expect(e.isOperational).toBe(true);
    });

    it("UnauthorizedError → 401", () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
    });

    it("ForbiddenError → 403", () => {
      expect(new ForbiddenError().statusCode).toBe(403);
    });

    it("NotFoundError → 404", () => {
      expect(new NotFoundError().statusCode).toBe(404);
    });

    it("ConflictError → 409", () => {
      expect(new ConflictError().statusCode).toBe(409);
    });

    it("ValidationError → 422", () => {
      expect(new ValidationError().statusCode).toBe(422);
    });

    it("InternalError → 500 and non-operational", () => {
      const e = new InternalError();
      expect(e.statusCode).toBe(500);
      expect(e.isOperational).toBe(false);
    });
  });
});
