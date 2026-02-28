import nodemailer from "nodemailer";
import { ApiError } from "./ApiError";
import { randomBytes } from "crypto";

export const generateVerificationToken = (): string => {
  // Preserve a short, URL-safe, string token (previously ~26 chars).
  // 13 bytes => 26 hex characters.
  return randomBytes(13).toString("hex");
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`✓ Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new ApiError(500, "Failed to send email");
  }
};

export const appointmentStatusTemplate = (
  doctorName: string,
  status: string,
  date: string,
  time: string,
  reason?: string
): string => {
  const statusColor = status === "CONFIRMED" ? "#28a745" : "#dc3545";
  const statusText = status === "CONFIRMED" ? "Confirmed" : "Declined";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0;">Appointment ${statusText}</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p>Your appointment with <strong>Dr. ${doctorName}</strong> on <strong>${date}</strong> at <strong>${time}</strong> has been <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>.</p>
        ${reason ? `<p>Reason: ${reason}</p>` : ""}
      </div>
    </div>
  `;
};

export const prescriptionTemplate = (
  doctorName: string,
  date: string
): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0;">New Prescription Available</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p>Dr. <strong>${doctorName}</strong> has issued a new prescription for you on <strong>${date}</strong>.</p>
        <p>Please log in to CareXpert to view your prescription details.</p>
      </div>
    </div>
  `;
};

/**
 * Email template for patient appointment reminder
 */
export const patientAppointmentReminderTemplate = (
  patientName: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string,
  appointmentType: string
): string => {
  const typeLabel = appointmentType === "ONLINE" ? "Video Call" : "In-Person";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0;">📅 Appointment Reminder</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Hi ${patientName},</p>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This is a friendly reminder about your upcoming appointment with <strong>Dr. ${doctorName}</strong>.
        </p>
        
        <div style="background-color: #e8f0ff; padding: 20px; border-left: 4px solid #667eea; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 8px 0; color: #333;"><strong>📅 Date:</strong> ${appointmentDate}</p>
          <p style="margin: 8px 0; color: #333;"><strong>⏰ Time:</strong> ${appointmentTime}</p>
          <p style="margin: 8px 0; color: #333;"><strong>📍 Location:</strong> ${clinicLocation || "Online"}</p>
          <p style="margin: 8px 0; color: #333;"><strong>📱 Type:</strong> ${typeLabel}</p>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Please arrive 10 minutes early for in-person appointments. If you need to reschedule or cancel, 
          please notify us as soon as possible.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
        <p style="color: #999; font-size: 12px;">
          This is an automated message from CareXpert. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
};

/**
 * Email template for doctor appointment reminder
 */
export const doctorAppointmentReminderTemplate = (
  doctorName: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string,
  appointmentType: string
): string => {
  const typeLabel = appointmentType === "ONLINE" ? "Video Call" : "In-Person";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0;">📅 Upcoming Appointment</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Hi Dr. ${doctorName},</p>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This is a reminder about your upcoming appointment with <strong>${patientName}</strong>.
        </p>
        
        <div style="background-color: #e8f0ff; padding: 20px; border-left: 4px solid #667eea; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 8px 0; color: #333;"><strong>👤 Patient:</strong> ${patientName}</p>
          <p style="margin: 8px 0; color: #333;"><strong>📅 Date:</strong> ${appointmentDate}</p>
          <p style="margin: 8px 0; color: #333;"><strong>⏰ Time:</strong> ${appointmentTime}</p>
          <p style="margin: 8px 0; color: #333;"><strong>📍 Location:</strong> ${clinicLocation || "Online"}</p>
          <p style="margin: 8px 0; color: #333;"><strong>📱 Type:</strong> ${typeLabel}</p>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Please ensure you're prepared for this ${appointmentType === "ONLINE" ? "video consultation" : "in-person visit"}.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        
        <p style="color: #999; font-size: 12px;">
          This is an automated message from CareXpert. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
};

/**
 * @deprecated Use patientAppointmentReminderTemplate or doctorAppointmentReminderTemplate instead
 */
export const appointmentReminderTemplate = (
  recipientName: string,
  patientName: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string,
  appointmentType: string
): string => {
  // Kept for backward compatibility - delegates to patient template
  return patientAppointmentReminderTemplate(
    recipientName,
    doctorName,
    appointmentDate,
    appointmentTime,
    clinicLocation,
    appointmentType
  );
};

export const sendVerificationEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    const verificationLink = `${process.env.EMAIL_VERIFICATION_URL}?token=${token}&email=${email}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Welcome to CareXpert!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Thank you for registering with CareXpert. To activate your account and verify your email address, 
            please click the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px; margin-top: 20px;">
            Or copy and paste this link in your browser:
          </p>
          <p style="color: #667eea; font-size: 12px; word-break: break-all;">
            ${verificationLink}
          </p>
          
          <p style="color: #666; font-size: 13px; margin-top: 20px;">
            This link will expire in 24 hours.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Verify Your CareXpert Email Address",
      html: htmlContent,
    });

  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new ApiError(500, "Failed to send verification email");
  }
};

export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    const transporter = createTransporter();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Email Verified Successfully!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Your email has been successfully verified. Your CareXpert account is now active and ready to use!
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            You can now log in and start using all the features of CareXpert.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #666; font-size: 13px;">
            If you have any questions, feel free to contact our support team.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Email Verified - Welcome to CareXpert!",
      html: htmlContent,
    });

  } catch (error) {
    console.error("Error sending welcome email:", error);
    
  }
};

export const sendAppointmentReminder = async (
  patientEmail: string,
  patientName: string,
  doctorEmail: string,
  doctorName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicLocation: string,
  appointmentType: string
): Promise<void> => {
  try {
    // Send personalized email to patient
    await sendEmail({
      to: patientEmail,
      subject: `Appointment Reminder - ${appointmentDate}`,
      html: patientAppointmentReminderTemplate(
        patientName,
        doctorName,
        appointmentDate,
        appointmentTime,
        clinicLocation,
        appointmentType
      ),
    });

    // Send personalized email to doctor
    await sendEmail({
      to: doctorEmail,
      subject: `Upcoming Appointment - ${appointmentDate}`,
      html: doctorAppointmentReminderTemplate(
        doctorName,
        patientName,
        appointmentDate,
        appointmentTime,
        clinicLocation,
        appointmentType
      ),
    });
  } catch (error) {
    console.error("Error sending appointment reminder:", error);
    throw error;
  }
}
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Password Reset Request</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            We received a request to reset your CareXpert account password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px; margin-top: 20px;">
            Or copy and paste this link in your browser:
          </p>
          <p style="color: #667eea; font-size: 12px; word-break: break-all;">
            ${resetLink}
          </p>
          
          <p style="color: #666; font-size: 13px; margin-top: 20px;">
            <strong>This link will expire in 30 minutes.</strong>
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px;">
            If you didn't request a password reset, please ignore this email or contact support if you have concerns.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            For security reasons, this password reset link will only work once.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Reset Your CareXpert Password",
      html: htmlContent,
    });

  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    throw new ApiError(500, "Failed to send password reset email");
  }
};

export const sendPasswordResetConfirmationEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    const transporter = createTransporter();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Password Changed Successfully</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hi ${name},</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            This is a confirmation that your CareXpert account password has been successfully changed.
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If you made this change, no further action is needed. You can now log in with your new password.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <p style="color: #dc3545; font-size: 13px; font-weight: bold;">
            ⚠️ Security Alert
          </p>
          
          <p style="color: #666; font-size: 13px;">
            If you did not make this change, please contact our support team immediately to secure your account.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Password Changed - CareXpert",
      html: htmlContent,
    });

  } catch (error) {
    console.error("Error sending password reset confirmation email:", error);
    // Don't throw error here - confirmation email failure shouldn't block password reset
  }
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
    const transporter = createTransporter();

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
    throw new ApiError(500, "Failed to send follow-up reminder email");
  }
};
