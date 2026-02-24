import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { analyzeReport } from "../utils/analyzeReport";
import { extractTextFromFile, validateFile } from "../utils/textExtractor";
import * as fs from "fs/promises";
import * as path from "path";

// Extend Express Request type to include user
// Using the global Request type from helper.ts

const prisma = new PrismaClient();

// Maximum file size: 10MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Uploads and processes a medical report
 */
export const createReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let file: Express.Multer.File | undefined;

  try {
    const user = (req as any).user;
    if (!user) {
      throw new AppError("Authentication required", 401);
    }

    if (user.role !== "PATIENT") {
      throw new AppError("Only patients can upload reports", 403);
    }

    const patientId = user.patient?.id;
    if (!patientId) {
      throw new AppError("Patient profile not found", 400);
    }

    file = req.file;
    if (!file) {
      throw new AppError("No file uploaded", 400);
    }

    // Validate file
    validateFile(file, MAX_FILE_SIZE_BYTES);

    // Create report in database with PROCESSING status
    const report = await prisma.report.create({
      data: {
        patientId,
        filename: file.originalname,
        fileUrl: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: "PROCESSING",
      },
    });

    // Process the file asynchronously
    processReportInBackground(
      report.id,
      file.path,
      patientId,
      file.originalname
    ).catch((error) => {
      console.error("Background processing error:", error);
    });

    return res.status(202).json({
      success: true,
      message: "Report is being processed",
      data: {
        reportId: report.id,
        status: "PROCESSING",
      },
    });
  } catch (error: unknown) {
    // Clean up uploaded file before forwarding the error
    if (file?.path) {
      try {
        await fs.unlink(file.path);
      } catch (fsError) {
        console.error("Error cleaning up file:", fsError);
      }
    }

    return next(error);
  }
};

/**
 * Processes the report file in the background
 */
async function processReportInBackground(
  reportId: string,
  filePath: string,
  patientId: string,
  filename: string
) {
  try {
    const {
      text: extractedText,
      mimeType,
      fileSize,
    } = await extractTextFromFile(filePath);

    const analysis = await analyzeReport(extractedText);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        extractedText,
        summary: analysis.summary,
        abnormalValues: analysis.abnormal_values as any, // properly typed
        possibleConditions: analysis.possible_conditions,
        recommendation: analysis.recommendation,
        disclaimer: analysis.disclaimer,
        status: "COMPLETED",
        mimeType,
        fileSize,
        filename,
      },
    });

    console.log(`Successfully processed report ${reportId}`);

    // Only delete local files, not Cloudinary URLs
    if (!filePath.startsWith("http://") && !filePath.startsWith("https://")) {
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch {
        console.warn(`File ${filePath} does not exist or cannot be deleted`);
      }
    } else {
      console.log(`Cloudinary file ${filePath} will remain in cloud storage`);
    }
  } catch (error) {
    console.error(`Error processing report ${reportId}:`, error);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Attempt cleanup - only for local files
    if (!filePath.startsWith("http://") && !filePath.startsWith("https://")) {
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch {}
    }
  }
}

/**
 * Gets a report by ID
 */
export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = (req as any).params;
    const user = (req as any).user;

    if (!user) {
      throw new AppError("Authentication required", 401);
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!report) {
      throw new AppError("Report not found", 404);
    }

    // Check if the user has permission to view this report
    if (user.role !== "ADMIN" && report.patientId !== user.patient?.id) {
      throw new AppError("You do not have permission to view this report", 403);
    }

    return res.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    return next(error);
  }
};
