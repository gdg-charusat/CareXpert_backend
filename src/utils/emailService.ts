import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export const sendEmail = async ({ to, subject, html, text }: EmailOptions) => {
    try {
        const fromName = process.env.SMTP_FROM_NAME || "CareXpert";
        const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            text: text || "This email contains important information from CareXpert.",
            html,
        });
        console.log("Email sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        // We don't throw error to avoid blocking the API response as per requirements
        return null;
    }
};

// Templates
export const welcomeEmailTemplate = (name: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h1 style="color: #4A90E2; text-align: center;">Welcome to CareXpert!</h1>
    <p>Dear ${name},</p>
    <p>Thank you for joining CareXpert. We are thrilled to have you on board.</p>
    <p>Our platform connects patients with top doctors, making healthcare more accessible and efficient.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${process.env.FRONTEND_URL || '#'}" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
    </div>
    <p>If you have any questions, feel free to reply to this email.</p>
    <p>Best regards,<br>The CareXpert Team</p>
  </div>
`;

export const appointmentStatusTemplate = (doctorName: string, status: string, date: string, time: string, reason?: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="color: ${status === 'CONFIRMED' ? '#27AE60' : '#E74C3C'}; text-align: center;">
      Appointment ${status === 'CONFIRMED' ? 'Confirmed' : 'Declined'}
    </h2>
    <p>Your appointment with <strong>Dr. ${doctorName}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      ${reason ? `<p><strong>Note/Reason:</strong> ${reason}</p>` : ''}
    </div>
    <p>You can view more details in the CareXpert app.</p>
    <p>Best regards,<br>The CareXpert Team</p>
  </div>
`;

export const prescriptionTemplate = (doctorName: string, date: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="color: #4A90E2; text-align: center;">Prescription Available</h2>
    <p>A new prescription has been issued for your recent consultation with <strong>Dr. ${doctorName}</strong>.</p>
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Date Issued:</strong> ${date}</p>
    </div>
    <p>Please log in to the CareXpert app to view and download your prescription.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${process.env.FRONTEND_URL || '#'}/patient/prescriptions" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Prescription</a>
    </div>
    <p>Best regards,<br>The CareXpert Team</p>
  </div>
`;
