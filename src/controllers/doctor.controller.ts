import { Request, Response } from "express";
import { UserInRequest } from "../utils/helper";
import {
  AppointmentStatus,
  TimeSlotStatus,
} from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import prisma from "../utils/prismClient";

const viewDoctorAppointment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = (req as any).user?.id;
  const { status, upcoming } = req.query; // status=PENDING/COMPLETED/CANCELLED, upcoming=true

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });

  try {
    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const filters: any = {
      doctorId: doctor.id,
    };

    if (status && typeof status === "string") {
      filters.status = status as AppointmentStatus;
    }

    if (upcoming === "true") {
      filters.timeSlot = {
        startTime: {
          gte: new Date(),
        },
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        patient: {
          select: {
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
          },
        },
        timeSlot: true,
      },
      // orderBy: {
      //   timeSlot: {
      //     startTime: "asc",
      //   },
      // },
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      patientName: appointment.patient.user.name,
      profilePicture: appointment.patient.user.profilePicture,
      notes: appointment.notes,
      appointmentTime: {
        startTime: appointment.timeSlot?.startTime,
        endTime: appointment.timeSlot?.endTime,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const updateAppointmentStatus = async (req: Request, res: Response) => {
  const { id } = (req as any).params;
  const { status, notes, prescriptionText } = req.body;

  if (!["COMPLETED", "CANCELLED"].includes(status)) {
    res
      .status(400)
      .json(new ApiError(400, "Status must be Completed or Cancelled"));
    return;
  }
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        timeSlot: true,
        patient: true,
        doctor: true,
      },
    });
    if (!appointment) {
      res.status(400).json(new ApiError(400, "Appointment not found!"));
      return;
    }
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: status as AppointmentStatus,
        notes: notes || undefined,
      },
    });
    if (status === "CANCELLED") {
      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: {
            status: TimeSlotStatus.AVAILABLE,
          },
        });
      }
    }
    if (status === "COMPLETED" && prescriptionText) {
      const prescription = await prisma.prescription.create({
        data: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          prescriptionText: prescriptionText,
        },
      });
      await prisma.patientHistory.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          prescriptionId: prescription.id,
          appointmentId: appointment.id,
          notes: notes || "",
          dateRecorded: new Date(),
        },
      });
    }
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedAppointment,
          "Appointment updated successfully"
        )
      );
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to update appointment", [error]));
  }
};

const addTimeslot = async (req: Request, res: Response) => {
  const { startTime, endTime } = req.body;
  if (!startTime || !endTime) {
    res.status(400).json(new ApiError(400, "Start and end time required"));
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json(new ApiError(400, "Invalid date format"));
    return;
  }
  const totalTime = (end.getTime() - start.getTime()) / 1000 / 60 / 60;

  if (totalTime > 3 || totalTime < 0) {
    res
      .status(400)
      .json(new ApiResponse(400, "Time slot must be between 0 to 3 hours"));
    return;
  }
  try {
    const userId = (req as any).user?.id;
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const existingTimeslot = await prisma.timeSlot.findFirst({
      where: {
        doctorId: doctor.id,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    });

    if (existingTimeslot) {
      res
        .status(400)
        .json(new ApiError(400, "Timeslot overlap with the existing timeslot"));
      return;
    }

    await prisma.$transaction(async (prisma) => {
      const timeSlot = await prisma.timeSlot.create({
        data: {
          doctorId: doctor.id,
          startTime,
          endTime,
        },
      });
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          timeSlots: {
            connect: { id: timeSlot.id },
          },
        },
      });
    });

    res.status(200).json(new ApiResponse(200, "Timeslot added successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const cancelAppointment = async (req: Request, res: any) => {
  const { appointmentId } = (req as any).params;
  const doctorId = (req as any).user?.doctor?.id;

  try {
    if (!doctorId) {
      res
        .status(400)
        .json(new ApiError(400, "Only doctor can cancel Appointments!"));
      return;
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment || doctorId !== appointment.doctorId) {
      res
        .status(400)
        .json(new ApiError(400, "Appointment not found or Unauthorized"));
      return;
    } else if (appointment.status === AppointmentStatus.CANCELLED) {
      res.status(400).json(new ApiError(400, "Appointment already Cancelled!"));
      return;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    // Update time slot if it exists
    if (appointment?.timeSlotId) {
      await prisma.timeSlot.update({
        where: { id: appointment.timeSlotId },
        data: {
          status: TimeSlotStatus.AVAILABLE,
        },
      });
    }
    return res
      .status(200)
      .json(new ApiResponse(200, "Appointment Cancelled successfully!"));
  } catch (error) {
    res
      .status(500)
      .json(
        new ApiError(500, "Error occured while cancelling appointment!", [
          error,
        ])
      );
  }
};

const viewTimeslots = async (req: Request, res: Response) => {
  const { status, startTime, endTime } = req.query; //status = AVAILABLE,BOOKED,CANCELLED
  const userId = (req as any).user?.id;

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      res.status(400).json(new ApiError(400, "Doctor not found"));
      return;
    }

    const filters: any = {
      doctorId: doctor.id,
    };
    if (status && typeof status === "string") {
      filters.status = status as TimeSlotStatus;
    }
    if (startTime) {
      filters.startTime = { gte: startTime };
    }
    if (endTime) {
      filters.endTime = { lte: endTime };
    }
    const timeSlots = await prisma.timeSlot.findMany({
      where: filters,
      include: {
        appointment: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    res.status(200).json(new ApiResponse(200, timeSlots));
  } catch (error) {
    res.status(500).json(new ApiError(500, "internal server error", [error]));
  }
};

const getPatientHistory = async (req: Request, res: Response) => {
  const { patientId } = (req as any).params;
  const user = (req as any).user;

  if (!patientId) {
    res.status(400).json(new ApiError(400, "Patient not found!"));
    return;
  }
  if (!user?.doctor) {
    res
      .status(400)
      .json(new ApiError(400, "Only doctor can get patient history!"));
    return;
  }
  try {
    const history = await prisma.patientHistory.findMany({
      where: { patientId },
      include: {
        appointment: true,
        prescription: true,
        doctor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            specialty: true,
          },
        },
      },
      orderBy: { dateRecorded: "desc" },
    });

    res.status(200).json(new ApiResponse(200, history));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to fetch patient history!"));
  }
};

const updateTimeSlot = async (req: Request, res: Response) => {
  const timeSlotId = (req as any).params.timeSlotId;
  const doctorId = (req as any).user?.doctor?.id;
  const { startTime, endTime, status } = req.body;

  if (!doctorId) {
    res.status(403).json(new ApiError(403, "Unauthorized:Doctor not found!"));
    return;
  }

  try {
    await prisma.timeSlot.update({
      where: { id: timeSlotId },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        status: status || undefined,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Time slot updated successfully!"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to update timeslots"));
  }
};

const deleteTimeSlot = async (req: Request, res: Response) => {
  const timeSlotID = (req as any).params.timeSlotId;
  const doctorId = (req as any).user?.doctor?.id;

  if (!doctorId) {
    res
      .status(400)
      .json(new ApiError(400, "Only doctor can delete time slots!"));
    return;
  }

  try {
    const timeSlot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotID },
      include: { appointment: true }, // Include related appointments
    });

    if (!timeSlot || timeSlot.doctorId !== doctorId) {
      res
        .status(404)
        .json(new ApiError(400, "Time slot not found or unauthorized"));
      return;
    } else if (timeSlot.appointment.length > 0) {
      res
        .status(400)
        .json(
          new ApiError(400, "Cannot delete time slot with existing appointment")
        );
      return;
    }

    await prisma.timeSlot.delete({
      where: { id: timeSlotID },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Time slot successfully deleted!"));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to delete time slot", [error]));
  }
};

const cityRooms = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.id;

    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(200).json(new ApiResponse(200, rooms));
    return;
  } catch (err) {
    res.status(500).json(new ApiError(500, "Internal server error ", [err]));
    return;
  }
};

const createRoom = async (req: Request, res: Response) => {
  try {
    const id = (req as any).user?.id;
    const { roomName } = req.body;

    if (!roomName) {
      res.status(404).json(new ApiError(404, "roomname is missing"));
      return;
    }

    const room = await prisma.room.create({
      data: {
        name: roomName,
        members: {
          connect: [{ id }],
        },
        admin: {
          connect: [{ id }],
        },
      },
    });
    res
      .status(200)
      .json(new ApiResponse(200, room, "Room created Successfully"));
    return;
  } catch (err) {
    res.status(500).json(new ApiError(500, "Internal server error", [err]));
    return;
  }
};

const getAllDoctorAppointments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const { status, upcoming } = req.query; // status=PENDING/CONFIRMED/COMPLETED/CANCELLED, upcoming=true

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const filters: any = {
      doctorId: doctor.id,
    };

    if (status && typeof status === "string") {
      filters.status = status as AppointmentStatus;
    }

    if (upcoming === "true") {
      filters.timeSlot = {
        startTime: {
          gte: new Date(),
        },
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        patient: {
          include: {
            user: {
              select: {
                name: true,
                profilePicture: true,
                email: true,
              },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: {
        timeSlot: {
          startTime: "asc",
        },
      },
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      appointmentType: appointment.appointmentType,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes,
      consultationFee: appointment.consultationFee,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      prescriptionId: (appointment as any).prescriptionId || null,
      appointmentTime: {
        startTime: appointment.timeSlot?.startTime,
        endTime: appointment.timeSlot?.endTime,
      },
      patient: {
        id: appointment.patient.id,
        name: appointment.patient.user.name,
        profilePicture: appointment.patient.user.profilePicture,
        email: appointment.patient.user.email,
        medicalHistory: appointment.patient.medicalHistory,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

// New appointment request management functions
const getPendingAppointmentRequests = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const pendingRequests = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: AppointmentStatus.PENDING,
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                profilePicture: true,
              },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const formattedRequests = pendingRequests.map((request) => ({
      id: request.id,
      status: request.status,
      appointmentType: request.appointmentType,
      date: request.date,
      time: request.time,
      notes: request.notes,
      consultationFee: request.consultationFee,
      createdAt: request.createdAt,
      patient: {
        id: request.patient.id,
        name: request.patient.user.name,
        email: request.patient.user.email,
        profilePicture: request.patient.user.profilePicture,
        medicalHistory: request.patient.medicalHistory,
      },
      timeSlot: request.timeSlot ? {
        id: request.timeSlot.id,
        startTime: request.timeSlot.startTime,
        endTime: request.timeSlot.endTime,
        consultationFee: request.timeSlot.consultationFee,
      } : null,
    }));

    res.status(200).json(new ApiResponse(200, formattedRequests));
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json(new ApiError(500, "Failed to fetch pending requests!", [error]));
  }
};

const respondToAppointmentRequest = async (req: Request, res: Response): Promise<void> => {
  const { appointmentId } = req.params;
  const { action, rejectionReason, alternativeSlots } = req.body; // action: "accept" or "reject"
  const userId = (req as any).user?.id;

  try {
    if (!["accept", "reject"].includes(action)) {
      res.status(400).json(new ApiError(400, "Action must be 'accept' or 'reject'"));
      return;
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true, user: { select: { name: true } } },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        timeSlot: true,
      },
    });

    if (!appointment || appointment.doctorId !== doctor.id) {
      res.status(404).json(new ApiError(404, "Appointment request not found!"));
      return;
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      res.status(400).json(new ApiError(400, "This appointment request has already been processed!"));
      return;
    }

    let updatedAppointment;
    let notification;

    if (action === "accept") {
      // Accept the appointment
      updatedAppointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
        },
      });

      // Create notification for patient
      notification = await prisma.notification.create({
        data: {
          userId: appointment.patient.user.id,
          type: "APPOINTMENT_ACCEPTED",
          title: "Appointment Confirmed",
          message: `Your appointment with Dr. ${doctor.user.name} has been confirmed for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time}.`,
          appointmentId: appointment.id,
        },
      });

      // If there's a timeSlot, mark it as booked
      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: TimeSlotStatus.BOOKED },
        });
      }

    } else {
      // Reject the appointment
      updatedAppointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.REJECTED,
          notes: rejectionReason || "Appointment request rejected by doctor",
        },
      });

      // Create notification for patient with alternative slots
      let message = `Your appointment request with Dr. ${doctor.user.name} has been declined.`;
      if (rejectionReason) {
        message += ` Reason: ${rejectionReason}`;
      }
      if (alternativeSlots && alternativeSlots.length > 0) {
        message += ` Suggested alternative time slots: ${alternativeSlots.join(", ")}`;
      }

      notification = await prisma.notification.create({
        data: {
          userId: appointment.patient.user.id,
          type: "APPOINTMENT_REJECTED",
          title: "Appointment Request Declined",
          message,
          appointmentId: appointment.id,
        },
      });

      // If there's a timeSlot, make it available again
      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: TimeSlotStatus.AVAILABLE },
        });
      }
    }

    res.status(200).json(new ApiResponse(200, {
      appointment: updatedAppointment,
      notification,
      message: `Appointment request ${action}ed successfully`,
    }));

  } catch (error) {
    console.error("Error responding to appointment request:", error);
    res.status(500).json(new ApiError(500, "Failed to process appointment request!", [error]));
  }
};

const getDoctorNotifications = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const { isRead } = req.query;

  try {
    const filters: any = { userId };
    if (isRead !== undefined) {
      filters.isRead = isRead === "true";
    }

    const notifications = await prisma.notification.findMany({
      where: filters,
      include: {
        appointment: {
          include: {
            patient: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(new ApiResponse(200, notifications));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json(new ApiError(500, "Failed to fetch notifications!", [error]));
  }
};

const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
  const { notificationId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    if (notification.count === 0) {
      res.status(404).json(new ApiError(404, "Notification not found!"));
      return;
    }

    res.status(200).json(new ApiResponse(200, { message: "Notification marked as read" }));
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json(new ApiError(500, "Failed to mark notification as read!", [error]));
  }
};

// Add a prescription to an appointment (text-based)
const addPrescriptionToAppointment = async (req: Request, res: Response): Promise<void> => {
  const { appointmentId } = req.params;
  const { prescriptionText, notes } = req.body as { prescriptionText?: string; notes?: string };
  const doctorUserId = (req as any).user?.id;

  try {
    if (!prescriptionText || prescriptionText.trim().length < 3) {
      res.status(400).json(new ApiError(400, "Prescription text is required"));
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) {
      res.status(403).json(new ApiError(403, "Only doctors can add prescriptions"));
      return;
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment || appointment.doctorId !== doctor.id) {
      res.status(404).json(new ApiError(404, "Appointment not found or unauthorized"));
      return;
    }

    // Create prescription and link to appointment
    const prescription = await prisma.prescription.create({
      data: {
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        prescriptionText: prescriptionText.trim(),
      },
    });

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        prescriptionId: prescription.id,
        notes: notes || undefined,
      },
      select: {
        id: true,
        patient: {
          select: {
            userId: true
          }
        }
      }
    });
    console.log(updatedAppointment)
    // Optional: notify patient that prescription is available
    await prisma.notification.create({
      data: {
        userId: updatedAppointment.patient.userId,
        type: "PRESCRIPTION_ADDED",
        title: "Prescription Available",
        message: "Your doctor has added a prescription for your appointment.",
        appointmentId: appointment.id,
      },
    });

    res.status(200).json(new ApiResponse(200, { appointment: updatedAppointment, prescriptionId: prescription.id }, "Prescription saved"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to add prescription", [error]));
  }
};

// Mark an appointment as completed
const markAppointmentCompleted = async (req: Request, res: Response): Promise<void> => {
  const { appointmentId } = req.params;
  const doctorUserId = (req as any).user?.id;

  try {
    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) {
      res.status(403).json(new ApiError(403, "Only doctors can change status"));
      return;
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment || appointment.doctorId !== doctor.id) {
      res.status(404).json(new ApiError(404, "Appointment not found or unauthorized"));
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    });

    res.status(200).json(new ApiResponse(200, updated, "Appointment marked as completed"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to mark appointment as completed", [error]));
  }
};

export {
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  viewTimeslots,
  cancelAppointment,
  getPatientHistory,
  updateTimeSlot,
  deleteTimeSlot,
  cityRooms,
  createRoom,
  getAllDoctorAppointments,
  getPendingAppointmentRequests,
  respondToAppointmentRequest,
  getDoctorNotifications,
  markNotificationAsRead,
  addPrescriptionToAppointment,
  markAppointmentCompleted,
};
