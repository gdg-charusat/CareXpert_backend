import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import { isValidUUID } from "../utils/helper";

/**
 * Log a new symptom for the authenticated patient
 * POST /symptom/log
 */
export const logSymptom = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user || !user.patient?.id) {
      res.status(401).json(new ApiError(401, "Patient profile not found"));
      return;
    }

    const { symptomText } = req.body;

    // Validation
    if (!symptomText || typeof symptomText !== "string" || symptomText.trim() === "") {
      res
        .status(400)
        .json(
          new ApiError(400, "Symptom text is required and must be a non-empty string")
        );
      return;
    }

    // Create the symptom
    const symptom = await prisma.symptom.create({
      data: {
        symptomText: symptomText.trim(),
        patientId: user.patient.id,
      },
    });

    res
      .status(201)
      .json(
        new ApiResponse(201, symptom, "Symptom logged successfully")
      );
  } catch (error) {
    console.error("Error in logSymptom:", error);
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

/**
 * Get all logged symptoms for the authenticated patient
 * GET /symptom/history
 */
export const getSymptomHistory = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user || !user.patient?.id) {
      res.status(401).json(new ApiError(401, "Patient profile not found"));
      return;
    }

    // Retrieve all symptoms for the patient
    const symptoms = await prisma.symptom.findMany({
      where: {
        patientId: user.patient.id,
      },
      orderBy: {
        symptomText: "asc", // Order alphabetically, adjust as needed
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, symptoms, "Symptoms retrieved successfully")
      );
  } catch (error) {
    console.error("Error in getSymptomHistory:", error);
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

/**
 * Delete a logged symptom by ID (only if it belongs to the authenticated patient)
 * DELETE /symptom/:symptomId
 */
export const deleteSymptom = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { symptomId } = req.params;

    if (!user || !user.patient?.id) {
      res.status(401).json(new ApiError(401, "Patient profile not found"));
      return;
    }

    // Validate symptomId format
    if (!symptomId || !isValidUUID(symptomId)) {
      res.status(400).json(new ApiError(400, "Invalid symptom ID"));
      return;
    }

    // Check if symptom exists and belongs to the patient
    const symptom = await prisma.symptom.findUnique({
      where: { id: symptomId },
    });

    if (!symptom) {
      res.status(404).json(new ApiError(404, "Symptom not found"));
      return;
    }

    // Privacy check: ensure the symptom belongs to the authenticated patient
    if (symptom.patientId !== user.patient.id) {
      res
        .status(403)
        .json(
          new ApiError(403, "Unauthorized: You can only delete your own symptoms")
        );
      return;
    }

    // Delete the symptom
    await prisma.symptom.delete({
      where: { id: symptomId },
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, null, "Symptom deleted successfully")
      );
  } catch (error) {
    console.error("Error in deleteSymptom:", error);
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};
