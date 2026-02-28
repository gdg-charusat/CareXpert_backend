import cron from "node-cron";
import { PrismaClient, AppointmentStatus } from "@prisma/client";
import { sendFollowUpReminderEmail } from "./emailService";

const prisma = new PrismaClient();

/**
 * Send pending follow-up reminders
 * Queries appointments with follow-up dates in the next 7 days
 * and sends email reminders to patients
 */
export const sendPendingFollowUpReminders = async (): Promise<void> => {
  console.log("🔔 Running follow-up reminder job...");

  try {
    const today = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Find appointments needing follow-up reminders
    const appointments: any[] = await prisma.appointment.findMany({
      where: {
        followUpDate: {
          gte: today,
          lte: sevenDaysFromNow,
        },
        followUpSent: false,
        status: AppointmentStatus.COMPLETED,
      } as any,
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

    let successCount = 0;
    let failureCount = 0;

    console.log(`📋 Found ${appointments.length} appointments requiring follow-up reminders`);

    for (const appointment of appointments) {
      try {
        await sendFollowUpReminderEmail({
          patientName: appointment.patient.user.name,
          patientEmail: appointment.patient.user.email,
          doctorName: appointment.doctor.user.name,
          followUpDate: appointment.followUpDate!,
          previousAppointmentDate: appointment.date,
          notes: appointment.notes || undefined,
        });

        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            followUpSent: true,
            followUpSentAt: new Date(),
          } as any,
        });

        successCount++;
        console.log(`✓ Reminder sent for appointment ${appointment.id} to ${appointment.patient.user.email}`);
      } catch (error) {
        console.error(
          `✗ Failed to send reminder for appointment ${appointment.id}:`,
          error
        );
        failureCount++;
      }
    }

    console.log(
      `✅ Follow-up reminder job completed. Success: ${successCount}, Failed: ${failureCount}`
    );
  } catch (error) {
    console.error("❌ Error in follow-up reminder job:", error);
  }
};

/**
 * Schedule follow-up reminder job
 * Runs daily at 9:00 AM
 */
export const scheduleFollowUpReminders = (): void => {
  // Run daily at 9:00 AM (cron format: minute hour * * *)
  cron.schedule("0 9 * * *", async () => {
    await sendPendingFollowUpReminders();
  });

  console.log("📅 Follow-up reminder cron job scheduled (daily at 9:00 AM)");
};

/**
 * Initialize all cron jobs
 * Call this function from the main server file
 */
export const initializeCronJobs = (): void => {
  console.log("🚀 Initializing cron jobs...");
  scheduleFollowUpReminders();
  console.log("✅ All cron jobs initialized successfully");
};

/**
 * Manual trigger for testing
 * Call this to test the follow-up reminder system
 */
export const triggerFollowUpRemindersManually = async (): Promise<void> => {
  console.log("🔧 Manually triggering follow-up reminders...");
  await sendPendingFollowUpReminders();
};
