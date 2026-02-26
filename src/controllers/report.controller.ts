import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prismClient";
import { AppError } from "../utils/AppError";
import { analyzeReport } from "../utils/analyzeReport";
import { extractTextFromFile, validateFile } from "../utils/textExtractor";
import * as fs from "fs/promises";
import * as path from "path";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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

    validateFile(file, MAX_FILE_SIZE_BYTES);

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
        abnormalValues: analysis.abnormal_values as any, 
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
    // authorization middleware has already verified and attached the report
    const report = (req as any).report;
    return res.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    return next(error);
  }
};
