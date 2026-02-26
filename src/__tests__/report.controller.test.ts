/**
 * @jest-environment node
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from "express";
import { getReport } from "../controllers/report.controller";
import { authorizeReportAccess } from "../middlewares/authorization.middleware";
import { AppError } from "../utils/AppError";

// create a manual mock for prisma client so its properties are jest functions
jest.mock("../utils/prismClient", () => {
  const m = {
    user: { findFirst: jest.fn() },
    report: { findUnique: jest.fn() },
    appointment: { findFirst: jest.fn() },
  };
  return { __esModule: true, default: m };
});

// import again so mocked object has correct shape
import prisma from "../utils/prismClient";
const mockedPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock };
  report: { findUnique: jest.Mock };
  appointment: { findFirst: jest.Mock };
};

function buildReq(user: any, params: any = {}) {
  return {
    params,
    body: {},
    user,
  } as unknown as Request;
}

function buildRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnThis() as any;
  res.json = jest.fn().mockReturnThis() as any;
  return res as Response;
}

function buildNext() {
  return jest.fn() as NextFunction;
}

// helper to simulate express behaviour: run auth middleware then controller
// if middleware forwards an error it will be passed to the original next.
async function handle(req: any, res: any, next: any) {
  let caughtError: any;
  const middlewareNext = (err?: any) => {
    if (err) {
      caughtError = err;
    }
    // mimic express: middleware calling next() means move on
  };

  await authorizeReportAccess(req, res, middlewareNext);

  if (caughtError) {
    return next(caughtError);
  }

  // no error -> call the controller
  await getReport(req, res, next);
}

describe("report authorization middleware", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    const req = buildReq(null, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(401);
  });

  it("returns 404 when report not found", async () => {
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(null as any);
    const user = { role: "PATIENT", patient: { id: "p1" } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(404);
  });

  it("forbids patient from viewing another patient's report", async () => {
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue({ id: "r1", patientId: "p2" } as any);
    const user = { role: "PATIENT", patient: { id: "p1" } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(403);
  });

  it("allows patient to view own report", async () => {
    const reportData = { id: "r1", patientId: "p1" } as any;
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(reportData);
    const user = { role: "PATIENT", patient: { id: "p1" } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: reportData });
  });

  it("forbids doctor with no relationship", async () => {
    const reportData = { id: "r1", patientId: "pX" } as any;
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(reportData);
    (mockedPrisma.appointment.findFirst as unknown as jest.Mock).mockResolvedValue(null as any);
    const user = { role: "DOCTOR", doctor: { id: "d1" } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { doctorId: "d1", patientId: "pX" },
      select: { id: true },
    });
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(403);
  });

  it("allows doctor with appointment", async () => {
    const reportData = { id: "r1", patientId: "pX" } as any;
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(reportData);
    (mockedPrisma.appointment.findFirst as unknown as jest.Mock).mockResolvedValue({ id: "a1" } as any);
    const user = { role: "DOCTOR", doctor: { id: "d1" } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: reportData });
  });

  it("forbids admin lacking permission", async () => {
    const reportData = { id: "r1", patientId: "pX" } as any;
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(reportData);
    const user = { role: "ADMIN", admin: { permissions: { canViewReports: false } } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(403);
  });

  it("allows admin with permission", async () => {
    const reportData = { id: "r1", patientId: "pX" } as any;
    (mockedPrisma.report.findUnique as unknown as jest.Mock).mockResolvedValue(reportData);
    const user = { role: "ADMIN", admin: { permissions: { canViewReports: true } } };
    const req = buildReq(user, { id: "r1" });
    const res = buildRes();
    const next = buildNext();

    await handle(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: reportData });
  });
});


describe("report.controller.getReport (post-authorization)", () => {
  it("simply echoes the report object that middleware attached", async () => {
    const req: any = { report: { id: "foo", patientId: "p1" } };
    const res = buildRes();
    const next = buildNext();
    await getReport(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: req.report });
  });
});
