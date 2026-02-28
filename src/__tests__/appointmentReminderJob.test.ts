import { startAppointmentReminderJob } from "../utils/appointmentReminderJob";
import * as emailService from "../utils/emailService";

// Mock dependencies
jest.mock("../utils/prismClient", () => {
  const m = {
    appointment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  return { __esModule: true, default: m };
});

jest.mock("../utils/emailService", () => ({
  sendAppointmentReminder: jest.fn(),
  patientAppointmentReminderTemplate: jest.fn(),
  doctorAppointmentReminderTemplate: jest.fn(),
}));

jest.mock("node-cron", () => ({
  default: {
    schedule: jest.fn((pattern, callback) => {
      // Store callback for manual execution in tests
      return { callback, start: jest.fn(), stop: jest.fn() };
    }),
  },
  schedule: jest.fn((pattern, callback) => {
    // Store callback for manual execution in tests
    return { callback, start: jest.fn(), stop: jest.fn() };
  }),
}));

import prisma from "../utils/prismClient";

const mockedPrisma = prisma as unknown as {
  appointment: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe("appointmentReminderJob", () => {
  let jobCallback: () => Promise<void>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console output in tests
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Start the job and capture the callback
    const job = startAppointmentReminderJob();
    jobCallback = (job as any).callback;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("Job Scheduling", () => {
    it("should schedule job to run every 15 minutes", () => {
      const nodeCron = require("node-cron");
      expect(nodeCron.schedule).toHaveBeenCalledWith(
        "*/15 * * * *",
        expect.any(Function)
      );
    });
  });

  describe("Duplicate Prevention - Race Condition", () => {
    it("should atomically claim appointment before sending to prevent duplicates", async () => {
      const mockAppointment = {
        id: "appt-1",
        date: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        time: "10:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "ONLINE",
        patient: {
          user: { name: "John Doe", email: "john@example.com" },
        },
        doctor: {
          user: { name: "Dr. Smith", email: "smith@example.com" },
          clinicLocation: "Main Clinic",
        },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      
      // Simulate successful claim (this instance gets the appointment)
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      await jobCallback();

      // Verify atomic claim was attempted with correct WHERE clause
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          id: "appt-1",
          reminderSent: false, // Critical: ensures only one instance can claim it
        },
        data: { reminderSent: true },
      });

      // Verify email was sent after successful claim
      expect(emailService.sendAppointmentReminder).toHaveBeenCalledTimes(1);
    });

    it("should skip appointment if another instance already claimed it (count = 0)", async () => {
      const mockAppointment = {
        id: "appt-2",
        date: new Date(Date.now() + 12 * 60 * 60 * 1000),
        time: "11:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "IN_PERSON",
        patient: {
          user: { name: "Jane Doe", email: "jane@example.com" },
        },
        doctor: {
          user: { name: "Dr. Jones", email: "jones@example.com" },
          clinicLocation: "Downtown",
        },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      
      // Simulate failed claim (another instance already marked it)
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      await jobCallback();

      // Verify claim was attempted
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);

      // Verify NO email was sent (appointment already claimed by another instance)
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();

      // Verify skip was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping appointment appt-2: already claimed")
      );
    });

    it("should handle multiple appointments with some claimed by other instances", async () => {
      const mockAppointments = [
        {
          id: "appt-a",
          date: new Date(Date.now() + 10 * 60 * 60 * 1000),
          time: "09:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Alice", email: "alice@example.com" } },
          doctor: { user: { name: "Dr. Adams", email: "adams@example.com" }, clinicLocation: "Clinic A" },
        },
        {
          id: "appt-b",
          date: new Date(Date.now() + 11 * 60 * 60 * 1000),
          time: "10:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "IN_PERSON",
          patient: { user: { name: "Bob", email: "bob@example.com" } },
          doctor: { user: { name: "Dr. Brown", email: "brown@example.com" }, clinicLocation: "Clinic B" },
        },
        {
          id: "appt-c",
          date: new Date(Date.now() + 12 * 60 * 60 * 1000),
          time: "11:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Charlie", email: "charlie@example.com" } },
          doctor: { user: { name: "Dr. Chen", email: "chen@example.com" }, clinicLocation: "Clinic C" },
        },
      ];

      mockedPrisma.appointment.findMany.mockResolvedValue(mockAppointments);
      
      // Simulate: this instance claims appt-a and appt-c, but appt-b was already claimed
      mockedPrisma.appointment.updateMany
        .mockResolvedValueOnce({ count: 1 }) // appt-a: success
        .mockResolvedValueOnce({ count: 0 }) // appt-b: already claimed
        .mockResolvedValueOnce({ count: 1 }); // appt-c: success

      await jobCallback();

      // Verify all 3 claims were attempted
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledTimes(3);

      // Verify only 2 emails were sent (for appt-a and appt-c)
      expect(emailService.sendAppointmentReminder).toHaveBeenCalledTimes(2);
      
      // Verify summary log shows correct counts
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2 sent, 1 skipped")
      );
    });
  });

  describe("Email Content Personalization", () => {
    it("should send different email content to patient vs doctor", async () => {
      const mockAppointment = {
        id: "appt-3",
        date: new Date(Date.now() + 15 * 60 * 60 * 1000),
        time: "14:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "ONLINE",
        patient: {
          user: { name: "Patient Name", email: "patient@example.com" },
        },
        doctor: {
          user: { name: "Dr. Doctor", email: "doctor@example.com" },
          clinicLocation: "Test Clinic",
        },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      await jobCallback();

      // Verify sendAppointmentReminder was called with correct parameters
      expect(emailService.sendAppointmentReminder).toHaveBeenCalledWith(
        "patient@example.com",
        "Patient Name",
        "doctor@example.com",
        "Dr. Doctor",
        expect.any(String), // formatted date
        "14:00",
        "Test Clinic",
        "ONLINE"
      );
    });
  });

  describe("Error Handling", () => {
    it("should skip appointment with missing patient email", async () => {
      const mockAppointment = {
        id: "appt-4",
        date: new Date(Date.now() + 10 * 60 * 60 * 1000),
        time: "09:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "ONLINE",
        patient: {
          user: { name: "No Email Patient", email: null }, // Missing email
        },
        doctor: {
          user: { name: "Dr. Test", email: "test@example.com" },
          clinicLocation: "Test Clinic",
        },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      await jobCallback();

      // Should claim the appointment to mark it as processed
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);

      // Should NOT send email
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("claimed but missing email")
      );
    });

    it("should skip appointment with missing doctor email", async () => {
      const mockAppointment = {
        id: "appt-5",
        date: new Date(Date.now() + 10 * 60 * 60 * 1000),
        time: "09:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "ONLINE",
        patient: {
          user: { name: "Patient", email: "patient@example.com" },
        },
        doctor: {
          user: { name: "Dr. No Email", email: null }, // Missing email
          clinicLocation: "Test Clinic",
        },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      await jobCallback();

      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("claimed but missing email")
      );
    });

    it("should continue processing other appointments if one fails", async () => {
      const mockAppointments = [
        {
          id: "appt-fail",
          date: new Date(Date.now() + 10 * 60 * 60 * 1000),
          time: "09:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Fail Patient", email: "fail@example.com" } },
          doctor: { user: { name: "Dr. Fail", email: "fail-doctor@example.com" }, clinicLocation: "Clinic" },
        },
        {
          id: "appt-success",
          date: new Date(Date.now() + 11 * 60 * 60 * 1000),
          time: "10:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Success Patient", email: "success@example.com" } },
          doctor: { user: { name: "Dr. Success", email: "success-doctor@example.com" }, clinicLocation: "Clinic" },
        },
      ];

      mockedPrisma.appointment.findMany.mockResolvedValue(mockAppointments);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      // First email send fails, second succeeds
      (emailService.sendAppointmentReminder as jest.Mock)
        .mockRejectedValueOnce(new Error("Email service down"))
        .mockResolvedValueOnce(undefined);

      await jobCallback();

      // Both appointments should be attempted
      expect(emailService.sendAppointmentReminder).toHaveBeenCalledTimes(2);

      // Error should be logged but job continues
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process reminder for appointment appt-fail"),
        expect.any(Error)
      );

      // Second appointment should still succeed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reminder sent for appointment appt-success")
      );
    });

    it("should not crash if database claim operation fails", async () => {
      const mockAppointment = {
        id: "appt-db-fail",
        date: new Date(Date.now() + 10 * 60 * 60 * 1000),
        time: "09:00",
        status: "CONFIRMED",
        reminderSent: false,
        appointmentType: "ONLINE",
        patient: { user: { name: "Patient", email: "patient@example.com" } },
        doctor: { user: { name: "Dr. Test", email: "doctor@example.com" }, clinicLocation: "Clinic" },
      };

      mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
      mockedPrisma.appointment.updateMany.mockRejectedValue(new Error("Database connection lost"));

      // Should not throw
      await expect(jobCallback()).resolves.not.toThrow();

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process reminder"),
        expect.any(Error)
      );

      // Should not send email since claim failed
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();
    });
  });

  describe("Query Logic", () => {
    it("should query candidate appointments from today start through window-day end", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      await jobCallback();

      const callArgs = mockedPrisma.appointment.findMany.mock.calls[0][0];
      const whereClause = callArgs.where;

      // Verify candidate date range query
      expect(whereClause.date.gte).toBeInstanceOf(Date);
      expect(whereClause.date.lte).toBeInstanceOf(Date);

      const candidateStart = whereClause.date.gte as Date;
      const candidateEnd = whereClause.date.lte as Date;

      expect(candidateStart.getHours()).toBe(0);
      expect(candidateStart.getMinutes()).toBe(0);
      expect(candidateStart.getSeconds()).toBe(0);
      expect(candidateStart.getMilliseconds()).toBe(0);

      expect(candidateEnd.getHours()).toBe(23);
      expect(candidateEnd.getMinutes()).toBe(59);
      expect(candidateEnd.getSeconds()).toBe(59);
      expect(candidateEnd.getMilliseconds()).toBe(999);
    });

    it("should send reminder for direct appointment using combined date and time within next 24 hours", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 1, 28, 10, 0, 0, 0));

      const mockAppointment = {
        id: "appt-direct-future",
        date: new Date(2026, 1, 28, 0, 0, 0, 0),
        time: "18:00",
        status: "PENDING",
        reminderSent: false,
        appointmentType: "OFFLINE",
        patient: {
          user: { name: "Future Patient", email: "future-patient@example.com" },
        },
        doctor: {
          user: { name: "Dr. Future", email: "future-doctor@example.com" },
          clinicLocation: "Future Clinic",
        },
      };

      try {
        mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);
        mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

        await jobCallback();

        expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);
        expect(emailService.sendAppointmentReminder).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("should not send reminder for direct appointment when combined date and time is already in the past", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 1, 28, 10, 0, 0, 0));

      const mockAppointment = {
        id: "appt-direct-past",
        date: new Date(2026, 1, 28, 0, 0, 0, 0),
        time: "09:00",
        status: "PENDING",
        reminderSent: false,
        appointmentType: "OFFLINE",
        patient: {
          user: { name: "Past Patient", email: "past-patient@example.com" },
        },
        doctor: {
          user: { name: "Dr. Past", email: "past-doctor@example.com" },
          clinicLocation: "Past Clinic",
        },
      };

      try {
        mockedPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);

        await jobCallback();

        expect(mockedPrisma.appointment.updateMany).not.toHaveBeenCalled();
        expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("should only query CONFIRMED or PENDING appointments", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      await jobCallback();

      const callArgs = mockedPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.status.in).toEqual(["CONFIRMED", "PENDING"]);
    });

    it("should only query appointments where reminderSent is false", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      await jobCallback();

      const callArgs = mockedPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.reminderSent).toBe(false);
    });

    it("should include patient and doctor user details", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      await jobCallback();

      const callArgs = mockedPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.include.patient.include.user.select).toMatchObject({
        name: true,
        email: true,
      });
      expect(callArgs.include.doctor.include.user.select).toMatchObject({
        name: true,
        email: true,
      });
    });
  });

  describe("Logging", () => {
    it("should log job start and completion", async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([]);

      await jobCallback();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Running appointment reminder job")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reminder job summary")
      );
    });

    it("should log count of appointments found", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          date: new Date(Date.now() + 10 * 60 * 60 * 1000),
          time: "09:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Patient 1", email: "p1@example.com" } },
          doctor: { user: { name: "Dr. 1", email: "d1@example.com" }, clinicLocation: "Clinic" },
        },
        {
          id: "appt-2",
          date: new Date(Date.now() + 11 * 60 * 60 * 1000),
          time: "10:00",
          status: "CONFIRMED",
          reminderSent: false,
          appointmentType: "ONLINE",
          patient: { user: { name: "Patient 2", email: "p2@example.com" } },
          doctor: { user: { name: "Dr. 2", email: "d2@example.com" }, clinicLocation: "Clinic" },
        },
      ];

      mockedPrisma.appointment.findMany.mockResolvedValue(mockAppointments);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });

      await jobCallback();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 appointments")
      );
    });
  });
});
