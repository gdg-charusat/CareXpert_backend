import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prismClient";
import { AppError } from "../utils/AppError";

export const authorizeReportAccess = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new AppError("Authentication required", 401));
    }

    const reportId = req.params.id;
    if (!reportId) {
      return next(new AppError("Report id is required", 400));
    }

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      return next(new AppError("Report not found", 404));
    }

    const patientId = report.patientId;

    switch (user.role) {
      case "PATIENT":
        if (patientId !== user.patient?.id) {
          return next(new AppError("You do not have permission to view this report", 403));
        }
        break;

      case "DOCTOR": {
        const doctorId = user.doctor?.id;
        if (!doctorId) {
          return next(new AppError("Access denied", 403));
        }
        const assignment = await prisma.appointment.findFirst({
          where: { doctorId, patientId },
          select: { id: true },
        });
        if (!assignment) {
          return next(new AppError("You do not have permission to view this report", 403));
        }
        break;
      }

      case "ADMIN": {
        const canView = user.admin?.permissions?.canViewReports;
        if (!canView) {
          return next(new AppError("You do not have permission to view this report", 403));
        }
        break;
      }

      default:
        return next(new AppError("You do not have permission to view this report", 403));
    }

    // attach the loaded report so handler doesn't need to refetch
    req.report = report;
    next();
  } catch (error) {
    next(error);
  }
};
