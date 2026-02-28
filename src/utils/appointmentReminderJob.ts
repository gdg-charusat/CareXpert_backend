import cron, { ScheduledTask } from "node-cron";
import prisma from "./prismClient";
import { sendAppointmentReminder, patientAppointmentReminderTemplate, doctorAppointmentReminderTemplate } from "./emailService";

const getEffectiveAppointmentDateTime = (
  appointmentDate: Date,
  appointmentTime: string
): Date => {
  const parsedDate = new Date(appointmentDate);
  const [hoursPart, minutesPart] = (appointmentTime || "").split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  ) {
    const mergedDateTime = new Date(parsedDate);
    mergedDateTime.setHours(hours, minutes, 0, 0);
    return mergedDateTime;
  }

  return parsedDate;
};

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
      const candidateStartDate = new Date(now);
      candidateStartDate.setHours(0, 0, 0, 0);
      const candidateEndDate = new Date(in24Hours);
      candidateEndDate.setHours(23, 59, 59, 999);

      // Find appointments that meet criteria:
      // - Candidate dates that can fall in next 24 hours
      // - Status is CONFIRMED or PENDING
      // - reminderSent is false
      const candidateAppointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: candidateStartDate,
            lte: candidateEndDate,
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

      const upcomingAppointments = candidateAppointments.filter((appointment) => {
        const appointmentDateTime = getEffectiveAppointmentDateTime(
          appointment.date,
          appointment.time
        );
        return appointmentDateTime >= now && appointmentDateTime <= in24Hours;
      });

      console.log(
        `Found ${upcomingAppointments.length} appointments to send reminders for`
      );

      // Process reminders with duplicate prevention for multi-instance scenarios
      // Strategy: Atomically claim each appointment before sending to prevent race conditions
      let sentCount = 0;
      let skippedCount = 0;
      
      for (const appointment of upcomingAppointments) {
        try {
          // ATOMIC CLAIM: Try to mark this appointment as being processed
          // This prevents duplicate reminders when multiple backend instances run
          const claimedAppointment = await prisma.appointment.updateMany({
            where: {
              id: appointment.id,
              reminderSent: false, // Only update if still false (optimistic locking)
            },
            data: { reminderSent: true },
          });

          // If count is 0, another instance already claimed this appointment
          if (claimedAppointment.count === 0) {
            console.log(
              ` Skipping appointment ${appointment.id}: already claimed by another instance`
            );
            skippedCount++;
            continue;
          }

          // This instance successfully claimed the appointment - proceed with sending
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
              `⚠️  Appointment ${appointment.id} claimed but missing email - marked as sent to prevent retry`
            );
            continue;
          }

          // Determine appointment mode (appointmentType: ONLINE or OFFLINE maps to IN_PERSON)
          const mode = appointment.appointmentType === "ONLINE" ? "ONLINE" : "IN_PERSON";

          // Send reminder emails to both patient and doctor in a single call
          await sendAppointmentReminder(
            patientEmail,
            patientName,
            doctorEmail,
            doctorName,
            appointmentDate,
            appointmentTime,
            clinicLocation,
            mode as "ONLINE" | "IN_PERSON"
          );

          sentCount++;
          console.log(
            `✅ Reminder sent for appointment ${appointment.id} (${patientName} - ${doctorName})`
          );
        } catch (error) {
          console.error(
            `❌ Failed to process reminder for appointment ${appointment.id}:`,
            error
          );
          // Continue with next appointment, don't fail the entire job
          // Note: If email send fails but claim succeeded, appointment stays marked as sent
          // to prevent infinite retries. Manual intervention may be needed.
        }
      }

      console.log(
        `📊 Reminder job summary: ${sentCount} sent, ${skippedCount} skipped (claimed by other instances)`
      );

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
