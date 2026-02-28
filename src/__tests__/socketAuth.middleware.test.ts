/**
 * Tests for src/middlewares/socketAuth.middleware.ts (Issue #91)
 *
 * Verifies that every Socket.IO connection is authenticated via JWT before
 * any event handler is invoked, preventing user impersonation and message
 * injection attacks.
 */

import jwt from "jsonwebtoken";

// Mock Prisma before importing the middleware so the module can be loaded
// even when the generated Prisma client is not available (CI / test env).
jest.mock("../utils/prismClient", () => ({
  __esModule: true,
  default: { user: { findFirst: jest.fn() } },
}));

import {
  createSocketAuthMiddleware,
  AuthUser,
  FindUserFn,
} from "../middlewares/socketAuth.middleware";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECRET = "test-secret";

function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
}

/** Build a minimal Socket stub that the middleware can interact with. */
function makeSocket(options: {
  authToken?: string;
  headerToken?: string;
  cookieToken?: string;
}): any {
  return {
    handshake: {
      auth: options.authToken !== undefined ? { token: options.authToken } : {},
      headers: {
        ...(options.headerToken
          ? { authorization: `Bearer ${options.headerToken}` }
          : {}),
        ...(options.cookieToken
          ? { cookie: `accessToken=${options.cookieToken}` }
          : {}),
      },
    },
    data: {} as Record<string, unknown>,
  };
}

/** Wraps the middleware in a promise so tests can await it. */
function invokeMiddleware(
  middleware: ReturnType<typeof createSocketAuthMiddleware>,
  socket: any
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    middleware(socket, (err?: Error) => resolve(err));
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_USER: AuthUser = {
  id: "user-123",
  name: "Alice",
  role: "PATIENT",
  tokenVersion: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("socketAuth.middleware – createSocketAuthMiddleware()", () => {
  let findUser: jest.MockedFunction<FindUserFn>;
  let middleware: ReturnType<typeof createSocketAuthMiddleware>;

  beforeEach(() => {
    process.env.ACCESS_TOKEN_SECRET = SECRET;
    findUser = jest.fn();
    middleware = createSocketAuthMiddleware(findUser);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── 1. No token ─────────────────────────────────────────────────────────────
  it("calls next(Error) when no token is provided", async () => {
    const socket = makeSocket({});
    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/no token/i);
    expect(findUser).not.toHaveBeenCalled();
  });

  // ── 2. Invalid / expired token ──────────────────────────────────────────────
  it("calls next(Error) when the token signature is invalid", async () => {
    const socket = makeSocket({ authToken: "totally.invalid.token" });
    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/invalid or expired/i);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("calls next(Error) when the token is signed with the wrong secret", async () => {
    const badToken = jwt.sign({ userId: "user-123" }, "wrong-secret");
    const socket = makeSocket({ authToken: badToken });
    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/invalid or expired/i);
  });

  // ── 3. User not found ────────────────────────────────────────────────────────
  it("calls next(Error) when the user is not found in the database", async () => {
    findUser.mockResolvedValue(null);
    const token = signToken({ userId: "user-not-in-db", tokenVersion: 1 });
    const socket = makeSocket({ authToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/user not found/i);
    expect(findUser).toHaveBeenCalledWith("user-not-in-db");
  });

  // ── 4. Token version mismatch (revoked token) ────────────────────────────────
  it("calls next(Error) when tokenVersion in token does not match DB", async () => {
    findUser.mockResolvedValue({ ...VALID_USER, tokenVersion: 2 });
    const token = signToken({ userId: VALID_USER.id, tokenVersion: 1 }); // stale
    const socket = makeSocket({ authToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/token has been invalidated/i);
  });

  // ── 5. Happy path – auth token ───────────────────────────────────────────────
  it("calls next() without error and populates socket.data on valid auth token", async () => {
    findUser.mockResolvedValue(VALID_USER);
    const token = signToken({ userId: VALID_USER.id, tokenVersion: 1 });
    const socket = makeSocket({ authToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe(VALID_USER.id);
    expect(socket.data.name).toBe(VALID_USER.name);
    expect(socket.data.role).toBe(VALID_USER.role);
  });

  // ── 6. Happy path – Authorization header ────────────────────────────────────
  it("calls next() without error and populates socket.data using Authorization header", async () => {
    findUser.mockResolvedValue(VALID_USER);
    const token = signToken({ userId: VALID_USER.id, tokenVersion: 1 });
    const socket = makeSocket({ headerToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe(VALID_USER.id);
    expect(socket.data.name).toBe(VALID_USER.name);
    expect(socket.data.role).toBe(VALID_USER.role);
  });

  // ── 7. auth.token takes precedence over Authorization header ─────────────────
  it("prefers auth.token over Authorization header when both are present", async () => {
    const userA = { ...VALID_USER, id: "user-A" };
    const userB = { ...VALID_USER, id: "user-B" };

    // findUser returns the right user depending on which userId it receives
    findUser.mockImplementation(async (id) =>
      id === "user-A" ? userA : null
    );

    const tokenA = signToken({ userId: "user-A", tokenVersion: 1 });
    const tokenB = signToken({ userId: "user-B", tokenVersion: 1 });

    const socket = makeSocket({ authToken: tokenA, headerToken: tokenB });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe("user-A");
  });

  // ── 7b. httpOnly cookie (withCredentials: true from frontend) ────────────────
  it("accepts a valid accessToken sent as an httpOnly cookie", async () => {
    findUser.mockResolvedValue(VALID_USER);
    const token = signToken({ userId: VALID_USER.id, tokenVersion: 1 });
    const socket = makeSocket({ cookieToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe(VALID_USER.id);
    expect(socket.data.name).toBe(VALID_USER.name);
    expect(socket.data.role).toBe(VALID_USER.role);
  });

  // ── 8. Server error in findUser ───────────────────────────────────────────────
  it("calls next(Error) when findUser throws an unexpected error", async () => {
    findUser.mockRejectedValue(new Error("DB connection failed"));
    const token = signToken({ userId: VALID_USER.id, tokenVersion: 1 });
    const socket = makeSocket({ authToken: token });

    const err = await invokeMiddleware(middleware, socket);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/internal server error/i);
  });

  // ── 9. Token without tokenVersion still accepted if DB also has no version ────
  it("accepts a token with no tokenVersion when the DB also has no version constraint", async () => {
    const userWithoutVersion = { ...VALID_USER, tokenVersion: 0 };
    findUser.mockResolvedValue(userWithoutVersion);
    const token = signToken({ userId: VALID_USER.id }); // no tokenVersion field
    const socket = makeSocket({ authToken: token });

    const err = await invokeMiddleware(middleware, socket);

    // tokenVersion is undefined in the token so the check is skipped entirely
    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe(VALID_USER.id);
  });
});
