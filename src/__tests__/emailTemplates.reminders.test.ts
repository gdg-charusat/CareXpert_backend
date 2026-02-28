import {
  patientAppointmentReminderTemplate,
  doctorAppointmentReminderTemplate,
  appointmentReminderTemplate,
} from "../utils/emailService";

describe("Email Templates - Appointment Reminders", () => {
  const testData = {
    patientName: "John Doe",
    doctorName: "Smith",
    appointmentDate: "March 15, 2026",
    appointmentTime: "10:00 AM",
    clinicLocation: "Downtown Clinic",
  };

  describe("patientAppointmentReminderTemplate", () => {
    it("should generate patient-specific email with correct greeting", () => {
      const html = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain(`Hi ${testData.patientName}`);
      
      // Patient should see "your upcoming appointment with Dr. [name]"
      expect(html).toContain(`your upcoming appointment with <strong>Dr. ${testData.doctorName}</strong>`);
      
      // Should NOT say "appointment with [patient name]"
      expect(html).not.toContain(`appointment with <strong>${testData.patientName}</strong>`);
    });

    it("should include appointment details in patient email", () => {
      const html = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "IN_PERSON"
      );

      expect(html).toContain(testData.appointmentDate);
      expect(html).toContain(testData.appointmentTime);
      expect(html).toContain(testData.clinicLocation);
      expect(html).toContain("In-Person");
    });

    it("should show 'Video Call' label for ONLINE appointments", () => {
      const html = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain("Video Call");
      expect(html).not.toContain("In-Person");
    });

    it("should include patient-specific instructions", () => {
      const html = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "IN_PERSON"
      );

      // Patient-specific instructions about arriving early
      expect(html).toContain("Please arrive 10 minutes early");
      expect(html).toContain("reschedule or cancel");
    });

    it("should have 'Appointment Reminder' as the header", () => {
      const html = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain("📅 Appointment Reminder");
    });
  });

  describe("doctorAppointmentReminderTemplate", () => {
    it("should generate doctor-specific email with correct greeting", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      // Doctor should be greeted with "Dr." prefix
      expect(html).toContain(`Hi Dr. ${testData.doctorName}`);
      
      // Doctor should see "your upcoming appointment with [patient name]"
      expect(html).toContain(`your upcoming appointment with <strong>${testData.patientName}</strong>`);
      
      // Should NOT say "appointment with Dr. [doctor name]"
      expect(html).not.toContain(`appointment with <strong>Dr. ${testData.doctorName}</strong>`);
    });

    it("should include patient name prominently in doctor email", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      // Patient name should appear in the details section
      expect(html).toContain(`<strong>👤 Patient:</strong> ${testData.patientName}`);
    });

    it("should include appointment details in doctor email", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "IN_PERSON"
      );

      expect(html).toContain(testData.appointmentDate);
      expect(html).toContain(testData.appointmentTime);
      expect(html).toContain(testData.clinicLocation);
      expect(html).toContain("In-Person");
    });

    it("should show 'Video Call' label for ONLINE appointments", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain("Video Call");
      expect(html).not.toContain("In-Person");
    });

    it("should include doctor-specific instructions for ONLINE appointments", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain("video consultation");
      expect(html).toContain("Please ensure you're prepared");
    });

    it("should include doctor-specific instructions for IN_PERSON appointments", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "IN_PERSON"
      );

      expect(html).toContain("in-person visit");
      expect(html).toContain("Please ensure you're prepared");
    });

    it("should have 'Upcoming Appointment' as the header", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(html).toContain("📅 Upcoming Appointment");
    });

    it("should NOT include patient-specific instructions about arriving early", () => {
      const html = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "IN_PERSON"
      );

      // This is patient-specific instruction, not for doctors
      expect(html).not.toContain("Please arrive 10 minutes early");
    });
  });

  describe("Content Differentiation", () => {
    it("should have different main message for patient vs doctor", () => {
      const patientHtml = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      const doctorHtml = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      // Different greetings
      expect(patientHtml).toContain(`Hi ${testData.patientName}`);
      expect(doctorHtml).toContain(`Hi Dr. ${testData.doctorName}`);

      // Different main messages
      expect(patientHtml).toContain(`Dr. ${testData.doctorName}`);
      expect(doctorHtml).toContain(`${testData.patientName}`);

      // Doctor email includes patient field, patient email doesn't
      expect(doctorHtml).toContain("👤 Patient:");
      expect(patientHtml).not.toContain("👤 Patient:");
    });

    it("should have different headers for patient vs doctor", () => {
      const patientHtml = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      const doctorHtml = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(patientHtml).toContain("Appointment Reminder");
      expect(doctorHtml).toContain("Upcoming Appointment");
    });
  });

  describe("appointmentReminderTemplate (deprecated)", () => {
    it("should delegate to patientAppointmentReminderTemplate for backward compatibility", () => {
      const recipientName = "Test Recipient";
      const html = appointmentReminderTemplate(
        recipientName,
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      // Should generate patient-style email
      expect(html).toContain(`Hi ${recipientName}`);
      expect(html).toContain("Appointment Reminder");
      expect(html).toContain(`Dr. ${testData.doctorName}`);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty clinic location gracefully", () => {
      const patientHtml = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        "",
        "ONLINE"
      );

      // Should default to "Online"
      expect(patientHtml).toContain("Online");
    });

    it("should handle null clinic location gracefully", () => {
      const doctorHtml = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        null as any,
        "ONLINE"
      );

      // Should default to "Online"
      expect(doctorHtml).toContain("Online");
    });

    it("should include automated message disclaimer in both templates", () => {
      const patientHtml = patientAppointmentReminderTemplate(
        testData.patientName,
        testData.doctorName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      const doctorHtml = doctorAppointmentReminderTemplate(
        testData.doctorName,
        testData.patientName,
        testData.appointmentDate,
        testData.appointmentTime,
        testData.clinicLocation,
        "ONLINE"
      );

      expect(patientHtml).toContain("automated message from CareXpert");
      expect(doctorHtml).toContain("automated message from CareXpert");
      expect(patientHtml).toContain("Please do not reply");
      expect(doctorHtml).toContain("Please do not reply");
    });
  });
});
