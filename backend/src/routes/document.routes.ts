import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { PDFParse } from "pdf-parse";

import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

// ---------------------------------------------
// FILE UPLOAD CONFIGURATION
// ---------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(
        new Error("Only PDF, PNG, JPEG and WebP files are supported."),
      );
      return;
    }

    callback(null, true);
  },
});

// ---------------------------------------------
// SUSPICIOUS CONTENT PATTERNS
// ---------------------------------------------

const suspiciousPatterns: {
  pattern: RegExp;
  description: string;
}[] = [
  {
    pattern:
      /share your otp|send (?:your )?otp|otp அனுப்ப|otp sollunga/i,
    description: "The document appears to request an OTP.",
  },
  {
    pattern:
      /share your password|send your password|password sollunga/i,
    description: "The document appears to request a password.",
  },
  {
    pattern:
      /urgent payment|immediate payment|pay immediately/i,
    description: "The document contains urgent payment language.",
  },
  {
    pattern:
      /you have won|prize winner|claim your reward/i,
    description: "The document contains a prize or reward claim.",
  },
  {
    pattern:
      /account suspended|account blocked|verify your account/i,
    description: "The document contains an account-security claim.",
  },
  {
    pattern:
      /உடனே பணம்|பரிசு வென்ற|உங்கள் கணக்கு முடக்க/i,
    description: "The document contains a potentially suspicious Tamil phrase.",
  },
  {
    pattern:
      /udane panam|otp anuppunga|unga account block/i,
    description: "The document contains a potentially suspicious Tanglish phrase.",
  },
];

// ---------------------------------------------
// DOCUMENT & IMAGE ANALYZER
// ---------------------------------------------

router.post(
  "/analyze",
  requireAuth,
  upload.single("document"),
  async (req: Request, res: Response): Promise<void> => {
    let pdfParser: PDFParse | undefined;

    try {
      // Check uploaded file
      if (!req.file) {
        res.status(400).json({
          success: false,
          message:
            "Upload a PDF or image using the document form-data field.",
        });
        return;
      }

      const isPDF = req.file.mimetype === "application/pdf";

      let extractedText = "";

      // -----------------------------------------
      // PDF TEXT EXTRACTION
      // -----------------------------------------

      if (isPDF) {
        pdfParser = new PDFParse({
          data: new Uint8Array(req.file.buffer),
        });

        const pdfResult = await pdfParser.getText();

        extractedText = pdfResult.text.trim();
      } else {
        // ---------------------------------------
        // IMAGE VALIDATION
        // ---------------------------------------

        const metadata = await sharp(req.file.buffer).metadata();

        if (!metadata.width || !metadata.height) {
          res.status(400).json({
            success: false,
            message: "Unable to read the uploaded image.",
          });
          return;
        }

        if (metadata.width * metadata.height > 16_000_000) {
          res.status(400).json({
            success: false,
            message: "Image dimensions are too large.",
          });
          return;
        }

        // ---------------------------------------
        // IMAGE PROCESSING
        // ---------------------------------------

        const processedImage = await sharp(req.file.buffer)
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();

        // ---------------------------------------
        // OCR TEXT EXTRACTION
        // ---------------------------------------

        const ocrResult = await Tesseract.recognize(
          processedImage,
          "eng",
        );

        extractedText = ocrResult.data.text.trim();
      }

      // -----------------------------------------
      // CHECK EXTRACTED TEXT
      // -----------------------------------------

      if (!extractedText) {
        res.status(422).json({
          success: false,
          message:
            "No readable text was found. The PDF may be scanned, empty, or unclear.",
        });
        return;
      }

      // -----------------------------------------
      // DETECT SUSPICIOUS INDICATORS
      // -----------------------------------------

      const evidence: string[] = [];

      for (const item of suspiciousPatterns) {
        if (item.pattern.test(extractedText)) {
          evidence.push(item.description);
        }
      }

      // -----------------------------------------
      // CALCULATE DEMO INDICATOR SCORE
      // -----------------------------------------

      const hasSuspiciousIndicators = evidence.length > 0;

      const riskScore = hasSuspiciousIndicators
        ? Math.min(evidence.length * 20, 100)
        : 0;

      const trustScore = 100 - riskScore;

      const threatCategory =
        riskScore >= 60
          ? "HIGH_RISK_INDICATORS"
          : riskScore > 0
            ? "SUSPICIOUS_INDICATORS"
            : "NO_RULES_TRIGGERED";

      if (!hasSuspiciousIndicators) {
        evidence.push(
          "No configured suspicious phrases were detected. This does not prove the document is safe.",
        );
      }

      // -----------------------------------------
      // SAFETY RECOMMENDATIONS
      // -----------------------------------------

      const recommendations = [
        "Verify the document sender independently.",
        "Never share OTPs, passwords, PINs or banking credentials.",
        "Confirm payment requests through official channels.",
        "Avoid opening unexpected links or attachments.",
        "Treat automated analysis as a preliminary check, not proof of fraud.",
      ];

      // -----------------------------------------
      // SAVE SCAN TO DATABASE
      // -----------------------------------------

      const authReq = req as AuthenticatedRequest;

      const scan = await prisma.scan.create({
        data: {
          userId: authReq.userId!,
          type: isPDF ? "DOCUMENT" : "IMAGE",
          status: "COMPLETED",
          inputSummary: `Document analysis: ${req.file.originalname}`.slice(
            0,
            1000,
          ),
          trustScore,
          scamProbability: riskScore,
          threatCategory,
          explanation:
            "The system extracted document text and checked configured suspicious phrases. These preliminary findings cannot establish whether a document is genuine or fraudulent.",
          evidence,
          recommendations,
        },
      });

      // -----------------------------------------
      // SUCCESS RESPONSE
      // -----------------------------------------

      res.status(200).json({
        success: true,
        scanId: scan.id,
        type: isPDF ? "DOCUMENT" : "IMAGE",
        fileName: req.file.originalname,
        extractedText: extractedText.slice(0, 10000),
        trustScore,
        scamProbability: riskScore,
        threatCategory,
        evidence,
        recommendations,
        verificationNote:
          "This analysis does not verify document authenticity or prove fraud.",
        scannedAt: scan.createdAt,
      });
    } catch (error) {
      console.error("Document analysis error:", error);

      res.status(500).json({
        success: false,
        message:
          "Unable to analyze this file. Please check the file and try again.",
      });
    } finally {
      // Release PDF parser resources
      if (pdfParser) {
        try {
          await pdfParser.destroy();
        } catch (cleanupError) {
          console.error(
            "PDF parser cleanup error:",
            cleanupError,
          );
        }
      }
    }
  },
);

export default router;