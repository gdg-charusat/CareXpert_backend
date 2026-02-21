import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "./ApiError";

// Define the user type that will be attached to the request
export interface UserInRequest {
  id: string;
  role: Role;
  name?: string;
  email?: string;
  // Add other common user properties here
  [key: string]: any; // Allow additional properties
}

// Extend Express Request type to include our user
declare global {
  namespace Express {
    interface Request {
      user?: UserInRequest;
    }
  }
}

// Role enum is imported from @prisma/client

export enum AppointmentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export const isDoctor = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!(req as any).user || (req as any).user.role !== Role.DOCTOR) {
    res
      .status(403)
      .json(new ApiError(403, "Unauthorized: Doctor access required"));
    return;
  }
  next();
};

export const isPatient = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!(req as any).user || (req as any).user.role !== Role.PATIENT) {
    res
      .status(403)
      .json(new ApiError(403, "Unauthorized: Patient access required"));
    return;
  }
  next();
};

export const isAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!(req as any).user || (req as any).user.role !== Role.ADMIN) {
    res
      .status(403)
      .json(new ApiError(403, "Unauthorized: Admin access required"));
    return;
  }
  next();
};

export const doctorOrAdminAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (
    !(req as any).user ||
    ((req as any).user.role !== Role.DOCTOR &&
      (req as any).user.role !== Role.ADMIN)
  ) {
    res
      .status(403)
      .json(new ApiError(403, "Unauthorized: Doctor or Admin access required"));
    return;
  }
  next();
};

export const formatDate = (dateString: string): string => {
  try {
    const [year, month, day] = dateString.split("-");
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");
    const isoDate = new Date(
      `${year}-${paddedMonth}-${paddedDay}`
    ).toISOString();
    return isoDate;
  } catch (error) {
    throw new ApiError(400, "Invalid date format. Please use YYYY-MM-DD");
  }
};

export const validateAppointmentStatus = (status: string): boolean => {
  return ["PENDING", "COMPLETED", "CANCELLED"].includes(status.toUpperCase());
};

export const generateRandomPassword = (length: number = 12): string => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one character from each category
  password += charset.charAt(Math.floor(Math.random() * 26)); // Uppercase
  password += charset.charAt(26 + Math.floor(Math.random() * 26)); // Lowercase
  password += charset.charAt(52 + Math.floor(Math.random() * 10)); // Number
  password += charset.charAt(62 + Math.floor(Math.random() * 8)); // Special char

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset.charAt(randomIndex);
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

export const generateToken = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export const validateMedicalHistory = (history: string): boolean => {
  // Basic validation - can be extended based on requirements
  return history.length >= 5 && history.length <= 1000;
};

export const validateSymptoms = (symptoms: string[]): boolean => {
  return symptoms.every(
    (symptom) =>
      symptom.length >= 3 &&
      symptom.length <= 200 &&
      /^[a-zA-Z0-9\s\-.,]+$/.test(symptom)
  );
};

export const validatePrescription = (prescription: string): boolean => {
  return prescription.length >= 10 && prescription.length <= 2000;
};

export const validateClinicLocation = (location: string): boolean => {
  return location.length >= 5 && location.length <= 200;
};

export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(id);
}

export const validateSpecialty = (specialty: string): boolean => {
  const validSpecialties = [
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Neurology",
    "Pediatrics",
    "Orthopedics",
    "Gynecology",
    "Ophthalmology",
    "ENT",
    "Dentistry",
  ];
  return validSpecialties.includes(specialty);
};

// Appointment validation and management helpers
export const validateAppointmentDate = (date: Date): boolean => {
  const now = new Date();
  const appointmentDate = new Date(date);

  // Appointment must be in the future
  if (appointmentDate <= now) {
    return false;
  }

  // Appointment must be within next 6 months
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  return appointmentDate <= sixMonthsFromNow;
};

export const validateAppointmentNotes = (notes: string): boolean => {
  return notes.length <= 500; // Maximum 500 characters for appointment notes
};

// Patient history helpers
export const validatePatientHistoryNotes = (notes: string): boolean => {
  return notes.length >= 10 && notes.length <= 2000;
};

export const formatPatientHistoryDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Medical data validation helpers
export const validateMedicalRecord = (record: {
  symptoms: string[];
  medicalHistory?: string;
  notes?: string;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (
    !record.symptoms ||
    !Array.isArray(record.symptoms) ||
    record.symptoms.length === 0
  ) {
    errors.push("At least one symptom is required");
  } else if (!validateSymptoms(record.symptoms)) {
    errors.push("Invalid symptoms format");
  }

  if (record.medicalHistory && !validateMedicalHistory(record.medicalHistory)) {
    errors.push("Medical history must be between 5 and 1000 characters");
  }

  if (record.notes && record.notes.length > 1000) {
    errors.push("Notes must not exceed 1000 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Doctor availability helpers
export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  durationMinutes: number = 30
): string[] => {
  const slots: string[] = [];
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  while (start < end) {
    slots.push(
      start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
    start.setMinutes(start.getMinutes() + durationMinutes);
  }

  return slots;
};

// Prescription validation helpers
export const validatePrescriptionData = (prescription: {
  prescriptionText: string;
  dateIssued: Date;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!validatePrescription(prescription.prescriptionText)) {
    errors.push("Invalid prescription format");
  }

  const now = new Date();
  if (prescription.dateIssued > now) {
    errors.push("Prescription date cannot be in the future");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Clinic management helpers
export const validateClinicData = (clinic: {
  specialty: string;
  location: string;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!validateSpecialty(clinic.specialty)) {
    errors.push("Invalid specialty");
  }

  if (!validateClinicLocation(clinic.location)) {
    errors.push("Invalid clinic location");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Emergency contact validation
export const validateEmergencyContact = (contact: {
  name: string;
  relationship: string;
  phone: string;
}): boolean => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  const relationshipRegex = /^[a-zA-Z\s]{2,30}$/;

  return (
    nameRegex.test(contact.name) &&
    relationshipRegex.test(contact.relationship) &&
    phoneRegex.test(contact.phone)
  );
};

// Medical report formatting
export const formatMedicalReport = (data: {
  patientName: string;
  doctorName: string;
  date: Date;
  diagnosis: string;
  prescription?: string;
  notes?: string;
}): string => {
  const report = [
    "MEDICAL REPORT",
    "==============",
    `Patient: ${data.patientName}`,
    `Doctor: ${data.doctorName}`,
    `Date: ${formatPatientHistoryDate(data.date)}`,
    "\nDIAGNOSIS",
    "---------",
    data.diagnosis,
  ];

  if (data.prescription) {
    report.push("\nPRESCRIPTION", "------------", data.prescription);
  }

  if (data.notes) {
    report.push("\nADDITIONAL NOTES", "----------------", data.notes);
  }

  return report.join("\n");
};
