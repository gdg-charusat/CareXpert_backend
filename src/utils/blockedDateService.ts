import prisma from "./prismClient";
import { ApiError } from "./ApiError";

export const validateBlockedDates = async (
  doctorId: string,
  date: Date,
  startTime: string,
  endTime: string
): Promise<void> => {
  // Normalize the date to midnight (start of day)
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  // Find all blocks for this doctor on this date
  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      doctorId,
      date: checkDate,
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
      const blockStartTotalMin = blockStartHour * 60 + blockStartMin;
      const blockEndTotalMin = blockEndHour * 60 + blockEndMin;

      const [apptStartHour, apptStartMin] = startTime.split(":").map(Number);
      const [apptEndHour, apptEndMin] = endTime.split(":").map(Number);
      const apptStartTotalMin = apptStartHour * 60 + apptStartMin;
      const apptEndTotalMin = apptEndHour * 60 + apptEndMin;

      // Check if ranges overlap
      if (
        apptStartTotalMin < blockEndTotalMin &&
        apptEndTotalMin > blockStartTotalMin
      ) {
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
