import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { sendFollowUpReminderEmail } from "../utils/emailService";
import prisma from "../utils/prismClient";

/**
 * Update appointment notes
 * PATCH /api/appointments/:appointmentId/notes
 * Access: Doctor only
 */
export const updateAppointmentNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { appointmentId } = req.params as { appointmentId: string };
    const { notes } = req.body;
    const doctorId = (req as any).user?.doctor?.id;

    if (!doctorId) {
      return next(new ApiError(403, "Only doctors can update appointment notes"));
    }

    // Validate appointment belongs to doctor
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        doctorId: doctorId,
      },
    });

    if (!appointment) {
      return next(new ApiError(404, "Appointment not found or unauthorized"));
    }

    // Update notes
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { notes },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedAppointment,
          "Appointment notes updated successfully"
        )
      );
  } catch (error) {
    console.error("Error updating appointment notes:", error);
    next(new ApiError(500, "Failed to update appointment notes"));
  }
};

/**
 * Add/update follow-up date
 * PATCH /api/appointments/:appointmentId/followup
 * Access: Doctor only
 */
export const addFollowUpDate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { appointmentId } = req.params as { appointmentId: string };
    const { followUpDate, notes } = req.body;
    const doctorId = (req as any).user?.doctor?.id;

    if (!doctorId) {
      return next(new ApiError(403, "Only doctors can schedule follow-ups"));
    }

    // Validate appointment belongs to doctor
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        doctorId: doctorId,
      },
    });

    if (!appointment) {
      return next(new ApiError(404, "Appointment not found or unauthorized"));
    }

    // Validate follow-up date is in the future
    const followUpDateTime = new Date(followUpDate);
    if (followUpDateTime <= new Date()) {
      return next(new ApiError(400, "Follow-up date must be in the future"));
    }

    // Update follow-up date
    const updateData: any = {
      followUpDate: followUpDateTime,
      followUpSent: false,
      followUpSentAt: null,
    };

    if (notes) {
      updateData.notes = notes;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            id: updatedAppointment.id,
            followUpDate: updatedAppointment.followUpDate,
            followUpSent: updatedAppointment.followUpSent,
            notes: updatedAppointment.notes,
            updatedAt: updatedAppointment.updatedAt,
          },
          "Follow-up scheduled successfully"
        )
      );
  } catch (error) {
    console.error("Error adding follow-up date:", error);
    next(new ApiError(500, "Failed to schedule follow-up"));
  }
};

/**
 * Get appointments with follow-ups
 * GET /api/appointments/followups
 * Access: Doctor only
 */
export const getAppointmentsWithFollowUps = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorId = (req as any).user?.doctor?.id;
    const { upcoming, overdue, sent } = req.query;

    if (!doctorId) {
      return next(new ApiError(403, "Only doctors can view follow-ups"));
    }

    const where: any = {
      doctorId: doctorId,
      followUpDate: { not: null },
    };

    // Filter by upcoming (next 30 days)
    if (upcoming === "true") {
      where.followUpDate = {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Filter by overdue
    if (overdue === "true") {
      where.followUpDate = {
        lt: new Date(),
      };
      where.followUpSent = false;
    }

    // Filter by sent status
    if (sent !== undefined) {
      where.followUpSent = sent === "true";
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      patient: {
        id: appointment.patient.id,
        name: appointment.patient.user.name,
        email: appointment.patient.user.email,
      },
      date: appointment.date,
      followUpDate: appointment.followUpDate,
      followUpSent: appointment.followUpSent,
      followUpSentAt: appointment.followUpSentAt,
      notes: appointment.notes,
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    console.error("Error fetching follow-ups:", error);
    next(new ApiError(500, "Failed to fetch follow-ups"));
  }
};

/**
 * Send follow-up reminder manually
 * POST /api/appointments/:appointmentId/send-followup-reminder
 * Access: Doctor/Admin
 */
export const sendFollowUpReminder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { appointmentId } = req.params as { appointmentId: string };
    const doctorId = (req as any).user?.doctor?.id;
    const role = (req as any).user?.role;

    if (!doctorId && role !== "ADMIN") {
      return next(
        new ApiError(403, "Only doctors or admins can send follow-up reminders")
      );
    }

    // Get appointment with patient and doctor details
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...(doctorId ? { doctorId: doctorId } : {}),
      },
      include: {
        patient: {
          include: {
            user: true,
          },
        },
        doctor: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!appointment) {
      return next(new ApiError(404, "Appointment not found or unauthorized"));
    }

    if (!appointment.followUpDate) {
      return next(
        new ApiError(400, "No follow-up date set for this appointment")
      );
    }

    // Send email
    await sendFollowUpReminderEmail({
      patientName: appointment.patient.user.name,
      patientEmail: appointment.patient.user.email,
      doctorName: appointment.doctor.user.name,
      followUpDate: appointment.followUpDate,
      previousAppointmentDate: appointment.date,
      notes: appointment.notes || undefined,
    });

    // Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        followUpSent: true,
        followUpSentAt: new Date(),
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            id: updatedAppointment.id,
            followUpSent: updatedAppointment.followUpSent,
            followUpSentAt: updatedAppointment.followUpSentAt,
          },
          "Follow-up reminder sent successfully"
        )
      );
  } catch (error) {
    console.error("Error sending follow-up reminder:", error);
    next(new ApiError(500, "Failed to send follow-up reminder"));
  }
};

/**
 * Get appointment details with notes
 * GET /api/appointments/:appointmentId/details
 * Access: Doctor (own appointments) or Patient (own appointments)
 */
export const getAppointmentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { appointmentId } = req.params as { appointmentId: string };
    const userId = (req as any).user?.id;
    const doctorId = (req as any).user?.doctor?.id;
    const patientId = (req as any).user?.patient?.id;

    if (!userId) {
      return next(new ApiError(401, "Unauthorized"));
    }

    // Build where clause based on role
    const where: any = { id: appointmentId };
    if (doctorId) {
      where.doctorId = doctorId;
    } else if (patientId) {
      where.patientId = patientId;
    } else {
      return next(new ApiError(403, "Access denied"));
    }

    const appointment = await prisma.appointment.findFirst({
      where,
      include: {
        patient: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        doctor: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            specialty: true,
          },
        },
        timeSlot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!appointment) {
      return next(new ApiError(404, "Appointment not found"));
    }

    const formattedAppointment = {
      id: appointment.id,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      appointmentType: appointment.appointmentType,
      consultationFee: appointment.consultationFee,
      notes: appointment.notes,
      followUpDate: appointment.followUpDate,
      followUpSent: appointment.followUpSent,
      followUpSentAt: appointment.followUpSentAt,
      patient: {
        id: appointment.patient.id,
        name: appointment.patient.user.name,
        email: appointment.patient.user.email,
      },
      doctor: {
        id: appointment.doctor.id,
        name: appointment.doctor.user.name,
        email: appointment.doctor.user.email,
        specialty: appointment.doctor.specialty,
      },
      timeSlot: appointment.timeSlot,
    };

    res.status(200).json(new ApiResponse(200, formattedAppointment));
  } catch (error) {
    console.error("Error fetching appointment details:", error);
    next(new ApiError(500, "Failed to fetch appointment details"));
  }
};
