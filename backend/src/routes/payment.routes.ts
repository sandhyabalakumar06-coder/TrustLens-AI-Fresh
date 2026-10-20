import { Router, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error("Please upload a PNG, JPEG, or WebP image."),
      );
    }
  },
});

interface PaymentAnalysis {
  amount: string | null;
  transactionId: string | null;
  date: string | null;
  displayedStatus: string | null;

  classification:
    | "LOW_INDICATORS_DETECTED"
    | "SUSPICIOUS_INDICATORS_FOUND"
    | "INSUFFICIENT_INFORMATION";

  riskScore: number;
  trustScore: number;
  evidence: string[];
  recommendations: string[];
}

function extractAmount(text: string): string | null {
  const patterns = [
    /(?:₹|INR|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,

    /(?:amount|paid|payment)\s*[:\-]?\s*(?:₹|INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,

    /\b([0-9,]+\.[0-9]{2})\s*(?:INR|Rs\.?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/,/g, "");
    }
  }

  return null;
}

function extractTransactionId(
  text: string,
): string | null {
  const patterns = [
    /(?:transaction\s*(?:id|no|number)|txn\s*(?:id|no)?|UTR|reference\s*(?:no|number|id))\s*[:#\-]?\s*([A-Z0-9\-]{6,})/i,

    /\b([A-Z]{1,5}\d{8,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractDate(text: string): string | null {
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,

    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i,

    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
}

function extractDisplayedStatus(
  text: string,
): string | null {
  const normalized = text.toLowerCase();

  if (
    /\b(successful|success|completed|payment received|paid successfully)\b/.test(
      normalized,
    )
  ) {
    return "Successful (as displayed)";
  }

  if (
    /\b(pending|processing|in progress)\b/.test(normalized)
  ) {
    return "Pending (as displayed)";
  }

  if (
    /\b(failed|declined|unsuccessful)\b/.test(normalized)
  ) {
    return "Failed (as displayed)";
  }

  return null;
}

function analyzePaymentScreenshot(
  text: string,
): PaymentAnalysis {
  const evidence: string[] = [];
  const recommendations: string[] = [];

  const amount = extractAmount(text);
  const transactionId = extractTransactionId(text);
  const date = extractDate(text);
  const displayedStatus = extractDisplayedStatus(text);

  const normalizedText = text.toLowerCase();

  const suspiciousPatterns = [
    {
      pattern: /\b(fake|edited|modified|photoshop(?:ped)?)\b/i,
      message:
        "Text suggesting that the screenshot may be fake or edited was detected.",
    },
    {
      pattern:
        /\b(pay\s+now\s+to\s+receive|claim\s+your\s+payment|send\s+money\s+to\s+verify)\b/i,
      message:
        "Potentially suspicious payment-related wording was detected.",
    },
    {
      pattern:
        /\b(urgent|act\s+immediately|account\s+blocked)\b/i,
      message:
        "Urgency or pressure-related wording was detected.",
    },
  ];

  let suspiciousEvidence = false;

  for (const item of suspiciousPatterns) {
    if (item.pattern.test(normalizedText)) {
      evidence.push(item.message);
      suspiciousEvidence = true;
    }
  }

  // Add risk indicators for missing or unreadable details.
  let riskScore = 0;

  if (!text.trim()) {
    riskScore += 25;

    evidence.push(
      "OCR could not extract readable text from the screenshot.",
    );
  }

  if (!amount) {
    riskScore += 15;

    evidence.push(
      "No clearly recognizable payment amount was extracted.",
    );
  }

  if (!transactionId) {
    riskScore += 20;

    evidence.push(
      "No clearly recognizable transaction or reference ID was extracted.",
    );
  }

  if (!date) {
    riskScore += 10;

    evidence.push(
      "No clearly recognizable transaction date was extracted.",
    );
  }

  if (!displayedStatus) {
    riskScore += 10;

    evidence.push(
      "No recognizable payment status was extracted.",
    );
  }

  if (suspiciousEvidence) {
    riskScore += 25;
  }

  // Keep the score between 0 and 100.
  riskScore = Math.min(100, riskScore);

  // This is the inverse of the heuristic indicator score.
  // It does NOT prove that the payment is genuine.
  const trustScore = 100 - riskScore;

  let classification: PaymentAnalysis["classification"];

  if (suspiciousEvidence) {
    classification = "SUSPICIOUS_INDICATORS_FOUND";
  } else if (
    !text.trim() ||
    !amount ||
    !transactionId ||
    !date ||
    !displayedStatus
  ) {
    classification = "INSUFFICIENT_INFORMATION";
  } else {
    classification = "LOW_INDICATORS_DETECTED";
  }

  recommendations.push(
    "Verify the transaction in your official bank or UPI app.",
    "Do not rely on a screenshot alone as proof that money was received.",
    "Never share your UPI PIN, OTP, or banking password.",
  );

  return {
    amount,
    transactionId,
    date,
    displayedStatus,
    classification,
    riskScore,
    trustScore,
    evidence,
    recommendations,
  };
}

router.post(
  "/analyze",
  requireAuth,
  upload.single("paymentImage"),
  async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authenticated user ID is missing.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Please upload a payment screenshot.",
        });
        return;
      }

      // Preprocess the image before OCR.
      const processedImage = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .grayscale()
        .normalize()
        .png()
        .toBuffer();

      // Extract visible text.
      const ocrResult = await Tesseract.recognize(
        processedImage,
        "eng",
      );

      const extractedText = ocrResult.data.text.trim();

      const analysis =
        analyzePaymentScreenshot(extractedText);

      console.log("Payment screenshot OCR completed.");
      console.log("Extracted characters:", extractedText.length);
      console.log("Extracted amount:", analysis.amount);
      console.log("Extracted transaction ID:", analysis.transactionId);
      console.log("Extracted date:", analysis.date);
      console.log("Extracted status:", analysis.displayedStatus);
      console.log("Risk indicator score:", analysis.riskScore);
      console.log("Screenshot indicator score:", analysis.trustScore);

      const explanation =
        "This analysis extracts visible text and identifies limited suspicious indicators. " +
        "The screenshot indicator score is calculated from missing or unreadable fields and configured suspicious wording. " +
        "It cannot establish whether a payment actually occurred or whether the screenshot was edited. " +
        "Verify the transaction independently through your official bank or UPI application.";

      const scoreMeaning =
        "The suspicious indicator score reflects configured text indicators and missing transaction details. " +
        "It is not a verified probability of fraud.";

      // Save the numeric scores in the database.
      const scan = await prisma.scan.create({
        data: {
          userId,
          type: "PAYMENT_SCREENSHOT",
          status: "COMPLETED",

          inputSummary:
            extractedText.slice(0, 1000) ||
            "Payment screenshot uploaded; OCR extracted no readable text.",

          trustScore: analysis.trustScore,
          scamProbability: analysis.riskScore,

          threatCategory: analysis.classification,
          explanation,

          evidence:
            analysis.evidence as Prisma.InputJsonValue,

          recommendations:
            analysis.recommendations as Prisma.InputJsonValue,
        },
      });

      res.status(200).json({
        success: true,
        message: "Payment screenshot analyzed.",

        data: {
          scanId: scan.id,
          type: "PAYMENT_SCREENSHOT",

          verificationStatus: "UNVERIFIED",

          trustScore: analysis.trustScore,
          scamProbability: analysis.riskScore,

          scoreMeaning,
          classification: analysis.classification,

          extractedDetails: {
            amount: analysis.amount,
            transactionId: analysis.transactionId,
            date: analysis.date,
            displayedStatus: analysis.displayedStatus,
          },

          extractedText,
          evidence: analysis.evidence,
          recommendations: analysis.recommendations,
          explanation,

          verificationNote:
            "A screenshot cannot prove that money was transferred. Check the transaction in your official bank or UPI app.",

          createdAt: scan.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "Payment screenshot analysis error:",
        error,
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to analyze the payment screenshot.",
      });
    }
  },
);

export default router;