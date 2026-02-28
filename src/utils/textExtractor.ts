import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { fromBuffer } from "pdf2pic";

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        
      }
    }
  }
}

export interface TextExtractionResult {
  text: string;
  mimeType: string;
  fileSize: number;
}

async function downloadFileFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`Failed to download file: HTTP ${response.statusCode}`)
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

export async function extractTextFromFile(
  filePath: string
): Promise<TextExtractionResult> {
  try {
    let fileBuffer: Buffer;
    let fileExt: string;

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      console.log("Downloading file from Cloudinary URL:", filePath);
      fileBuffer = await downloadFileFromUrl(filePath);
      
      const urlPath = new URL(filePath).pathname;
      fileExt = path.extname(urlPath).toLowerCase();
    } else {
      
      fileBuffer = await fs.promises.readFile(filePath);
      fileExt = path.extname(filePath).toLowerCase();
    }

    const mimeType = getMimeType(fileExt);
    const fileSize = fileBuffer.length;

    if (fileExt === ".pdf") {
      try {
        const text = await extractTextFromPdf(fileBuffer);
        
        if (!text || text.trim().length < 10) {
          console.log(
            "PDF text extraction returned minimal text, trying OCR..."
          );
          const ocrText = await extractTextFromPdfAsImage(fileBuffer);
          return { text: ocrText, mimeType, fileSize };
        }
        return { text, mimeType, fileSize };
      } catch (pdfError) {
        console.log(
          "PDF text extraction failed, trying OCR fallback...",
          pdfError
        );
        
        const ocrText = await extractTextFromPdfAsImage(fileBuffer);
        return { text: ocrText, mimeType, fileSize };
      }
    } else if ([".jpg", ".jpeg", ".png"].includes(fileExt)) {
      const text = await extractTextFromImage(fileBuffer);
      return { text, mimeType, fileSize };
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from file:", errorMessage);
    throw new Error(`Failed to extract text from file: ${errorMessage}`);
  }
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdf = await import("pdf-parse");
    const data = await pdf.default(pdfBuffer);
    return data.text;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from PDF:", errorMessage);
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

async function extractTextFromPdfAsImage(pdfBuffer: Buffer): Promise<string> {
  try {
    
    const convert = fromBuffer(pdfBuffer, {
      density: 100, 
      saveFilename: "page",
      savePath: "./temp",
      format: "png",
      width: 2000,
      height: 2000,
    });

    const results: any[] = await convert.bulk(-1); 
    let allText = "";

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`Processing PDF page ${i + 1}/${results.length}`);

      if (!result || !result.path || typeof result.path !== "string") {
        console.warn(`Skipping page ${i + 1}: No valid path found`);
        continue;
      }

      const imageBuffer = await fs.promises.readFile(result.path);

      const pageText = await extractTextFromImage(imageBuffer);
      allText += pageText + "\n";

      try {
        await fs.promises.unlink(result.path);
      } catch (cleanupError) {
        console.warn(
          "Warning: Could not clean up temporary file:",
          cleanupError
        );
      }
    }

    return allText.trim();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from PDF as image:", errorMessage);
    throw new Error(
      `Failed to extract text from PDF as image: ${errorMessage}`
    );
  }
}

import { createWorker } from "tesseract.js";

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  let worker: any = null;
  try {
    
    worker = await createWorker("eng");

    const {
      data: { text },
    } = await worker.recognize(imageBuffer);

    return text;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from image:", errorMessage);
    throw new Error(`Failed to extract text from image: ${errorMessage}`);
  } finally {
    
    if (worker && typeof worker.terminate === "function") {
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.warn("Error terminating Tesseract worker:", terminateError);
      }
    }
  }
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };

  if (!mimeTypes[ext]) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  return mimeTypes[ext];
}

export function validateFile(
  file: Express.Multer.File,
  maxSizeInBytes: number = 10 * 1024 * 1024
): void {
  if (file.size > maxSizeInBytes) {
    throw new Error(
      `File size exceeds the maximum allowed size of ${
        maxSizeInBytes / (1024 * 1024)
      } MB`
    );
  }

  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      `Unsupported file type: ${
        file.mimetype
      }. Allowed types: ${allowedMimeTypes.join(", ")}`
    );
  }
}
