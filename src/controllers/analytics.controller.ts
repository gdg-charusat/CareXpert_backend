import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";

interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    patient?: { id: string } | null;
    doctor?: { id: string } | null;
    admin?: { permissions?: Record<string, any> } | null;
  };
}

export const getHealthSummary = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patient?.id;

    if (!patientId) {
      return res.status(403).json(new ApiError(403, "Access denied. Patient profile not found."));
    }

    const [appointmentsCount, reportsCount, prescriptionsCount] = await Promise.all([
      prisma.appointment.count({ where: { patientId } }),
      prisma.report.count({ where: { patientId } }),
      prisma.prescription.count({ where: { patientId } }),
    ]);

    const summary = {
      appointmentsCount,
      reportsCount,
      prescriptionsCount,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, summary, "Health summary retrieved successfully"));
  } catch (error) {
    console.error("Error in getHealthSummary:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

export const getDoctorVisitFrequency = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patient?.id;

    if (!patientId) {
      return res.status(403).json(new ApiError(403, "Access denied. Patient profile not found."));
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        status: "COMPLETED",
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
              }
            }
          }
        },
      },
    });

    const doctorStats: Record<string, { doctorId: string; name: string; specialty: string; visitCount: number }> = {};

    appointments.forEach((appt: any) => {
      const docId = appt.doctorId;
      if (!doctorStats[docId]) {
        doctorStats[docId] = {
          doctorId: docId,
          name: appt.doctor.user.name,
          specialty: appt.doctor.specialty,
          visitCount: 0,
        };
      }
      doctorStats[docId].visitCount += 1;
    });

    const frequencyList = Object.values(doctorStats).sort((a, b) => b.visitCount - a.visitCount);

    return res
      .status(200)
      .json(new ApiResponse(200, frequencyList, "Doctor visit frequency retrieved successfully"));
  } catch (error) {
    console.error("Error in getDoctorVisitFrequency:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

export const getReportTrends = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patient?.id;

    if (!patientId) {
      return res.status(403).json(new ApiError(403, "Access denied. Patient profile not found."));
    }

    const reports = await prisma.report.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        status: true,
        summary: true,
        abnormalValues: true,
        possibleConditions: true,
      },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, reports, "Report trends retrieved successfully"));
  } catch (error) {
    console.error("Error in getReportTrends:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

export const getSymptomPatterns = async (req: AuthRequest, res: Response) => {
  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json(new ApiError(403, "Access denied. User profile not found."));
    }

    const aiChats = await prisma.aiChat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        probableCauses: true,
        severity: true,
        createdAt: true,
      },
    });

    const causeFrequency: Record<string, number> = {};
    aiChats.forEach((chat: any) => {
      chat.probableCauses.forEach((cause: any) => {

        const normalized = cause.trim().toLowerCase();
        causeFrequency[normalized] = (causeFrequency[normalized] || 0) + 1;
      });
    });

    const commonCauses = Object.entries(causeFrequency)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count);

    const patterns = {
      recentChats: aiChats,
      commonCauses,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, patterns, "Symptom patterns retrieved successfully"));
  } catch (error) {
    console.error("Error in getSymptomPatterns:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};
