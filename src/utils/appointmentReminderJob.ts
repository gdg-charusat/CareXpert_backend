import cron, { ScheduledTask } from "node-cron";
import prisma from "./prismClient";
import { sendAppointmentReminder } from "./emailService";

/**
 * Appointment reminder job - runs every 15 minutes
 * Finds appointments within the next 24 hours where reminderSent = false
 * and sends email reminders to both patient and doctor
 */
export const startAppointmentReminderJob = () => {
  // Run every 15 minutes: at 0, 15, 30, 45 minute marks
  const job = cron.schedule("*/15 * * * *", async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running appointment reminder job...`);

      // Calculate time ranges
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find appointments that meet criteria:
      // - Within next 24 hours
      // - Status is CONFIRMED or PENDING
      // - reminderSent is false
      const upcomingAppointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: now,
            lte: in24Hours,
          },
          status: {
            in: ["CONFIRMED", "PENDING"],
          },
          reminderSent: false,
        },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          doctor: {
            include: {
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

      console.log(
        `Found ${upcomingAppointments.length} appointments to send reminders for`
      );

      // Send reminders and update reminderSent flag
      for (const appointment of upcomingAppointments) {
        try {
          const patientName = appointment.patient?.user?.name || "Patient";
          const patientEmail = appointment.patient?.user?.email;
          const doctorName = appointment.doctor?.user?.name || "Doctor";
          const doctorEmail = appointment.doctor?.user?.email;
          const appointmentDate = new Date(appointment.date).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          );
          const appointmentTime = appointment.time || "N/A";
          const clinicLocation =
            appointment.doctor?.clinicLocation || "Online";

          if (!patientEmail || !doctorEmail) {
            console.warn(
              `Skipping appointment reminder for appointment ${appointment.id}: missing email`
            );
            continue;
          }

          // Send emails
          await sendAppointmentReminder(
            patientEmail,
            patientName,
            doctorEmail,
            doctorName,
            appointmentDate,
            appointmentTime,
            clinicLocation,
            appointment.appointmentType
          );

          // Mark reminder as sent
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { reminderSent: true },
          });

          console.log(
            `✅ Reminder sent for appointment ${appointment.id} (${patientName} - ${doctorName})`
          );
        } catch (error) {
          console.error(
            `❌ Failed to send reminder for appointment ${appointment.id}:`,
            error
          );
          // Continue with next appointment, don't fail the entire job
        }
      }

      console.log(`Appointment reminder job completed at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Error in appointment reminder job:", error);
    }
  });

  return job;
};

/**
 * Stop the appointment reminder job
 */
export const stopAppointmentReminderJob = (job: ScheduledTask) => {
  job.stop();
  console.log("Appointment reminder job stopped");
};
