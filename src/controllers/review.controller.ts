import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { AppointmentStatus, Role } from "@prisma/client";
import prisma from "../utils/prismClient";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

const REVIEW_EDIT_WINDOW_HOURS = Number(process.env.REVIEW_EDIT_WINDOW_HOURS ?? "72");

const normalizeComment = (comment?: string): string | null => {
  if (typeof comment !== "string") {
    return null;
  }
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidRating = (rating: unknown): rating is number => {
  return Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5;
};

const validateComment = (comment: string | null): string | null => {
  if (comment === null) {
    return null;
  }

  if (comment.length > 1000) {
    return "Comment must be 1000 characters or fewer";
  }

  return null;
};

const canEditReview = (createdAt: Date): boolean => {
  if (REVIEW_EDIT_WINDOW_HOURS <= 0) {
    return true;
  }

  const editDeadline = new Date(createdAt.getTime() + REVIEW_EDIT_WINDOW_HOURS * 60 * 60 * 1000);
  return new Date() <= editDeadline;
};

const recalculateDoctorRating = async (
  tx: Prisma.TransactionClient,
  doctorId: string
): Promise<void> => {
  const aggregate = await tx.review.aggregate({
    where: { doctorId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await tx.doctor.update({
    where: { id: doctorId },
    data: {
      averageRating: Number(aggregate._avg.rating ?? 0),
      totalReviews: aggregate._count.rating,
    },
  });
};

const createReview = async (req: Request, res: Response): Promise<void> => {
  const patientId = (req as any).user?.patient?.id as string | undefined;
  const role = (req as any).user?.role as Role | undefined;
  const { appointmentId, rating, comment, isAnonymous } = req.body as {
    appointmentId?: string;
    rating?: number;
    comment?: string;
    isAnonymous?: boolean;
  };

  if (role !== Role.PATIENT || !patientId) {
    res.status(403).json(new ApiError(403, "Only patients can create reviews"));
    return;
  }

  if (!appointmentId) {
    res.status(400).json(new ApiError(400, "appointmentId is required"));
    return;
  }

  if (!isValidRating(rating)) {
    res.status(400).json(new ApiError(400, "Rating must be an integer between 1 and 5"));
    return;
  }

  const normalizedComment = normalizeComment(comment);
  const commentError = validateComment(normalizedComment);
  if (commentError) {
    res.status(400).json(new ApiError(400, commentError));
    return;
  }

  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId,
        status: AppointmentStatus.COMPLETED,
      },
      select: {
        id: true,
        doctorId: true,
        date: true,
      },
    });

    if (!appointment) {
      res.status(400).json(new ApiError(400, "You can only review your completed appointments"));
      return;
    }

    const existingReview = await prisma.review.findUnique({
      where: { appointmentId },
      select: { id: true },
    });

    if (existingReview) {
      res.status(409).json(new ApiError(409, "A review already exists for this appointment"));
      return;
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          appointmentId,
          patientId,
          doctorId: appointment.doctorId,
          rating,
          comment: normalizedComment,
          isAnonymous: Boolean(isAnonymous),
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialty: true,
              clinicLocation: true,
              user: {
                select: {
                  name: true,
                  profilePicture: true,
                },
              },
            },
          },
          appointment: {
            select: {
              id: true,
              date: true,
              time: true,
            },
          },
        },
      });

      await recalculateDoctorRating(tx, appointment.doctorId);
      return created;
    });

    res.status(201).json(new ApiResponse(201, review, "Review created successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to create review", [error]));
  }
};

const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  const patientId = (req as any).user?.patient?.id as string | undefined;
  const role = (req as any).user?.role as Role | undefined;

  if (role !== Role.PATIENT || !patientId) {
    res.status(403).json(new ApiError(403, "Only patients can view their reviews"));
    return;
  }

  try {
    const reviews = await prisma.review.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            id: true,
            specialty: true,
            clinicLocation: true,
            averageRating: true,
            totalReviews: true,
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
          },
        },
        appointment: {
          select: {
            id: true,
            date: true,
            time: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to fetch reviews", [error]));
  }
};

const getDoctorReviews = async (req: Request, res: Response): Promise<void> => {
  const doctorId = (req as any).user?.doctor?.id as string | undefined;
  const role = (req as any).user?.role as Role | undefined;

  if (role !== Role.DOCTOR || !doctorId) {
    res.status(403).json(new ApiError(403, "Only doctors can view their reviews"));
    return;
  }

  try {
    const reviews = await prisma.review.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
          },
        },
        appointment: {
          select: {
            id: true,
            date: true,
            time: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to fetch reviews", [error]));
  }
};

const updateReview = async (req: Request, res: Response): Promise<void> => {
  const reviewId = req.params.reviewId as string;
  const patientId = (req as any).user?.patient?.id as string | undefined;
  const role = (req as any).user?.role as Role | undefined;
  const { rating, comment, isAnonymous } = req.body as {
    rating?: number;
    comment?: string;
    isAnonymous?: boolean;
  };

  if (role !== Role.PATIENT || !patientId) {
    res.status(403).json(new ApiError(403, "Only review authors can update reviews"));
    return;
  }

  if (rating !== undefined && !isValidRating(rating)) {
    res.status(400).json(new ApiError(400, "Rating must be an integer between 1 and 5"));
    return;
  }

  const normalizedComment = comment !== undefined ? normalizeComment(comment) : undefined;
  if (normalizedComment !== undefined) {
    const commentError = validateComment(normalizedComment);
    if (commentError) {
      res.status(400).json(new ApiError(400, commentError));
      return;
    }
  }

  try {
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        createdAt: true,
      },
    });

    if (!existingReview || existingReview.patientId !== patientId) {
      res.status(403).json(new ApiError(403, "You can only update your own reviews"));
      return;
    }

    if (!canEditReview(existingReview.createdAt)) {
      res.status(403).json(new ApiError(403, "Review edit window has expired"));
      return;
    }

    const updatedReview = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(rating !== undefined ? { rating } : {}),
          ...(normalizedComment !== undefined ? { comment: normalizedComment } : {}),
          ...(isAnonymous !== undefined ? { isAnonymous: Boolean(isAnonymous) } : {}),
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialty: true,
              clinicLocation: true,
              user: {
                select: {
                  name: true,
                  profilePicture: true,
                },
              },
            },
          },
          appointment: {
            select: {
              id: true,
              date: true,
              time: true,
            },
          },
        },
      });

      await recalculateDoctorRating(tx, existingReview.doctorId);
      return updated;
    });

    res.status(200).json(new ApiResponse(200, updatedReview, "Review updated successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to update review", [error]));
  }
};

const deleteReview = async (req: Request, res: Response): Promise<void> => {
  const reviewId = req.params.reviewId as string;
  const role = (req as any).user?.role as Role | undefined;
  const patientId = (req as any).user?.patient?.id as string | undefined;

  if (!role) {
    res.status(401).json(new ApiError(401, "Authentication required"));
    return;
  }

  try {
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
      },
    });

    if (!existingReview) {
      res.status(404).json(new ApiError(404, "Review not found"));
      return;
    }

    const canDelete = role === Role.ADMIN || (role === Role.PATIENT && patientId === existingReview.patientId);
    if (!canDelete) {
      res.status(403).json(new ApiError(403, "You do not have permission to delete this review"));
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      await recalculateDoctorRating(tx, existingReview.doctorId);
    });

    res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to delete review", [error]));
  }
};

export { createReview, getMyReviews, getDoctorReviews, updateReview, deleteReview };
