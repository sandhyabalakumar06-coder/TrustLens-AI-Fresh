import { Router, type Request, type Response } from "express";

import { prisma } from "../lib/prisma";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

// ========================================
// GET /api/history/analytics
// Dashboard analytics for authenticated user
// ========================================

router.get(
  "/analytics",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId!;

      const [
        totalScans,
        scoredScans,
        highRiskScans,
        suspiciousScans,
        lowRiskScans,
        unscoredScans,
        scansByType,
        recentScans,
      ] = await Promise.all([
        prisma.scan.count({
          where: { userId },
        }),

        prisma.scan.findMany({
          where: {
            userId,
            trustScore: { not: null },
          },
          select: {
            trustScore: true,
          },
        }),

        prisma.scan.count({
          where: {
            userId,
            scamProbability: { gte: 60 },
          },
        }),

        prisma.scan.count({
          where: {
            userId,
            scamProbability: { gte: 20, lt: 60 },
          },
        }),

        prisma.scan.count({
          where: {
            userId,
            scamProbability: { lt: 20 },
          },
        }),

        prisma.scan.count({
          where: {
            userId,
            scamProbability: null,
          },
        }),

        prisma.scan.groupBy({
          by: ["type"],
          where: { userId },
          _count: {
            _all: true,
          },
        }),

        prisma.scan.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            inputSummary: true,
            trustScore: true,
            scamProbability: true,
            threatCategory: true,
            createdAt: true,
          },
        }),
      ]);

      const trustScores = scoredScans
        .map((scan) => scan.trustScore)
        .filter((score): score is number => score !== null);

      const averageTrustScore =
        trustScores.length > 0
          ? Math.round(
              trustScores.reduce((total, score) => total + score, 0) /
                trustScores.length,
            )
          : null;

      const scanTypeCounts: Record<string, number> = {};

      for (const item of scansByType) {
        scanTypeCounts[item.type] = item._count._all;
      }

      res.status(200).json({
        success: true,
        message: "Dashboard analytics retrieved successfully.",
        data: {
          totalScans,
          averageTrustScore,
          scoredScansCount: trustScores.length,
          riskDistribution: {
            high: highRiskScans,
            suspicious: suspiciousScans,
            low: lowRiskScans,
            unscored: unscoredScans,
          },
          scanTypeCounts,
          recentScans,
          disclaimer:
            "Risk categories use heuristic indicator scores. They are not statistically calibrated scam probabilities.",
        },
      });
    } catch (error) {
      console.error("Dashboard analytics error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve dashboard analytics.",
      });
    }
  },
);

// ========================================
// GET /api/history?page=1&limit=10
// Retrieve the authenticated user's scan history
// ========================================

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId!;

      const pageValue = Number(req.query.page ?? 1);
      const limitValue = Number(req.query.limit ?? 10);

      if (
        !Number.isInteger(pageValue) ||
        pageValue < 1 ||
        !Number.isInteger(limitValue) ||
        limitValue < 1 ||
        limitValue > 50
      ) {
        res.status(400).json({
          success: false,
          message:
            "Page must be a positive integer. Limit must be between 1 and 50.",
        });
        return;
      }

      const page = pageValue;
      const limit = limitValue;
      const skip = (page - 1) * limit;

      const [scans, total] = await Promise.all([
        prisma.scan.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            status: true,
            inputSummary: true,
            trustScore: true,
            scamProbability: true,
            threatCategory: true,
            explanation: true,
            evidence: true,
            recommendations: true,
            createdAt: true,
          },
        }),

        prisma.scan.count({
          where: { userId },
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Scan history retrieved successfully.",
        data: scans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + scans.length < total,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Scan history error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve scan history.",
      });
    }
  },
);

// ========================================
// GET /api/history/:id
// Retrieve one scan belonging to the authenticated user
// ========================================

router.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId!;
      const scanId = String(req.params.id ?? "");

      if (!scanId || scanId === "undefined") {
        res.status(400).json({
          success: false,
          message: "A valid scan ID is required.",
        });
        return;
      }

      const scan = await prisma.scan.findFirst({
        where: {
          id: scanId,
          userId,
        },
        select: {
          id: true,
          type: true,
          status: true,
          inputSummary: true,
          trustScore: true,
          scamProbability: true,
          threatCategory: true,
          explanation: true,
          evidence: true,
          recommendations: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!scan) {
        res.status(404).json({
          success: false,
          message: "Scan not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: scan,
      });
    } catch (error) {
      console.error("Scan detail error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve scan details.",
      });
    }
  },
);

// ========================================
// DELETE /api/history/:id
// Delete one scan belonging to the authenticated user
// ========================================

router.delete(
  "/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId!;
      const scanId = String(req.params.id ?? "");

      if (!scanId || scanId === "undefined") {
        res.status(400).json({
          success: false,
          message: "A valid scan ID is required.",
        });
        return;
      }

      // Verify that this scan belongs to the authenticated user.
      const scan = await prisma.scan.findFirst({
        where: {
          id: scanId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!scan) {
        res.status(404).json({
          success: false,
          message: "Scan not found.",
        });
        return;
      }

      // Delete only the verified scan.
      await prisma.scan.delete({
        where: {
          id: scan.id,
        },
      });

      res.status(200).json({
        success: true,
        message: "Scan history entry deleted successfully.",
        data: {
          id: scan.id,
        },
      });
    } catch (error) {
      console.error("Delete scan history error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to delete scan history entry.",
      });
    }
  },
);

export default router;