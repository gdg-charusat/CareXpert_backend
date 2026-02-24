import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import { isValidUUID } from "../utils/helper";
import {
  TimeSlotStatus,
  AppointmentStatus,
  AppointmentType,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import cacheService from "../utils/cacheService";

const searchDoctors = async (req: any, res: Response) => {
  // Normalize query params (treat whitespace as empty)
  const specialty =
    typeof req.query.specialty === "string" ? req.query.specialty.trim() : "";
  const location =
    typeof req.query.location === "string" ? req.query.location.trim() : "";

  // Input validation: require at least one filter
  if (!specialty && !location) {
    return res
      .status(400)
      .json(
        new ApiError(
          400,
          "At least one search parameter (specialty or location) is required"
        )
      );
  }

  try {
    const cacheKey = `doctors:${specialty || "all"}:${location || "all"}`;
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return res.status(200).json(new ApiResponse(200, cached));
    }

    const doctors = await prisma.doctor.findMany({
      where: {
        AND: [
          specialty
            ? {
                specialty: {
                  contains: specialty,
                  mode: "insensitive", // Case-insensitive search
                },
              }
            : {},
          location
            ? {
                clinicLocation: {
                  contains: location,
                  mode: "insensitive", // Case-insensitive search
                },
              }
            : {},
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    await cacheService.set(cacheKey, doctors, 3600);
    return res.status(200).json(new ApiResponse(200, doctors));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, "Internal Server Error", [error]));
  }
};

const availableTimeSlots = async (req: any, res: Response): Promise<void> => {
  const { doctorId } = (req as any).params;
  const date = req.query.date as string | undefined;

  try {
    // Validate doctorId format
    if (!doctorId || !isValidUUID(doctorId)) {
      res.status(400).json(new ApiError(400, "Invalid Doctor ID"));
      return;
    }

    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "Doctor not available"));
      return;
    }

    // Build where condition
    const whereCondition: any = {
      doctorId,
      status: TimeSlotStatus.AVAILABLE,
    };

    if (date) {
      const selectedDate = new Date(date as string);
      if (isNaN(selectedDate.getTime())) {
        res
          .status(400)
          .json(
            new ApiError(400, "Invalid Date format use ISO format(YYYY-MM-DD)")
          );
        return;
      }

      // Set time range for the selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      whereCondition.startTime = {
        gte: startOfDay,
        lt: endOfDay,
      };
    }

    const availableSlots = await prisma.timeSlot.findMany({
      where: whereCondition,
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        doctor: {
          select: {
            specialty: true,
            clinicLocation: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Format the response
    const formattedSlots = availableSlots.map((slot: any) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
      doctorName: slot.doctor.user.name,
      specialty: slot.doctor.specialty,
      location: slot.doctor.clinicLocation,
    }));

    res.status(200).json(new ApiResponse(200, formattedSlots));
  } catch (error) {
    res.status(400).json(new ApiError(400, "Internal Server Error", [error]));
  }
};

const bookAppointment = async (req: any, res: Response): Promise<void> => {
  const { timeSlotId } = req.body;
  const userId = (req as any).user?.id;

  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: { id: true },
  });

  try {
    // Validate patient is logged in and has a patient profile
    if (!patient) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can book appointments!"));
      return;
    }

    // Validate timeSlotId
    if (!timeSlotId) {
      res.status(400).json(new ApiError(400, "Time slot id is required"));
      return;
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: any) => {
      // Get the time slot and check if it's available
      const timeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
        include: {
          doctor: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!timeSlot) {
        throw new ApiError(404, "Time slot not found");
      }

      if (timeSlot.status !== TimeSlotStatus.AVAILABLE) {
        throw new ApiError(400, "Time slot is already booked");
      }

      // Check if patient already has an appointment at this time
      const existingAppointment = await tx.appointment.findFirst({
        where: {
          status: {
            in: [
              AppointmentStatus.COMPLETED,
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
            ],
          },
          patientId: patient.id,
          timeSlot: {
            startTime: { lt: timeSlot.endTime },
            endTime: { gt: timeSlot.startTime },
          },
        },
      });

      if (existingAppointment) {
        throw new ApiError(400, "You already have an appointment at this time");
      }

      // Atomically mark the time slot as BOOKED to avoid race conditions
      const updateResult = await tx.timeSlot.updateMany({
        where: { id: timeSlotId, status: TimeSlotStatus.AVAILABLE },
        data: { status: TimeSlotStatus.BOOKED },
      });

      if (updateResult.count === 0) {
        throw new ApiError(400, "Time slot is already booked");
      }

      const appointment = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: timeSlot.doctorId,
          timeSlotId,
          date: timeSlot.startTime,
          time: timeSlot.startTime.toTimeString().slice(0, 5),
          status: AppointmentStatus.PENDING,
        },
        include: {
          patient: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          doctor: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
              specialty: true,
              clinicLocation: true,
            },
          },
          timeSlot: true,
        },
      });

      const updatedTimeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      return { appointment, updatedTimeSlot };
    });

    // Format the response
    const formattedAppointment = {
      id: result?.appointment.id,
      status: result?.appointment.status,
      patientName: result?.appointment.patient.user.name,
      doctorName: result?.appointment.doctor.user.name,
      specialty: result?.appointment.doctor.specialty,
      location: result?.appointment.doctor.clinicLocation,
      appointmentTime: {
        start: result?.appointment.timeSlot?.startTime,
        end: result?.appointment.timeSlot?.endTime,
      },
    };

    res.status(200).json(
      new ApiResponse(200, {
        data: formattedAppointment,
        message: "Appointment request sent successfully",
      })
    );
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json(error);
      return;
    }

    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

const fetchAllDoctors = async (req: any, res: Response) => {
  try {
    const doctorss = await prisma.doctor.findMany({
      include: {
        user: {
          select: {
            name: true,
            profilePicture: true,
          },
        },
      },
    });

    const doctors = await Promise.all(
      doctorss.map(async (doctor: any) => {
        const nextSlot = await prisma.timeSlot.findFirst({
          where: {
            doctorId: doctor.id,
            startTime: {
              gte: new Date(),
            },
            status: TimeSlotStatus.AVAILABLE,
          },
          orderBy: {
            startTime: "asc",
          },
          select: {
            id: true,
            consultationFee: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        });

        return {
          ...doctor,
          nextAvailable: nextSlot || null,
        };
      })
    );

    res.status(200).json(new ApiResponse(200, doctors));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
    return;
  }
};

const getUpcomingAppointments = async (
  req: any,
  res: Response
): Promise<void> => {
  const patientId = (req as any).user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can view their appointments!"));
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        timeSlot: {
          startTime: {
            gte: new Date(),
          },
        },
      },
      include: {
        doctor: {
          select: {
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
            specialty: true,
            clinicLocation: true,
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

    const formattedAppointments = appointments.map((appointment: any) => ({
      id: appointment.id,
      status: appointment.status,
      doctorName: appointment.doctor.user.name,
      profilePicture: appointment.doctor.user.profilePicture,
      specialty: appointment.doctor.specialty,
      location: appointment.doctor.clinicLocation,
      appointmentTime: {
        start: appointment.timeSlot?.startTime,
        end: appointment.timeSlot?.endTime,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const getPastAppointments = async (req: any, res: Response): Promise<void> => {
  const patientId = (req as any).user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can view their appointments!"));
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        timeSlot: {
          startTime: {
            lt: new Date(),
          },
        },
      },
      include: {
        doctor: {
          select: {
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
            specialty: true,
            clinicLocation: true,
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

    const formattedAppointments = appointments.map((appointment: any) => ({
      id: appointment.id,
      status: appointment.status,
      doctorName: appointment.doctor.user.name,
      profilePicture: appointment.doctor.user.profilePicture,
      specialty: appointment.doctor.specialty,
      location: appointment.doctor.clinicLocation,
      appointmentTime: {
        start: appointment.timeSlot?.startTime,
        end: appointment.timeSlot?.endTime,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const cancelAppointment = async (req: Request, res: Response) => {
  const { appointmentId } = (req as any).params;
  const patientId = (req as any).user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can cancel Appointments!"));
      return;
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment || patientId !== appointment.patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Appointment not found or Unauthorized"));
      return;
    } else if (appointment.status === AppointmentStatus.CANCELLED) {
      res.status(400).json(new ApiError(400, "Appointment already Cancelled!"));
      return;
    }

    await prisma.appointment.update({
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
      await cacheService.delPattern(`timeslots:*`);
    }
    res
      .status(200)
      .json(new ApiResponse(200, "Appointment Cancelled successfully!"));
  } catch (error) {
    res
      .status(400)
      .json(
        new ApiError(400, "Error occured while cancelling appointment!", [
          error,
        ])
      );
  }
};

const viewPrescriptions = async (req: Request, res: Response) => {
  const patientId = (req as any).user?.patient?.id;

  if (!patientId) {
    res
      .status(400)
      .json(new ApiError(400, "Only patients can view appointments!"));
    return;
  }
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            specialty: true,
            clinicLocation: true,
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        dateIssued: "desc",
      },
    });

    const formatted = prescriptions.map((p: any) => ({
      id: p.id,
      date: p.dateIssued,
      prescriptionText: p.prescriptionText,
      doctorName: p.doctor.user.name,
      specialty: p.doctor.specialty,
      clinicLocation: p.doctor.clinicLocation,
    }));

    res.status(200).json(new ApiResponse(200, formatted));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

function drawHorizontalLine(
  doc: PDFKit.PDFDocument,
  y: number,
  color: string = "#cccccc"
): void {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(40, y)
    .lineTo(doc.page.width - 40, y)
    .stroke()
    .restore();
}

const prescriptionPdf = async (req: Request, res: Response) => {
  try {
    const prescriptionId = (req as any).params.id as string;

    if (!prescriptionId || !isValidUUID(prescriptionId)) {
      res.status(400).json(new ApiResponse(400, "Invalid prescription id"));
      return;
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: {
          select: {
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
            specialty: true,
            clinicLocation: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      res.status(404).json(new ApiResponse(404, "Prescription not found"));
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=prescription_${prescriptionId}.pdf`
    );

    const doc = new PDFDocument({
      size: "A5",
      margins: { top: 40, bottom: 60, left: 40, right: 40 },
    });

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#333333")
      .text("PRESCRIPTION", { align: "center", underline: false });

    drawHorizontalLine(doc, 100, "#999999");
    doc.moveDown(2);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("Doctor Information:", { continued: false });
    doc.moveDown(0.5);

    // Doctor Name + Specialty
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Name       : Dr. ${prescription.doctor.user.name}`, {
        indent: 10,
      });
    doc.text(`Specialty  : ${prescription.doctor.specialty}`, { indent: 10 });
    doc.text(`Clinic        : ${prescription.doctor.clinicLocation}`, {
      indent: 10,
    });
    doc.text(`Email        : ${prescription.doctor.user.email}`, {
      indent: 10,
    });

    doc.moveDown(1);

    // Patient Section
    drawHorizontalLine(doc, doc.y, "#dddddd");
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("Patient Information:");
    doc.moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Name  : ${prescription.patient.user.name}`, { indent: 10 });
    doc.text(`Email : ${prescription.patient.user.email}`, { indent: 10 });

    doc.moveDown(1);

    // Date Issued & Prescription Text
    drawHorizontalLine(doc, doc.y, "#dddddd");
    doc.moveDown(0.5);

    const formattedDate = new Date(prescription.dateIssued).toLocaleDateString(
      "en-IN",
      { day: "2-digit", month: "long", year: "numeric" }
    );
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text(`Date Issued: `, { continued: true })
      .font("Helvetica")
      .text(formattedDate);

    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Prescription Details:");
    doc.moveDown(0.5);

    // Prescription Text Box
    const startX = doc.x;
    const boxWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const textOptions: PDFKit.Mixins.TextOptions = {
      width: boxWidth - 10,
      align: "left",
      indent: 5,
      lineGap: 4,
    };

    const boxTop = doc.y;
    const estimatedHeight =
      doc.heightOfString(prescription.prescriptionText, textOptions) + 20;

    doc
      .save()
      .rect(startX - 5, boxTop - 5, boxWidth + 10, estimatedHeight + 10)
      .fillOpacity(0.05)
      .fill("#cccccc")
      .restore();

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#000000")
      .text(prescription.prescriptionText, startX, boxTop, textOptions);

    doc.moveDown(2);

    const footerY = doc.page.height - doc.page.margins.bottom - 40;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(
        `Generated on ${new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        40,
        footerY,
        { align: "left" }
      );

    doc.text("Powered by CareXpert", 40, footerY + 15, { align: "left" });
    doc.end();
  } catch (error) {
    res.status(500).json(new ApiError(500, "internal server error", [error]));
  }
};

const cityRooms = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(new ApiError(401, "User not authenticated"));
    }

    const rooms = await prisma.room.findMany({
      include: {
        members: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
      },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, rooms, "City rooms fetched successfully"));
  } catch (error) {
    console.error("Error fetching city rooms:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", [error]));
  }
};

// New direct appointment booking functions
const bookDirectAppointment = async (
  req: any,
  res: Response
): Promise<void> => {
  const { doctorId, date, time, appointmentType, notes } = req.body;
  const patientId = req.user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can book appointments!"));
      return;
    }

    if (!doctorId || !date || !time) {
      res
        .status(400)
        .json(new ApiError(400, "doctorId, date, and time are required!"));
      return;
    }

    // Validate appointment type
    if (appointmentType && !["ONLINE", "OFFLINE"].includes(appointmentType)) {
      res
        .status(400)
        .json(
          new ApiError(400, "appointmentType must be 'ONLINE' or 'OFFLINE'!")
        );
      return;
    }

    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      res
        .status(400)
        .json(new ApiError(400, "Invalid date format. Use YYYY-MM-DD!"));
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      res
        .status(400)
        .json(new ApiError(400, "Invalid time format. Use HH:mm!"));
      return;
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json(new ApiError(404, "Doctor not found!"));
      return;
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!patient) {
      res.status(404).json(new ApiError(404, "Patient not found!"));
      return;
    }

    const existingPendingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId,
        doctorId,
        status: AppointmentStatus.PENDING,
      },
    });

    if (existingPendingAppointment) {
      res
        .status(409)
        .json(
          new ApiError(
            409,
            "You already have a pending appointment request with this doctor. Please wait for their response before making another request."
          )
        );
      return;
    }

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId,
        date: appointmentDate,
        time,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
    });

    if (existingAppointment) {
      res
        .status(409)
        .json(
          new ApiError(
            409,
            "An appointment already exists for this doctor at the specified date and time!"
          )
        );
      return;
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        date: appointmentDate,
        time,
        appointmentType: appointmentType || AppointmentType.OFFLINE,
        status: AppointmentStatus.PENDING,
        notes: notes || undefined,
      },
      include: {
        patient: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        doctor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            specialty: true,
            clinicLocation: true,
          },
        },
      },
    });

    const formattedAppointment = {
      id: appointment.id,
      status: appointment.status,
      appointmentType: appointment.appointmentType,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes,
      patientName: appointment.patient.user.name,
      doctorName: appointment.doctor.user.name,
      specialty: appointment.doctor.specialty,
      location: appointment.doctor.clinicLocation,
      createdAt: appointment.createdAt,
    };

    res.status(201).json(
      new ApiResponse(201, {
        data: formattedAppointment,
        message: "Appointment request sent successfully",
      })
    );
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

const getAllPatientAppointments = async (
  req: any,
  res: Response
): Promise<void> => {
  const patientId = req.user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can view their appointments!"));
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            user: {
              select: {
                name: true,
                profilePicture: true,
              },
            },
            specialty: true,
            clinicLocation: true,
            experience: true,
            education: true,
            bio: true,
            languages: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
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
      prescriptionId: (appointment as any).prescriptionId || null,
      doctor: {
        id: appointment.doctorId,
        name: appointment.doctor.user.name,
        profilePicture: appointment.doctor.user.profilePicture,
        specialty: appointment.doctor.specialty,
        clinicLocation: appointment.doctor.clinicLocation,
        experience: appointment.doctor.experience,
        education: appointment.doctor.education,
        bio: appointment.doctor.bio,
        languages: appointment.doctor.languages,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const getPatientNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
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
            doctor: {
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
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch notifications!", [error]));
  }
};

const markNotificationAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    res
      .status(200)
      .json(new ApiResponse(200, { message: "Notification marked as read" }));
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json(new ApiError(500, "Failed to mark notification as read!", [error]));
  }
};

const markAllNotificationsAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = (req as any).user?.id;

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, { message: "All notifications marked as read" }));
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json(
        new ApiError(500, "Failed to mark all notifications as read!", [error])
      );
  }
};

export {
  searchDoctors,
  availableTimeSlots,
  bookAppointment,
  getUpcomingAppointments,
  getPastAppointments,
  cancelAppointment,
  viewPrescriptions,
  prescriptionPdf,
  fetchAllDoctors,
  cityRooms,
  bookDirectAppointment,
  getAllPatientAppointments,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};