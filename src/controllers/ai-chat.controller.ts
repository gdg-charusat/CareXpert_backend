import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../utils/prismClient";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
};

interface GeminiResponse {
  probable_causes: string[];
  severity: "mild" | "moderate" | "severe";
  recommendation: string;
  disclaimer: string;
}

const isGeminiQuotaOrRateLimitError = (error: any): boolean => {
  const status = error?.status;
  const text = String(error?.message || "").toLowerCase();

  return (
    status === 429 ||
    text.includes("too many requests") ||
    text.includes("quota exceeded")
  );
};

export const processSymptoms = async (req: any, res: any) => {
  try {
    const { symptoms, language = "en" } = req.body;
    const userId = (req as any).user?.id;

    if (
      !symptoms ||
      typeof symptoms !== "string" ||
      symptoms.trim().length === 0
    ) {
      throw new ApiError(400, "Symptoms description is required");
    }

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const languageInstruction =
      language !== "en"
        ? `\n\nIMPORTANT: Respond in ${language} language. All text in the JSON response (probable_causes, recommendation, disclaimer) should be in ${language}. For the severity field, translate "mild", "moderate", and "severe" to the appropriate words in ${language}.`
        : "";

    const prompt = `You are an empathetic and accurate medical assistant AI. When given the user's symptoms in text, you should:

1. Interpret the symptoms, even if the description is brief or incomplete.
2. Identify probable causes related to the symptoms.
3. Determine the severity level, categorizing it as "mild", "moderate", or "severe".
4. Provide practical recommendations on what the user should do next, such as monitoring symptoms or consulting a doctor.
5. Include a disclaimer stating that the information is not a replacement for professional medical advice.

Your output must always be in JSON format exactly as specified below.

User symptoms: "${symptoms.trim()}"${languageInstruction}

Respond with ONLY a valid JSON object in this exact format:
{
  "probable_causes": ["Condition1", "Condition2"],
  "severity": "mild/moderate/severe",
  "recommendation": "Advice on what to do next",
  "disclaimer": "This is not a substitute for professional medical advice. Please consult a doctor for an accurate diagnosis."
}

Important: Respond with ONLY the JSON object, no additional text or formatting.`;

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponseText = response.text();

    let parsedResponse: GeminiResponse;
    try {
      const cleanedResponse = aiResponseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", aiResponseText);
      throw new ApiError(500, "Failed to parse AI response. Please try again.");
    }

    if (
      !parsedResponse.probable_causes ||
      !parsedResponse.severity ||
      !parsedResponse.recommendation ||
      !parsedResponse.disclaimer
    ) {
      console.error("Invalid response structure:", parsedResponse);
      throw new ApiError(500, "Invalid AI response format. Please try again.");
    }

    if (!["mild", "moderate", "severe"].includes(parsedResponse.severity)) {
      parsedResponse.severity = "moderate";
    }

    const aiChat = await prisma.aiChat.create({
      data: {
        userId,
        userMessage: symptoms.trim(),
        aiResponse: parsedResponse as any,
        probableCauses: parsedResponse.probable_causes,
        severity: parsedResponse.severity,
        recommendation: parsedResponse.recommendation,
        disclaimer: parsedResponse.disclaimer,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          parsedResponse,
          "AI analysis completed successfully",
        ),
      );
  } catch (error) {
    console.error("Error in processSymptoms:", error);

    if (isGeminiQuotaOrRateLimitError(error)) {
      return res.status(503).json(
        new ApiResponse(
          503,
          {
            provider: "gemini",
            reason: "quota_or_rate_limited",
          },
          "AI service is temporarily unavailable due to quota limits. Please try again shortly.",
        ),
      );
    }

    if (error instanceof ApiError) {
      res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    } else {
      res.status(500).json(new ApiResponse(500, null, "Internal server error"));
    }
  }
};

export const getChatHistory = async (req: any, res: any) => {
  try {
    const userId = (req as any).user?.id;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [chats, total] = await Promise.all([
      prisma.aiChat.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        skip,
        take: limitNum,
        select: {
          id: true,
          userMessage: true,
          aiResponse: true,
          probableCauses: true,
          severity: true,
          recommendation: true,
          disclaimer: true,
          createdAt: true,
        },
      }),
      prisma.aiChat.count({
        where: { userId },
      }),
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          chats,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
        "Chat history retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Error in getChatHistory:", error);

    if (error instanceof ApiError) {
      res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    } else {
      res.status(500).json(new ApiResponse(500, null, "Internal server error"));
    }
  }
};

export const getChatById = async (req: any, res: any) => {
  try {
    const { chatId } = (req as any).params;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    const chat = await prisma.aiChat.findFirst({
      where: {
        id: chatId,
        userId,
      },
      select: {
        id: true,
        userMessage: true,
        aiResponse: true,
        probableCauses: true,
        severity: true,
        recommendation: true,
        disclaimer: true,
        createdAt: true,
      },
    });

    if (!chat) {
      throw new ApiError(404, "Chat not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, chat, "Chat retrieved successfully"));
  } catch (error) {
    console.error("Error in getChatById:", error);

    if (error instanceof ApiError) {
      res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    } else {
      res.status(500).json(new ApiResponse(500, null, "Internal server error"));
    }
  }
};

export const clearChatHistory = async (req: any, res: any) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new ApiError(401, "User authentication required");
    }

    await prisma.aiChat.deleteMany({ where: { userId } });

    res
      .status(200)
      .json(new ApiResponse(200, { cleared: true }, "Chat history cleared"));
  } catch (error) {
    console.error("Error in clearChatHistory:", error);

    if (error instanceof ApiError) {
      res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    } else {
      res.status(500).json(new ApiResponse(500, null, "Internal server error"));
    }
  }
};
