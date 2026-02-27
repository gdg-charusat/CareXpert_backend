import prisma from "./prismClient";
import { ApiError } from "./ApiError";

export const validateBlockedDates = async (
  doctorId: string,
  appointmentStart: Date,
  appointmentEnd: Date
): Promise<void> => {
  // Normalize the date to UTC day boundaries
  const checkDate = new Date(appointmentStart);
  checkDate.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(checkDate);
  endOfDay.setUTCDate(checkDate.getUTCDate() + 1);

  // Find all blocks for this doctor on this date
  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      doctorId,
      date: {
        gte: checkDate,
        lt: endOfDay,
      },
    },
  });

  for (const block of blockedDates) {
    // If full day block exists, reject
    if (block.isFullDay) {
      throw new ApiError(
        400,
        `Doctor is unavailable on ${checkDate.toDateString()}`
      );
    }

    // Check for time range overlap
    if (block.startTime && block.endTime) {
      const [blockStartHour, blockStartMin] = block.startTime
        .split(":")
        .map(Number);
      const [blockEndHour, blockEndMin] = block.endTime
        .split(":")
        .map(Number);

      const blockStart = new Date(checkDate);
      blockStart.setUTCHours(blockStartHour, blockStartMin, 0, 0);
      const blockEnd = new Date(checkDate);
      blockEnd.setUTCHours(blockEndHour, blockEndMin, 0, 0);

      let normalizedBlockEnd = blockEnd;
      if (blockEnd <= blockStart) {
        normalizedBlockEnd = new Date(blockEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const apptStart = new Date(appointmentStart);
      let apptEnd = new Date(appointmentEnd);
      if (apptEnd <= apptStart) {
        apptEnd = new Date(apptEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      // Check if ranges overlap
      if (apptStart < normalizedBlockEnd && apptEnd > blockStart) {
        let blockReason = "";
        if (block.reason) {
          blockReason = ` (${block.reason})`;
        }
        throw new ApiError(
          400,
          `Doctor is unavailable during ${block.startTime}-${block.endTime}${blockReason}`
        );
      }

    }
  }
};
