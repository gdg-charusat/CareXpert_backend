/**
 * @jest-environment node
 */

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import patientRoutes from "../Routes/patient.routes";

process.env.ACCESS_TOKEN_SECRET = "test-secret";

jest.mock("../utils/redis", () => ({
  __esModule: true,
  default: {
    isReady: false,
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("pdfkit", () => {
  return class MockPDFDocument {
    public page: { width: number; height: number; margins: { left: number; right: number; top: number; bottom: number } };
    private response: any;
    public x = 40;
    public y = 40;

    constructor() {
      this.page = {
        width: 420,
        height: 595,
        margins: { left: 40, right: 40, top: 40, bottom: 60 },
      };
    }

    pipe(res: any) {
      this.response = res;
      return res;
    }

    setHeader() {
      return this;
    }

    font() {
      return this;
    }

    fontSize() {
      return this;
    }

    fillColor() {
      return this;
    }

    text() {
      return this;
    }

    moveDown(lines: number = 1) {
      this.y += lines * 10;
      return this;
    }

    save() {
      return this;
    }

    strokeColor() {
      return this;
    }

    lineWidth() {
      return this;
    }

    moveTo() {
      return this;
    }

    lineTo() {
      return this;
    }

    stroke() {
      return this;
    }

    restore() {
      return this;
    }

    rect() {
      return this;
    }

    fillOpacity() {
      return this;
    }

    fill() {
      return this;
    }

    heightOfString(input: string) {
      return Math.max(20, Math.ceil(input.length / 20) * 10);
    }

    end() {
      if (this.response && !this.response.headersSent) {
        this.response.status(200);
      }
      if (this.response) {
        this.response.end();
      }
      return this;
    }
  };
});

jest.mock("../utils/prismClient", () => {
  const mocked = {
    user: { findFirst: jest.fn() },
    prescription: { findUnique: jest.fn() },
  };
  return { __esModule: true, default: mocked };
});

import prisma from "../utils/prismClient";

const mockedPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock };
  prescription: { findUnique: jest.Mock };
};

function signToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, process.env.ACCESS_TOKEN_SECRET as string);
}

describe("patient prescription PDF endpoint security", () => {
  const app = express();
  app.use("/api/patient", patientRoutes);

  const prescriptionId = "11111111-1111-4111-8111-111111111111";

  const prescriptionRecord = {
    id: prescriptionId,
    patientId: "p2",
    doctorId: "d1",
    dateIssued: new Date("2026-01-01T00:00:00.000Z"),
    prescriptionText: "Take medicine twice daily after meals",
    patient: {
      user: { name: "Patient Two", email: "patient2@example.com" },
    },
    doctor: {
      specialty: "General Medicine",
      clinicLocation: "City Clinic",
      user: { name: "Doctor One", email: "doctor1@example.com" },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app).get(`/api/patient/prescription-pdf/${prescriptionId}`);

    expect(res.status).toBe(401);
    expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated patient does not own prescription", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: "u-p1",
      name: "Patient One",
      email: "patient1@example.com",
      role: "PATIENT",
      tokenVersion: 0,
      patient: { id: "p1" },
      doctor: null,
      admin: null,
    });

    mockedPrisma.prescription.findUnique.mockResolvedValue(prescriptionRecord);

    const token = signToken("u-p1", 0);

    const res = await request(app)
      .get(`/api/patient/prescription-pdf/${prescriptionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("allows owning patient to access prescription PDF", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: "u-p2",
      name: "Patient Two",
      email: "patient2@example.com",
      role: "PATIENT",
      tokenVersion: 0,
      patient: { id: "p2" },
      doctor: null,
      admin: null,
    });

    mockedPrisma.prescription.findUnique.mockResolvedValue({
      ...prescriptionRecord,
      patientId: "p2",
    });

    const token = signToken("u-p2", 0);

    const res = await request(app)
      .get(`/api/patient/prescription-pdf/${prescriptionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("allows issuing doctor to access prescription PDF", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: "u-d1",
      name: "Doctor One",
      email: "doctor1@example.com",
      role: "DOCTOR",
      tokenVersion: 0,
      patient: null,
      doctor: { id: "d1" },
      admin: null,
    });

    mockedPrisma.prescription.findUnique.mockResolvedValue(prescriptionRecord);

    const token = signToken("u-d1", 0);

    const res = await request(app)
      .get(`/api/patient/prescription-pdf/${prescriptionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("allows admin to access prescription PDF", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: "u-a1",
      name: "Admin One",
      email: "admin@example.com",
      role: "ADMIN",
      tokenVersion: 0,
      patient: null,
      doctor: null,
      admin: { id: "a1", permissions: { canViewReports: true } },
    });

    mockedPrisma.prescription.findUnique.mockResolvedValue(prescriptionRecord);

    const token = signToken("u-a1", 0);

    const res = await request(app)
      .get(`/api/patient/prescription-pdf/${prescriptionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });
});
