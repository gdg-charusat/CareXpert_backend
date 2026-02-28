import nodemailer from "nodemailer";

/**
 * Email Service for sending verification and notification emails
 */

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: process.env.SMTP_FROM || `"CareXpert" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationToken: string
): Promise<void> => {
  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`;

  // Escape user-provided data to prevent XSS
  const escapedName = escapeHtml(name);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white; 
          text-decoration: none; 
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to CareXpert!</h1>
        <p>Hello ${escapedName},</p>
        <p>Thank you for signing up for CareXpert. Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" class="button">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <div class="footer">
          <p>If you didn't create an account with CareXpert, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email - CareXpert",
    html,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetToken: string
): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

  // Escape user-provided data to prevent XSS
  const escapedName = escapeHtml(name);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white; 
          text-decoration: none; 
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Password Reset Request</h1>
        <p>Hello ${escapedName},</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <div class="footer">
          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Password - CareXpert",
    html,
  });
};

/**
 * Send password reset confirmation email
 */
export const sendPasswordResetConfirmationEmail = async (
  email: string,
  name: string
): Promise<void> => {
  const escapedName = escapeHtml(name);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Password Reset Successful</h1>
        <p>Hello ${escapedName},</p>
        <p>Your password has been successfully reset. You can now log in with your new password.</p>
        <p>If you did not make this change, please contact our support team immediately.</p>
        <div class="footer">
          <p>Best regards,<br>The CareXpert Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Password Reset Successful - CareXpert",
    html,
  });
};

/**
 * Prescription email template
 */
export const prescriptionTemplate = (doctorName: string, date: string): string => {
  const escapedDoctorName = escapeHtml(doctorName);
  const escapedDate = escapeHtml(date);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>New Prescription Available</h1>
        <p>Dr. ${escapedDoctorName} has issued a new prescription for you on ${escapedDate}.</p>
        <p>Please log in to your CareXpert account to view the details.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Patient appointment reminder email template
 */
export const patientAppointmentReminderTemplate = (
  patientName: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string | null,
  mode: "ONLINE" | "IN_PERSON"
): string => {
  const escapedPatientName = escapeHtml(patientName);
  const escapedDoctorName = escapeHtml(doctorName);
  const escapedDate = escapeHtml(appointmentDate);
  const escapedTime = escapeHtml(appointmentTime);
  const escapedLocation = clinicLocation ? escapeHtml(clinicLocation) : "Online";
  const appointmentType = mode === "ONLINE" ? "Video Call" : "In-Person";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Appointment Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${escapedPatientName},</p>
          <p>This is a reminder about your upcoming appointment with <strong>Dr. ${escapedDoctorName}</strong>.</p>
          <div class="details">
            <p><strong>📆 Date:</strong> ${escapedDate}</p>
            <p><strong>⏰ Time:</strong> ${escapedTime}</p>
            <p><strong>📍 Location:</strong> ${escapedLocation}</p>
            <p><strong>🏥 Type:</strong> ${appointmentType}</p>
          </div>
          <p>Please arrive 10 minutes early for your appointment. If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from CareXpert. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Doctor appointment reminder email template
 */
export const doctorAppointmentReminderTemplate = (
  doctorName: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string | null,
  mode: "ONLINE" | "IN_PERSON"
): string => {
  const escapedDoctorName = escapeHtml(doctorName);
  const escapedPatientName = escapeHtml(patientName);
  const escapedDate = escapeHtml(appointmentDate);
  const escapedTime = escapeHtml(appointmentTime);
  const escapedLocation = clinicLocation ? escapeHtml(clinicLocation) : "Online";
  const appointmentType = mode === "ONLINE" ? "Video Call" : "In-Person";
  const visitType = mode === "ONLINE" ? "video consultation" : "in-person visit";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Upcoming Appointment</h1>
        </div>
        <div class="content">
          <p>Hi Dr. ${escapedDoctorName},</p>
          <p>This is a reminder about your upcoming appointment with <strong>${escapedPatientName}</strong>.</p>
          <div class="details">
            <p><strong>👤 Patient:</strong> ${escapedPatientName}</p>
            <p><strong>📆 Date:</strong> ${escapedDate}</p>
            <p><strong>⏰ Time:</strong> ${escapedTime}</p>
            <p><strong>📍 Location:</strong> ${escapedLocation}</p>
            <p><strong>🏥 Type:</strong> ${appointmentType}</p>
          </div>
          <p>Please ensure you're prepared for this ${visitType}.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from CareXpert. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generic appointment reminder template (deprecated - use patientAppointmentReminderTemplate or doctorAppointmentReminderTemplate)
 * Kept for backward compatibility
 */
export const appointmentReminderTemplate = (
  recipientName: string,
  patientName: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string | null,
  mode: "ONLINE" | "IN_PERSON"
): string => {
  // Delegate to patient template for backward compatibility
  return patientAppointmentReminderTemplate(
    recipientName,
    doctorName,
    appointmentDate,
    appointmentTime,
    clinicLocation,
    mode
  );
};

/**
 * Send appointment reminder emails to both patient and doctor
 */
export const sendAppointmentReminder = async (
  patientEmail: string,
  patientName: string,
  doctorEmail: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string | null,
  mode: "ONLINE" | "IN_PERSON"
): Promise<void> => {
  // Send reminder to patient
  const patientHtml = patientAppointmentReminderTemplate(
    patientName,
    doctorName,
    appointmentDate,
    appointmentTime,
    clinicLocation,
    mode
  );

  await sendEmail({
    to: patientEmail,
    subject: "Appointment Reminder - CareXpert",
    html: patientHtml,
  });

  // Send reminder to doctor
  const doctorHtml = doctorAppointmentReminderTemplate(
    doctorName,
    patientName,
    appointmentDate,
    appointmentTime,
    clinicLocation,
    mode
  );

  await sendEmail({
    to: doctorEmail,
    subject: "Upcoming Appointment - CareXpert",
    html: doctorHtml,
  });
};

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  prescriptionTemplate,
  patientAppointmentReminderTemplate,
  doctorAppointmentReminderTemplate,
  appointmentReminderTemplate,
  sendAppointmentReminder,
};

/**
 * Interface for follow-up reminder email data
 */
export interface FollowUpEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  followUpDate: Date;
  previousAppointmentDate: Date;
  notes?: string;
}

/**
 * Send follow-up appointment reminder email
 */
export const sendFollowUpReminderEmail = async (
  data: FollowUpEmailData
): Promise<void> => {
  try {

    const followUpDateFormatted = new Date(data.followUpDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const previousDateFormatted = new Date(
      data.previousAppointmentDate
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px; }
          .details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px; }
          .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 4px; margin: 15px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .notes-section { background-color: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Follow-up Appointment Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${data.patientName},</p>
            
            <p>This is a friendly reminder about your scheduled follow-up appointment.</p>
            
            <div class="details">
              <p><strong>Doctor:</strong> Dr. ${data.doctorName}</p>
              <p><strong>Previous Appointment:</strong> ${previousDateFormatted}</p>
              <p><strong>Recommended Follow-up Date:</strong> ${followUpDateFormatted}</p>
            </div>
            
            ${
              data.notes
                ? `
              <div class="notes-section">
                <p><strong>📋 Clinical Notes:</strong></p>
                <p>${data.notes}</p>
              </div>
            `
                : ""
            }
            
            <p>Please book your follow-up appointment at your earliest convenience to ensure continuity of care.</p>
            
            <p><strong>To schedule your appointment, you can:</strong></p>
            <ul>
              <li>Visit our website and book online</li>
              <li>Call us at ${process.env.CLINIC_PHONE || "+1-234-567-8900"}</li>
              <li>Reply to this email</li>
            </ul>
            
            <center>
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/appointments" class="button">
                Book Appointment Now
              </a>
            </center>
          </div>
          <div class="footer">
            <p>Best regards,<br><strong>CareXpert Team</strong></p>
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@carexpert.com",
      to: data.patientEmail,
      subject: "Follow-up Appointment Reminder - CareXpert",
      html: emailHtml,
    });

    console.log(`✓ Follow-up reminder sent successfully to ${data.patientEmail}`);
  } catch (error) {
    console.error("Error sending follow-up reminder email:", error);
    throw new Error("Failed to send follow-up reminder email");
  }
};
