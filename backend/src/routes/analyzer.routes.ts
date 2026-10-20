import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { analyzeWithAI } from "../services/ai.service";

const router = Router();

// ========================================
// REQUEST VALIDATION
// ========================================

const analyzerSchema = z.object({
  type: z.enum(["URL", "EMAIL", "MESSAGE"]),
  content: z.string().trim().min(1).max(10000),
});

type AnalysisType = "URL" | "EMAIL" | "MESSAGE";
type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

interface ScoredEvidence {
  indicator: string;
  riskLevel: RiskLevel;
  points: number;
  category: string;
}

// ========================================
// SUSPICIOUS PATTERNS
// English, Tamil and Tanglish
// ========================================

const suspiciousPatterns: {
  pattern: RegExp;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  points: number;
}[] = [
  // ========================================
  // ENGLISH
  // ========================================

  {
    pattern: /\burgent action required\b/i,
    description: "Urgent action is being demanded.",
    category: "URGENCY",
    riskLevel: "MEDIUM",
    points: 15,
  },
  {
    pattern: /\bverify your account\b/i,
    description: "The content requests account verification.",
    category: "ACCOUNT_SECURITY",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\baccount suspended\b|\baccount blocked\b|\baccount suspension\b/i,
    description: "The content claims an account is suspended or blocked.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /\bclick here immediately\b/i,
    description: "The content pressures the recipient to click a link.",
    category: "SUSPICIOUS_LINK",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\bshare your otp\b|\bsend (?:your )?otp\b|\bprovide (?:your )?otp\b|\benter your otp\b/i,
    description: "The content requests an OTP.",
    category: "OTP_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern:
      /\bshare your password\b|\bsend (?:your )?password\b|\bprovide (?:your )?password\b|\benter your password\b/i,
    description: "The content requests a password.",
    category: "CREDENTIAL_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern: /\bprize winner\b|\byou have won\b|\bclaim your reward\b/i,
    description: "The content uses a prize or reward claim.",
    category: "PRIZE_SCAM",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\blimited time offer\b|\bact now\b|\bimmediate payment\b|\bimmediately\b/i,
    description: "The content uses urgency or payment pressure.",
    category: "URGENCY",
    riskLevel: "MEDIUM",
    points: 15,
  },
  {
    pattern: /\bclick (?:the )?link to verify\b/i,
    description: "The recipient is asked to verify through a link.",
    category: "SUSPICIOUS_LINK",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\bbank account\b.{0,40}\b(?:blocked|suspended|closed)\b/i,
    description: "The content claims a bank account is at risk.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\b(?:send|transfer|pay)\s+(?:the\s+)?money\s+(?:now|immediately|urgently)\b/i,
    description: "The content demands an urgent money transfer.",
    category: "PAYMENT_PRESSURE",
    riskLevel: "MEDIUM",
    points: 20,
  },

  // ========================================
  // TAMIL
  // ========================================

  {
    pattern: /உடனே பணம்/,
    description: "Tamil phrase requesting immediate money.",
    category: "PAYMENT_PRESSURE",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /உங்கள் கணக்கு முடக்க/,
    description: "Tamil phrase claiming an account is blocked.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /(?:otp|ஓடிபி).{0,25}(?:அனுப்ப|பகிர|சொல்ல)/i,
    description: "Tamil phrase requesting an OTP.",
    category: "OTP_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern: /பரிசு வென்ற|பரிசு கிடைத்த/,
    description: "Tamil prize or reward claim.",
    category: "PRIZE_SCAM",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /உடனடியாக கிளிக்/,
    description: "Tamil phrase pressuring the recipient to click.",
    category: "SUSPICIOUS_LINK",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /வங்கி கணக்கு.{0,40}முடக்க/,
    description: "Tamil phrase about a potentially blocked bank account.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern: /ரகசிய எண்ணை பகிர/,
    description: "Tamil phrase asking to share a secret code.",
    category: "CREDENTIAL_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern: /உங்கள் ஓடிபி|உங்கள் OTP/i,
    description: "Tamil message mentioning the recipient's OTP.",
    category: "OTP_MENTION",
    riskLevel: "LOW",
    points: 5,
  },

  // ========================================
  // TANGLISH
  // ========================================

  {
    pattern:
      /\bunga(?:l)? account\b.{0,50}\b(?:block|suspend|mudakk|close|closed)\b/i,
    description: "Tanglish phrase claiming an account is blocked.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\botp\b.{0,40}\b(?:anuppunga|sollunga|share pannunga|kudunga|kodunga|send pannunga)\b/i,
    description: "Tanglish phrase requesting an OTP.",
    category: "OTP_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern:
      /\botp\b.{0,40}\b(?:share pannalana|share pannalena|share pannavittal|kodukkalana|kudukkalana)\b/i,
    description: "Tanglish message using a conditional OTP-sharing threat.",
    category: "OTP_THREAT",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern:
      /\b(?:password|pin)\b.{0,35}\b(?:sollunga|anuppunga|share pannunga|kudunga|kodunga)\b/i,
    description: "Tanglish phrase requesting a password or PIN.",
    category: "CREDENTIAL_REQUEST",
    riskLevel: "HIGH",
    points: 35,
  },
  {
    pattern: /\bneenga prize\b.{0,25}\b(?:win|vetr|jeich)\w*/i,
    description: "Tanglish prize claim.",
    category: "PRIZE_SCAM",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\budane\b.{0,30}\b(?:panam|payment)\b.{0,30}\b(?:anuppunga|pannunga|pay pannunga)\b/i,
    description: "Tanglish phrase demanding immediate payment.",
    category: "PAYMENT_PRESSURE",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\blink\b.{0,20}\bclick pannunga\b|\blink ah click pannunga\b/i,
    description: "Tanglish phrase asking the recipient to click a link.",
    category: "SUSPICIOUS_LINK",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\bbank account\b.{0,40}\b(?:block aagum|block aagidum|mudakkapadum|close aagidum)\b/i,
    description: "Tanglish phrase threatening a bank account.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\baccount\b.{0,30}\b(?:close aagidum|block aagidum|suspend aagum)\b/i,
    description: "Tanglish phrase threatening account closure or blocking.",
    category: "ACCOUNT_THREAT",
    riskLevel: "MEDIUM",
    points: 20,
  },
  {
    pattern:
      /\b(?:otp|password|pin)\b.{0,30}\bshare pannalana\b/i,
    description:
      "Tanglish message threatening consequences if credentials are not shared.",
    category: "CREDENTIAL_THREAT",
    riskLevel: "HIGH",
    points: 35,
  },
];

// ========================================
// CATEGORY SCORE LIMITS
// ========================================

const CATEGORY_LIMITS: Record<string, number> = {
  URGENCY: 15,
  ACCOUNT_SECURITY: 20,
  ACCOUNT_THREAT: 20,
  SUSPICIOUS_LINK: 20,
  OTP_REQUEST: 35,
  OTP_THREAT: 35,
  OTP_MENTION: 5,
  CREDENTIAL_REQUEST: 35,
  CREDENTIAL_THREAT: 35,
  PRIZE_SCAM: 20,
  PAYMENT_PRESSURE: 20,

  URL_INVALID: 20,
  URL_HTTPS: 10,
  URL_CREDENTIALS: 35,
  URL_PUNYCODE: 15,
  URL_SECURITY_KEYWORD: 10,
  URL_IP_ADDRESS: 20,
  URL_LONG_HOSTNAME: 10,

  EMAIL_NO_ADDRESS: 5,
  EMAIL_SENDER_MISMATCH: 20,
  EMAIL_URGENT_SUBJECT: 15,
  EMAIL_REPLY_TO: 5,
};

// ========================================
// ANALYSIS HELPERS
// ========================================

function addEvidence(
  evidenceMap: Map<string, ScoredEvidence>,
  indicator: string,
  category: string,
  riskLevel: RiskLevel,
  points: number,
): void {
  // Only one evidence entry per category.
  if (evidenceMap.has(category)) {
    return;
  }

  evidenceMap.set(category, {
    indicator,
    category,
    riskLevel,
    points: Math.min(points, CATEGORY_LIMITS[category] ?? points),
  });
}

// ========================================
// MAIN RULE-BASED ANALYSIS
// ========================================

function analyzeContent(content: string, type: AnalysisType) {
  const normalizedContent = content.normalize("NFC");
  const evidenceMap = new Map<string, ScoredEvidence>();

  // English, Tamil and Tanglish rules.
  for (const item of suspiciousPatterns) {
    if (item.pattern.test(normalizedContent)) {
      addEvidence(
        evidenceMap,
        item.description,
        item.category,
        item.riskLevel,
        item.points,
      );
    }
  }

  // ========================================
  // URL CHECKS
  // ========================================

  if (type === "URL") {
    let url: URL | null = null;

    try {
      url = new URL(normalizedContent);
    } catch {
      addEvidence(
        evidenceMap,
        "The submitted URL could not be parsed.",
        "URL_INVALID",
        "MEDIUM",
        20,
      );
    }

    if (url) {
      if (url.protocol !== "https:") {
        addEvidence(
          evidenceMap,
          "The URL does not use HTTPS. This alone does not prove fraud.",
          "URL_HTTPS",
          "MEDIUM",
          10,
        );
      }

      if (url.username || url.password) {
        addEvidence(
          evidenceMap,
          "The URL contains embedded credentials.",
          "URL_CREDENTIALS",
          "HIGH",
          35,
        );
      }

      if (url.hostname.includes("xn--")) {
        addEvidence(
          evidenceMap,
          "The hostname contains an internationalized domain label. Review it carefully.",
          "URL_PUNYCODE",
          "MEDIUM",
          15,
        );
      }

      if (/login|verify|secure|account|bank/i.test(url.hostname)) {
        addEvidence(
          evidenceMap,
          "The hostname contains a security-sensitive keyword. This alone does not prove fraud.",
          "URL_SECURITY_KEYWORD",
          "LOW",
          10,
        );
      }

      const isIPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
      const isIPv6 =
        url.hostname.startsWith("[") && url.hostname.endsWith("]");

      if (isIPv4 || isIPv6) {
        addEvidence(
          evidenceMap,
          "The URL uses an IP address as its hostname.",
          "URL_IP_ADDRESS",
          "MEDIUM",
          20,
        );
      }

      if (url.hostname.length > 50) {
        addEvidence(
          evidenceMap,
          "The hostname is unusually long and should be reviewed.",
          "URL_LONG_HOSTNAME",
          "LOW",
          10,
        );
      }
    }
  }

  // ========================================
  // EMAIL CHECKS
  // ========================================

  if (type === "EMAIL") {
    const emailAddresses =
      normalizedContent.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      ) ?? [];

    if (emailAddresses.length === 0) {
      addEvidence(
        evidenceMap,
        "No email address was detected. Sender identity could not be assessed.",
        "EMAIL_NO_ADDRESS",
        "LOW",
        5,
      );
    }

    if (
      /from:\s*[^@\s]+@(gmail|outlook|yahoo)\.(com|in)\b/i.test(
        normalizedContent,
      ) &&
      /bank|account suspended|account suspension|verify your account/i.test(
        normalizedContent,
      )
    ) {
      addEvidence(
        evidenceMap,
        "The email combines a consumer email provider with a financial or account-security claim. Verify the sender independently.",
        "EMAIL_SENDER_MISMATCH",
        "MEDIUM",
        20,
      );
    }

    if (
      /subject:\s*.*(?:urgent|immediate|suspended|verify)/i.test(
        normalizedContent,
      )
    ) {
      addEvidence(
        evidenceMap,
        "The email subject contains urgency or account-verification language.",
        "EMAIL_URGENT_SUBJECT",
        "MEDIUM",
        15,
      );
    }

    if (/reply to:\s*[^@\s]+@[^@\s]+/i.test(normalizedContent)) {
      addEvidence(
        evidenceMap,
        "A Reply-To address is present. Compare it with the claimed sender before replying.",
        "EMAIL_REPLY_TO",
        "LOW",
        5,
      );
    }
  }

  // ========================================
  // CALCULATE SCORE
  // ========================================

  const scoredEvidence = [...evidenceMap.values()];

  const rawScore = scoredEvidence.reduce(
    (total, item) => total + item.points,
    0,
  );

  const riskScore = Math.max(0, Math.min(rawScore, 100));
  const trustScore = 100 - riskScore;

  // FIX: HIGH-risk evidence takes priority over the score threshold.
  // For example, a password request scores 35 but is still high risk.
  const hasHighRiskEvidence = scoredEvidence.some(
    (item) => item.riskLevel === "HIGH",
  );

  let threatCategory: string;

  if (hasHighRiskEvidence || riskScore >= 60) {
    threatCategory = "HIGH_RISK_INDICATORS";
  } else if (riskScore >= 20) {
    threatCategory = "SUSPICIOUS_INDICATORS";
  } else {
    threatCategory = "NO_RULES_TRIGGERED";
  }

  const evidence = scoredEvidence.map((item) => item.indicator);

  const explanation =
    evidence.length > 0
      ? `This preliminary ${type.toLowerCase()} scan found ${evidence.length} distinct risk category/categories. Similar indicators are grouped by category to reduce duplicate scoring. The score is heuristic, not a calibrated probability. Review the evidence below.`
      : "No configured suspicious rules were triggered. This does not establish that the content is safe.";

  const recommendations =
    evidence.length > 0
      ? [
          "Do not share passwords, OTPs, PINs, or banking credentials.",
          "Verify requests using the organisation's official website or phone number.",
          "Avoid opening unexpected links or attachments.",
          "Do not transfer money based only on a message or email.",
          "Check the sender address and destination carefully.",
        ]
      : [
          "Verify the sender and destination independently.",
          "Never share passwords, OTPs, or PINs.",
          "Check links carefully before entering sensitive information.",
        ];

  return {
    trustScore,
    scamProbability: riskScore,
    threatCategory,
    explanation,
    evidence,
    scoredEvidence,
    recommendations,
  };
}

// ========================================
// POST /api/analyzer/analyze
// Rule-based analysis + optional AI
// ========================================

router.post(
  "/analyze",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = analyzerSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Invalid analyzer request",
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const { type, content } = parsed.data;

      // Validate URL input.
      if (type === "URL") {
        let parsedUrl: URL;

        try {
          parsedUrl = new URL(content);
        } catch {
          res.status(400).json({
            success: false,
            message: "Enter a valid URL beginning with http:// or https://",
          });
          return;
        }

        if (
          !["http:", "https:"].includes(parsedUrl.protocol) ||
          !parsedUrl.hostname
        ) {
          res.status(400).json({
            success: false,
            message: "Enter a valid HTTP or HTTPS URL",
          });
          return;
        }
      }

      // Always run local checks even if AI is unavailable.
      const result = analyzeContent(content, type);

      let aiAnalysis: {
        summary: string;
        riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
        evidence: string[];
        recommendations: string[];
      } | null = null;

      let aiStatus: "available" | "unavailable" = "unavailable";

      try {
        aiAnalysis = await analyzeWithAI({ content, type });
        aiStatus = "available";
      } catch (aiError) {
        console.warn(
          "AI analysis unavailable. Using rule-based results only.",
          aiError instanceof Error ? aiError.message : "Unknown AI error",
        );
      }

      // Combine evidence without inventing extra score points.
      const evidence = [
        ...new Set([
          ...result.evidence,
          ...(aiAnalysis?.evidence ?? []),
        ]),
      ];

      const recommendations = [
        ...new Set([
          ...result.recommendations,
          ...(aiAnalysis?.recommendations ?? []),
        ]),
      ];

      const explanation = aiAnalysis
        ? `${aiAnalysis.summary} Rule-based checks: ${result.explanation}`
        : `${result.explanation} AI analysis was unavailable; only rule-based checks were used.`;

      // Save scan history.
      const scan = await prisma.scan.create({
        data: {
          userId: authReq.userId!,
          type,
          status: "COMPLETED",
          inputSummary: content.slice(0, 1000),
          trustScore: result.trustScore,
          scamProbability: result.scamProbability,
          threatCategory: result.threatCategory,
          explanation,
          evidence,
          recommendations,
        },
      });

      res.status(200).json({
        success: true,
        scanId: scan.id,
        type,

        trustScore: result.trustScore,
        scamProbability: result.scamProbability,
        threatCategory: result.threatCategory,

        explanation,
        evidence,
        scoredEvidence: result.scoredEvidence,
        recommendations,

        aiStatus,
        analysisMode:
          aiStatus === "available" ? "RULES_AND_AI" : "RULES_ONLY",

        aiAnalysis: aiAnalysis
          ? {
              summary: aiAnalysis.summary,
              riskLevel: aiAnalysis.riskLevel,
              evidence: aiAnalysis.evidence,
              recommendations: aiAnalysis.recommendations,
            }
          : null,

        scoringNote:
          "The displayed risk indicator score is heuristic, not a statistically calibrated scam probability. Similar indicators are grouped by category. The rules and weights have not been validated against a representative dataset.",

        limitation:
          aiStatus === "available"
            ? "AI findings can be mistaken. This report does not prove whether content is genuine or fraudulent."
            : "AI analysis did not complete. This report uses configured rule-based checks only and does not prove whether content is genuine or fraudulent.",

        scannedAt: scan.createdAt,
      });
    } catch (error) {
      console.error("Analyzer error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to analyze this content",
      });
    }
  },
);

export default router;