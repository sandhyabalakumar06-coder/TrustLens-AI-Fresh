import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import jsQR from "jsqr";

import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

// Accept PNG, JPEG, and WebP images up to 5 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
      callback(new Error("Only PNG, JPEG, and WebP images are allowed."));
      return;
    }

    callback(null, true);
  },
});

// Known URL-shortening services.
// A domain is not considered a shortened URL just because its name
// contains "short", "link", or similar words.
const shortenedUrlPattern =
  /(?:^|\/\/)(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|shorturl\.at)(?::\d+)?(?:\/|$)/i;

router.post(
  "/scan",
  requireAuth,
  upload.single("qrImage"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Validate uploaded image.
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Upload a QR code image using the qrImage field.",
        });
        return;
      }

      // 2. Read image metadata.
      const metadata = await sharp(req.file.buffer).metadata();

      if (!metadata.width || !metadata.height) {
        res.status(400).json({
          success: false,
          message: "The uploaded image could not be processed.",
        });
        return;
      }

      // Protect against excessively large image dimensions.
      if (metadata.width * metadata.height > 16_000_000) {
        res.status(400).json({
          success: false,
          message: "Image dimensions are too large.",
        });
        return;
      }

      // 3. Normalize image before QR decoding.
      const { data, info } = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 4. Decode QR code.
      const qrCode = jsQR(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
      );

      if (!qrCode) {
        res.status(422).json({
          success: false,
          message: "No readable QR code was detected in this image.",
        });
        return;
      }

      const extractedContent = qrCode.data.trim();

      if (!extractedContent) {
        res.status(422).json({
          success: false,
          message: "The QR code does not contain readable text.",
        });
        return;
      }

      // 5. Identify URL content.
      const isUrl = /^https?:\/\//i.test(extractedContent);

      const evidence: string[] = [];

      let parsedUrl: URL | null = null;

      // 6. Check URL-related indicators.
      if (isUrl) {
        try {
          parsedUrl = new URL(extractedContent);
        } catch {
          evidence.push("The extracted URL could not be parsed.");
        }

        if (parsedUrl) {
          // Only inspect the hostname for shortening-service detection.
          // This avoids false positives from arbitrary URL text.
          if (shortenedUrlPattern.test(parsedUrl.hostname)) {
            evidence.push(
              "The QR content uses a known URL-shortening domain.",
            );
          }

          if (parsedUrl.protocol !== "https:") {
            evidence.push("The extracted URL does not use HTTPS.");
          }

          if (parsedUrl.username || parsedUrl.password) {
            evidence.push(
              "The extracted URL contains embedded credentials.",
            );
          }

          if (parsedUrl.hostname.includes("xn--")) {
            evidence.push(
              "The hostname contains an internationalized domain label.",
            );
          }

          if (/login|verify|secure|account|bank/i.test(parsedUrl.hostname)) {
            evidence.push(
              "The hostname contains a security-sensitive keyword. This alone does not prove fraud.",
            );
          }
        }
      } else {
        // 7. Inspect QR text for suspicious language.
        const suspiciousTextPatterns = [
          {
            pattern: /\burgent\b|\bimmediately\b|\bact now\b/i,
            evidence:
              "The QR content contains urgency-related language.",
          },
          {
            pattern: /\botp\b|\bpassword\b|\bpin\b/i,
            evidence:
              "The QR content mentions sensitive authentication information.",
          },
          {
            pattern: /\bpay now\b|\bsend money\b|\bpayment required\b/i,
            evidence:
              "The QR content requests or references a payment.",
          },
        ];

        for (const item of suspiciousTextPatterns) {
          if (item.pattern.test(extractedContent)) {
            evidence.push(item.evidence);
          }
        }
      }

      // 8. Calculate a heuristic risk indicator score.
      // This is a rules-based score, not a calibrated scam probability.
      const uniqueEvidence = [...new Set(evidence)];

      const riskScore = Math.min(uniqueEvidence.length * 20, 100);
      const trustScore = 100 - riskScore;

      let threatCategory: string;

      if (riskScore >= 60) {
        threatCategory = "HIGH_RISK_INDICATORS";
      } else if (riskScore >= 20) {
        threatCategory = "SUSPICIOUS_INDICATORS";
      } else {
        threatCategory = "NO_RULES_TRIGGERED";
      }

      // 9. Provide safety recommendations.
      const recommendations = [
        "Check the destination carefully before opening it.",
        "Never enter your OTP, PIN, or password on a page opened from an unexpected QR code.",
        "Verify payment details in your trusted banking or payment app.",
        "A QR scan alone cannot prove that a destination or payment is safe.",
      ];

      const explanation =
        uniqueEvidence.length > 0
          ? `The QR code was decoded successfully. ${uniqueEvidence.length} suspicious indicator(s) were found. These indicators are not proof of fraud.`
          : "The QR code was decoded successfully, but no configured suspicious rules were triggered. This does not guarantee safety.";

      // 10. Save scan to the database.
      const authReq = req as AuthenticatedRequest;

      const scan = await prisma.scan.create({
        data: {
          userId: authReq.userId!,
          type: "QR_CODE",
          status: "COMPLETED",
          inputSummary: `QR code: ${extractedContent}`.slice(0, 1000),
          trustScore,
          scamProbability: riskScore,
          threatCategory,
          explanation,
          evidence: uniqueEvidence,
          recommendations,
        },
      });

      // 11. Return scan result.
      res.status(200).json({
        success: true,
        scanId: scan.id,
        type: "QR_CODE",
        extractedContent,
        contentType: isUrl ? "URL" : "TEXT",
        trustScore,
        scamProbability: riskScore,
        threatCategory: scan.threatCategory,
        explanation: scan.explanation,
        evidence: uniqueEvidence,
        recommendations,
        scannedAt: scan.createdAt,
      });
    } catch (error) {
      console.error("QR scan error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to process the QR code image.",
      });
    }
  },
);

export default router;