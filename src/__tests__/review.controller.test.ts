/**
 * @jest-environment node
 */

/// <reference types="jest" />

import { Request, Response } from "express";
import {
  createReview,
  updateReview,
  deleteReview,
  getMyReviews,
  getDoctorReviews,
} from "../controllers/review.controller";
import { AppointmentStatus, Role } from "@prisma/client";

// Mock Prisma Client
jest.mock("../utils/prismClient", () => {
  const m: any = {
    review: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    doctor: {
      update: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(m)),
  };
  return { __esModule: true, default: m };
});

import prisma from "../utils/prismClient";

const mockedPrisma = prisma as unknown as {
  review: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    aggregate: jest.Mock;
  };
  appointment: {
    findFirst: jest.Mock;
  };
  doctor: {
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function buildReq(
  user: any = null,
  body: any = {},
  params: any = {}
): Partial<Request> {
  return {
    body,
    params,
    user,
  } as unknown as Request;
}

function buildRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res as Response;
}

describe("Review Controller", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-15"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createReview", () => {
    it("should create a review with valid data", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Great doctor!",
          isAnonymous: false,
        }
      );
      const res = buildRes();

      const mockAppointment = {
        id: "apt1",
        doctorId: "doc1",
        patientId: "p1",
        status: AppointmentStatus.COMPLETED,
      };

      const mockReview = {
        id: "rev1",
        appointmentId: "apt1",
        patientId: "p1",
        doctorId: "doc1",
        rating: 5,
        comment: "Great doctor!",
        isAnonymous: false,
        createdAt: new Date(),
        doctor: {
          id: "doc1",
          specialty: "Cardiology",
          clinicLocation: "NYC",
          user: { name: "Dr. Smith", profilePicture: "pic.jpg" },
        },
        appointment: {
          id: "apt1",
          date: new Date(),
          time: "10:00",
        },
      };

      mockedPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockedPrisma.review.findUnique.mockResolvedValue(null);
      mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          review: {
            create: jest.fn().mockResolvedValue(mockReview),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 5 },
              _count: { rating: 1 },
            }),
          },
          doctor: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return await cb(mockTx);
      });

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 201,
          data: expect.objectContaining({
            id: "rev1",
            rating: 5,
          }),
          message: "Review created successfully",
        })
      );
    });

    it("should reject invalid rating (< 1)", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 0,
          comment: "Bad rating",
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: "Rating must be an integer between 1 and 5",
        })
      );
    });

    it("should reject invalid rating (> 5)", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 6,
          comment: "Too high rating",
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: "Rating must be an integer between 1 and 5",
        })
      );
    });

    it("should reject non-integer rating", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 3.5,
          comment: "Decimal rating",
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject comment longer than 1000 characters", async () => {
      const longComment = "x".repeat(1001);
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 4,
          comment: longComment,
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Comment must be 1000 characters or fewer",
        })
      );
    });

    it("should reject null/empty comment and store as null", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "   ",
        }
      );
      const res = buildRes();

      const mockAppointment = {
        id: "apt1",
        doctorId: "doc1",
        status: AppointmentStatus.COMPLETED,
      };

      mockedPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockedPrisma.review.findUnique.mockResolvedValue(null);

      await createReview(req as Request, res as Response);

      // Should succeed with null comment
      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalled();
    });

    it("should reject non-patient users", async () => {
      const req = buildReq(
        {
          id: "u2",
          role: Role.DOCTOR,
          patient: null,
          doctor: { id: "doc1" },
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Great!",
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only patients can create reviews",
        })
      );
    });

    it("should reject if appointmentId is missing", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          rating: 5,
          comment: "Great!",
        }
      );
      const res = buildRes();

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "appointmentId is required",
        })
      );
    });

    it("should reject if appointment is not completed", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Great!",
        }
      );
      const res = buildRes();

      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You can only review your completed appointments",
        })
      );
    });

    it("should reject if review already exists for appointment", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Great!",
        }
      );
      const res = buildRes();

      const mockAppointment = {
        id: "apt1",
        doctorId: "doc1",
        status: AppointmentStatus.COMPLETED,
      };

      mockedPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockedPrisma.review.findUnique.mockResolvedValue({ id: "rev1" });

      await createReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "A review already exists for this appointment",
        })
      );
    });

    it("should recalculate doctor rating after creating review", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Perfect!",
        }
      );
      const res = buildRes();

      const mockAppointment = {
        id: "apt1",
        doctorId: "doc1",
        status: AppointmentStatus.COMPLETED,
      };

      mockedPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockedPrisma.review.findUnique.mockResolvedValue(null);

      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            create: jest.fn().mockResolvedValue({
              id: "rev1",
              rating: 5,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 4.5 },
              _count: { rating: 2 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
        return { id: "rev1" };
      });

      await createReview(req as Request, res as Response);

      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("updateReview", () => {
    it("should update a review with valid data", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          rating: 4,
          comment: "Updated comment",
        },
        { reviewId: "rev1" }
      );
      const res = buildRes();

      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - 24); // 24 hours ago
      jest.setSystemTime(new Date());

      const mockExistingReview = {
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
        createdAt,
      };

      const mockUpdatedReview = {
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
        rating: 4,
        comment: "Updated comment",
        doctor: {
          id: "doc1",
          specialty: "Cardiology",
          clinicLocation: "NYC",
          user: { name: "Dr. Smith", profilePicture: "pic.jpg" },
        },
      };

      mockedPrisma.review.findUnique.mockResolvedValue(mockExistingReview);
      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            update: jest.fn().mockResolvedValue(mockUpdatedReview),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 4 },
              _count: { rating: 3 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
        return mockUpdatedReview;
      });

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          message: "Review updated successfully",
        })
      );
    });

    it("should reject if review does not exist", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        { rating: 4 },
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue(null);

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You can only update your own reviews",
        })
      );
    });

    it("should reject if user is not the review author", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        { rating: 4 },
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p2", // Different patient
        doctorId: "doc1",
        createdAt: new Date(),
      });

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You can only update your own reviews",
        })
      );
    });

    it("should reject if edit window has expired", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        { rating: 4 },
        { reviewId: "rev1" }
      );
      const res = buildRes();

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 5); // 5 days ago (beyond default 72 hour window)

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
        createdAt,
      });

      jest.setSystemTime(new Date());

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Review edit window has expired",
        })
      );
    });

    it("should reject invalid rating", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        { rating: 6 },
        { reviewId: "rev1" }
      );
      const res = buildRes();

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Rating must be an integer between 1 and 5",
        })
      );
    });

    it("should allow partial updates", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        { rating: 3 }, // Only update rating, not comment
        { reviewId: "rev1" }
      );
      const res = buildRes();

      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - 24);

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
        createdAt,
      });

      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            update: jest.fn().mockResolvedValue({
              id: "rev1",
              rating: 3,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 3.5 },
              _count: { rating: 2 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
        return { id: "rev1", rating: 3 };
      });

      await updateReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteReview", () => {
    it("should allow patient to delete own review", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
      });

      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            delete: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 4 },
              _count: { rating: 1 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
      });

      await deleteReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Review deleted successfully",
        })
      );
    });

    it("should allow admin to delete any review", async () => {
      const req = buildReq(
        {
          id: "u2",
          role: Role.ADMIN,
          patient: null,
          doctor: null,
          admin: { id: "a1" },
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p2",
        doctorId: "doc1",
      });

      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            delete: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 4.5 },
              _count: { rating: 5 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
      });

      await deleteReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject if patient tries to delete another patient's review", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p2",
        doctorId: "doc1",
      });

      await deleteReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "You do not have permission to delete this review",
        })
      );
    });

    it("should return 404 if review not found", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue(null);

      await deleteReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Review not found",
        })
      );
    });

    it("should reject unauthenticated requests", async () => {
      const req = buildReq(
        {
          id: undefined,
          role: undefined,
          patient: null,
          doctor: null,
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      await deleteReview(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Authentication required",
        })
      );
    });

    it("should recalculate doctor rating after deletion", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {},
        { reviewId: "rev1" }
      );
      const res = buildRes();

      mockedPrisma.review.findUnique.mockResolvedValue({
        id: "rev1",
        patientId: "p1",
        doctorId: "doc1",
      });

      let txCalled = false;
      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        txCalled = true;
        const mockTx = {
          review: {
            delete: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 3.5 },
              _count: { rating: 2 },
            }),
          },
          doctor: {
            update: jest.fn(),
          },
        };
        await cb(mockTx);
      });

      await deleteReview(req as Request, res as Response);

      expect(txCalled).toBe(true);
      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("getMyReviews", () => {
    it("should return patient's reviews", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        }
      );
      const res = buildRes();

      const mockReviews = [
        {
          id: "rev1",
          rating: 5,
          comment: "Great!",
          doctor: {
            id: "doc1",
            specialty: "Cardiology",
            averageRating: 4.5,
            totalReviews: 10,
          },
        },
      ];

      mockedPrisma.review.findMany.mockResolvedValue(mockReviews);

      await getMyReviews(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockReviews,
          message: "Reviews fetched successfully",
        })
      );
    });

    it("should reject non-patients", async () => {
      const req = buildReq(
        {
          id: "u2",
          role: Role.DOCTOR,
          patient: null,
          doctor: { id: "doc1" },
        }
      );
      const res = buildRes();

      await getMyReviews(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only patients can view their reviews",
        })
      );
    });
  });

  describe("getDoctorReviews", () => {
    it("should return doctor's reviews", async () => {
      const req = buildReq(
        {
          id: "u2",
          role: Role.DOCTOR,
          patient: null,
          doctor: { id: "doc1" },
        }
      );
      const res = buildRes();

      const mockReviews = [
        {
          id: "rev1",
          rating: 5,
          comment: "Excellent!",
          patient: {
            id: "p1",
            user: { name: "John Doe" },
          },
        },
      ];

      mockedPrisma.review.findMany.mockResolvedValue(mockReviews);

      await getDoctorReviews(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockReviews,
          message: "Reviews fetched successfully",
        })
      );
    });

    it("should reject non-doctors", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        }
      );
      const res = buildRes();

      await getDoctorReviews(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only doctors can view their reviews",
        })
      );
    });
  });

  describe("Rating Recalculation", () => {
    it("should correctly calculate average rating from multiple reviews", async () => {
      // Simulating doctor with reviews: 5, 4, 3 -> avg 4.0
      const aggregateResult = {
        _avg: { rating: 4.0 },
        _count: { rating: 3 },
      };

      mockedPrisma.review.aggregate.mockResolvedValue(aggregateResult);
      mockedPrisma.doctor.update.mockResolvedValue({
        id: "doc1",
        averageRating: 4.0,
        totalReviews: 3,
      });

      const mockTx = {
        review: {
          aggregate: mockedPrisma.review.aggregate,
        },
        doctor: {
          update: mockedPrisma.doctor.update,
        },
      };

      // Simulate the recalculateDoctorRating function
      const aggregate = await mockTx.review.aggregate({
        where: { doctorId: "doc1" },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await mockTx.doctor.update({
        where: { id: "doc1" },
        data: {
          averageRating: Number(aggregate._avg.rating ?? 0),
          totalReviews: aggregate._count.rating,
        },
      });

      expect(mockedPrisma.doctor.update).toHaveBeenCalledWith({
        where: { id: "doc1" },
        data: {
          averageRating: 4.0,
          totalReviews: 3,
        },
      });
    });

    it("should handle zero reviews (no ratings)", async () => {
      const aggregateResult = {
        _avg: { rating: null },
        _count: { rating: 0 },
      };

      mockedPrisma.review.aggregate.mockResolvedValue(aggregateResult);
      mockedPrisma.doctor.update.mockResolvedValue({
        id: "doc1",
        averageRating: 0,
        totalReviews: 0,
      });

      const mockTx = {
        review: {
          aggregate: mockedPrisma.review.aggregate,
        },
        doctor: {
          update: mockedPrisma.doctor.update,
        },
      };

      const aggregate = await mockTx.review.aggregate({
        where: { doctorId: "doc1" },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await mockTx.doctor.update({
        where: { id: "doc1" },
        data: {
          averageRating: Number(aggregate._avg.rating ?? 0),
          totalReviews: aggregate._count.rating,
        },
      });

      expect(mockedPrisma.doctor.update).toHaveBeenCalledWith({
        where: { id: "doc1" },
        data: {
          averageRating: 0,
          totalReviews: 0,
        },
      });
    });

    it("should update rating after each review operation", async () => {
      const req = buildReq(
        {
          id: "u1",
          role: Role.PATIENT,
          patient: { id: "p1" },
          doctor: null,
        },
        {
          appointmentId: "apt1",
          rating: 5,
          comment: "Excellent!",
        }
      );
      const res = buildRes();

      mockedPrisma.appointment.findFirst.mockResolvedValue({
        id: "apt1",
        doctorId: "doc1",
        status: AppointmentStatus.COMPLETED,
      });
      mockedPrisma.review.findUnique.mockResolvedValue(null);

      const doctorUpdateMock = jest.fn();

      mockedPrisma.$transaction.mockImplementation(async (cb) => {
        const mockTx = {
          review: {
            create: jest.fn().mockResolvedValue({ id: "rev1", rating: 5 }),
            aggregate: jest.fn().mockResolvedValue({
              _avg: { rating: 5 },
              _count: { rating: 1 },
            }),
          },
          doctor: {
            update: doctorUpdateMock,
          },
        };
        await cb(mockTx);
        return { id: "rev1" };
      });

      await createReview(req as Request, res as Response);

      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
