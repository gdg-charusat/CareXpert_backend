import { Request, Response } from "express";
import { UserInRequest } from "../utils/helper";
import {
  AppointmentStatus,
  TimeSlotStatus,
  Prisma,
} from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import prisma from "../utils/prismClient";
import doc from "pdfkit";
import { sendEmail, appointmentStatusTemplate, prescriptionTemplate } from "../utils/emailService";

const viewDoctorAppointment = async (
  req: Request,
  res: Response
): Promise<any> => {
  const userId = (req as any).user?.id;
  const { status, upcoming } = req.query;

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
      select: {
        id: true,
        status: true,
        notes: true,
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
        timeSlot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    const formattedAppointments = appointments.map((appointment: any) => ({
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

    return res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    return res
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
        patient: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              }
            }
          }
        },
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

      sendEmail({
        to: (appointment as any).patient.user.email,
        subject: "New Prescription Available - CareXpert",
        html: prescriptionTemplate(
          (appointment as any).doctor.user.name,
          new Date().toLocaleDateString()
        ),
      }).catch((err: unknown) => console.error("Failed to send prescription email:", err));
    }
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedAppointment,
          "Appointment updated successfully"
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, "Failed to update appointment", [error]));
  }
};

const addTimeslot = async (req: Request, res: Response): Promise<any> => {
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

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const timeSlot = await tx.timeSlot.create({
        data: {
          doctorId: doctor.id,
          startTime,
          endTime,
        },
      });
      await tx.doctor.update({
        where: { id: doctor.id },
        data: {
          timeSlots: {
            connect: { id: timeSlot.id },
          },
        },
      });
    });

    return res.status(200).json(new ApiResponse(200, "Timeslot added successfully"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const generateBulkTimeSlots = async (req: Request, res: Response): Promise<any> => {
  const { startDate, endDate, startTime, endTime, durationInMinutes } = req.body;

  if (!startDate || !endDate || !startTime || !endTime || !durationInMinutes) {
    res.status(400).json(new ApiError(400, "All fields are required: startDate, endDate, startTime, endTime, durationInMinutes"));
    return;
  }

  if (durationInMinutes <= 0 || durationInMinutes > 180) {
    res.status(400).json(new ApiError(400, "Duration must be between 1 and 180 minutes"));
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

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json(new ApiError(400, "Invalid date format"));
      return;
    }

    if (end < start) {
      res.status(400).json(new ApiError(400, "End date must be after start date"));
      return;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      res.status(400).json(new ApiError(400, "Invalid time format. Use HH:mm"));
      return;
    }

    const createdSlots: any[] = [];
    const skippedSlots: any[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      let currentMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      while (currentMinutes + durationInMinutes <= endMinutes) {
        const slotStartHour = Math.floor(currentMinutes / 60);
        const slotStartMinute = currentMinutes % 60;
        const slotEndMinutes = currentMinutes + durationInMinutes;
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMinute = slotEndMinutes % 60;

        const slotStart = new Date(dateStr);
        slotStart.setHours(slotStartHour, slotStartMinute, 0, 0);

        const slotEnd = new Date(dateStr);
        slotEnd.setHours(slotEndHour, slotEndMinute, 0, 0);

        const existingTimeslot = await prisma.timeSlot.findFirst({
          where: {
            doctorId: doctor.id,
            startTime: { lt: slotEnd },
            endTime: { gt: slotStart },
          },
          select: { id: true },
        });

        if (existingTimeslot) {
          skippedSlots.push({
            date: dateStr,
            startTime: `${slotStartHour < 10 ? '0' : ''}${slotStartHour}:${slotStartMinute < 10 ? '0' : ''}${slotStartMinute}`,
            endTime: `${slotEndHour < 10 ? '0' : ''}${slotEndHour}:${slotEndMinute < 10 ? '0' : ''}${slotEndMinute}`,
            reason: "Overlaps with existing slot"
          });
        } else {

          const timeSlot = await prisma.timeSlot.create({
            data: {
              doctorId: doctor.id,
              startTime: slotStart,
              endTime: slotEnd,
            },
          });
          createdSlots.push(timeSlot);
        }

        currentMinutes += durationInMinutes;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.status(200).json(new ApiResponse(200, {
      message: "Bulk timeslots generation completed",
      created: createdSlots.length,
      skipped: skippedSlots.length,
      createdSlots,
      skippedSlots
    }));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const cancelAppointment = async (req: Request, res: any) => {
  const { appointmentId } = (req as any).params;
  const doctorId = (req as any).user?.doctor?.id;

  try {
    if (!doctorId) {
      return res
        .status(400)
        .json(new ApiError(400, "Only doctor can cancel Appointments!"));
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment || doctorId !== appointment.doctorId) {
      return res
        .status(400)
        .json(new ApiError(400, "Appointment not found or Unauthorized"));
    } else if (appointment.status === AppointmentStatus.CANCELLED) {
      return res.status(400).json(new ApiError(400, "Appointment already Cancelled!"));
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

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
      .json(new ApiResponse(200, null, "Appointment Cancelled successfully!"));
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiError(500, "Error occured while cancelling appointment!", [
          error,
        ])
      );
  }
};

const viewTimeslots = async (req: Request, res: Response): Promise<any> => {
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

    return res.status(200).json(new ApiResponse(200, timeSlots));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "internal server error", [error]));
  }
};

const getPatientHistory = async (req: Request, res: Response) => {
  const patientId = (req as any).params;
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

    return res.status(200).json(new ApiResponse(200, history));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Failed to fetch patient history!"));
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

    return res
      .status(200)
      .json(new ApiResponse(200, "Time slot updated successfully!"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Failed to update timeslots"));
  }
};

const deleteTimeSlot = async (req: Request, res: Response) => {
  const timeSlotID = (req as any).params.timeSlotID;
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
      include: { appointment: true },
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

    return res
      .status(200)
      .json(new ApiResponse(200, "Time slot successfully deleted!"));
  } catch (error) {
    return res
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
): Promise<any> => {
  const userId = req.user?.id;
  const { status, upcoming } = req.query;

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
      select: {
        id: true,
        status: true,
        appointmentType: true,
        date: true,
        time: true,
        notes: true,
        consultationFee: true,
        createdAt: true,
        updatedAt: true,
        prescriptionId: true,
        patient: {
          select: {
            id: true,
            medicalHistory: true,
            user: {
              select: {
                name: true,
                profilePicture: true,
                email: true,
              },
            },
          },
        },
        timeSlot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: {
        timeSlot: {
          startTime: "asc",
        },
      },
    });

    const formattedAppointments = appointments.map((appointment: any) => ({
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

    return res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const getPendingAppointmentRequests = async (req: Request, res: Response): Promise<any> => {
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
      select: {
        id: true,
        status: true,
        appointmentType: true,
        date: true,
        time: true,
        notes: true,
        consultationFee: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            medicalHistory: true,
            user: {
              select: {
                name: true,
                email: true,
                profilePicture: true,
              },
            },
          },
        },
        timeSlot: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            consultationFee: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const formattedRequests = pendingRequests.map((request: any) => ({
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

    return res.status(200).json(new ApiResponse(200, formattedRequests));
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return res.status(500).json(new ApiError(500, "Failed to fetch pending requests!", [error]));
  }
};

const respondToAppointmentRequest = async (req: Request, res: Response): Promise<any> => {
  const appointmentId = req.params.appointmentId as string;
  const { action, rejectionReason, alternativeSlots } = req.body;
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

      updatedAppointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
        },
      });

      notification = await prisma.notification.create({
        data: {
          userId: appointment.patient.user.id,
          type: "APPOINTMENT_ACCEPTED",
          title: "Appointment Confirmed",
          message: `Your appointment with Dr. ${doctor.user.name} has been confirmed for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time}.`,
          appointmentId: appointment.id,
        },
      });

      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: TimeSlotStatus.BOOKED },
        });
      }

    } else {

      updatedAppointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.REJECTED,
          notes: rejectionReason || "Appointment request rejected by doctor",
        },
      });

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

      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { status: TimeSlotStatus.AVAILABLE },
        });
      }
    }

    sendEmail({
      to: appointment.patient.user.email,
      subject: action === "accept" ? "Appointment Confirmed" : "Appointment Request Declined",
      html: appointmentStatusTemplate(
        doctor.user.name,
        action === "accept" ? "CONFIRMED" : "REJECTED",
        new Date(appointment.date).toLocaleDateString(),
        appointment.time,
        action === "accept" ? undefined : rejectionReason
      ),
    }).catch((err: unknown) => console.error("Failed to send appointment status email:", err));

    return res.status(200).json(new ApiResponse(200, {
      appointment: updatedAppointment,
      notification,
      message: `Appointment request ${action}ed successfully`,
    }));

  } catch (error) {
    console.error("Error responding to appointment request:", error);
    return res.status(500).json(new ApiError(500, "Failed to process appointment request!", [error]));
  }
};

const getDoctorNotifications = async (req: Request, res: Response): Promise<any> => {
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

    return res.status(200).json(new ApiResponse(200, notifications));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json(new ApiError(500, "Failed to fetch notifications!", [error]));
  }
};

const markNotificationAsRead = async (req: Request, res: Response): Promise<any> => {
  const notificationId = req.params.notificationId as string;
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

    return res.status(200).json(new ApiResponse(200, { message: "Notification marked as read" }));
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json(new ApiError(500, "Failed to mark notification as read!", [error]));
  }
};

const addPrescriptionToAppointment = async (req: Request, res: Response): Promise<any> => {
  const appointmentId = req.params.appointmentId as string;
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

    await prisma.notification.create({
      data: {
        userId: updatedAppointment.patient.userId,
        type: "PRESCRIPTION_ADDED",
        title: "Prescription Available",
        message: "Your doctor has added a prescription for your appointment.",
        appointmentId: appointment.id,
      },
    });

    return res.status(200).json(new ApiResponse(200, { appointment: updatedAppointment, prescriptionId: prescription.id }, "Prescription saved"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Failed to add prescription", [error]));
  }
};

const markAppointmentCompleted = async (req: Request, res: Response): Promise<any> => {
  const appointmentId = req.params.appointmentId as string;
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

    return res.status(200).json(new ApiResponse(200, updated, "Appointment marked as completed"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, "Failed to mark appointment as completed", [error]));
  }
};

export {
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  generateBulkTimeSlots,
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
