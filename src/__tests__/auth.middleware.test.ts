import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { isAuthenticated } from "../middlewares/auth.middleware";

// ensure middleware uses known secret for test tokens
process.env.ACCESS_TOKEN_SECRET = "test-secret";

jest.mock("../utils/prismClient", () => {
  const m = {
    user: { findFirst: jest.fn() },
  };
  return { __esModule: true, default: m };
});
// re-import to satisfy typing
import prisma from "../utils/prismClient";
const mockedPrisma = prisma as unknown as { user: { findFirst: jest.Mock } };

// helper to sign tokens
function makeToken(userId: string, version = 0) {
  return jwt.sign({ userId, tokenVersion: version }, "test-secret");
}

describe("auth.middleware", () => {
  let app: express.Express;
  beforeEach(() => {
    jest.resetAllMocks();
    app = express();
    app.use(isAuthenticated);
    // simple route to echo req.user
    app.get("/whoami", (req: any, res) => res.json({ user: req.user }));
  });

  it("should populate user object including admin permissions", async () => {
    const fakeUser = {
      id: "u1",
      name: "Alice",
      email: "alice@example.com",
      role: "ADMIN",
      tokenVersion: 0,
      patient: null,
      doctor: null,
      admin: {
        id: "a1",
        permissions: { canViewReports: true },
      },
    };
    (mockedPrisma.user.findFirst as unknown as jest.Mock).mockResolvedValue(fakeUser as any);

    const token = makeToken("u1");
    const res = await request(app)
      .get("/whoami")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: "u1",
      role: "ADMIN",
      admin: { id: "a1", permissions: { canViewReports: true } },
    });
  });
});
