import "dotenv/config";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { prisma } from "./lib/prisma";

import authRoutes from "./routes/auth.routes";
import analyzerRoutes from "./routes/analyzer.routes";
import qrRoutes from "./routes/qr.routes";
import paymentRoutes from "./routes/payment.routes";
import documentRoutes from "./routes/document.routes";
import historyRoutes from "./routes/history.routes";

// ========================================
// INITIALIZE EXPRESS APP
// ========================================

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:3000";

// ========================================
// SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

// HTTP request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },
  }),
);

// ========================================
// API ROUTES
// ========================================

// Authentication
app.use("/api/auth", authRoutes);

// Universal analyzer
app.use("/api/analyzer", analyzerRoutes);

// QR scanner
app.use("/api/qr", qrRoutes);

// Payment screenshot analyzer
app.use("/api/payment", paymentRoutes);

// Document and image analyzer
app.use("/api/document", documentRoutes);

// Scan history: GET, DELETE and other history routes
app.use("/api/history", historyRoutes);

// ========================================
// ROOT ENDPOINT
// ========================================

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to TrustLens AI Backend",
    version: "1.0.0",
  });
});

// ========================================
// API INFORMATION
// ========================================

app.get("/api", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    name: "TrustLens AI API",
    version: "1.0.0",

    endpoints: {
      root: "GET /",
      apiInfo: "GET /api",
      health: "GET /api/health",

      // Authentication
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      currentUser: "GET /api/auth/me",

      // Content analysis
      analyze: "POST /api/analyzer/analyze",

      // QR scanner
      qrScan: "POST /api/qr/scan",

      // Payment screenshot analysis
      paymentScreenshot: "POST /api/payment/analyze",

      // Document analysis
      documentAnalysis: "POST /api/document/analyze",

      // Scan history
      scanHistory: "GET /api/history",
      scanAnalytics: "GET /api/history/analytics",
      scanDetails: "GET /api/history/:id",
      deleteScan: "DELETE /api/history/:id",
    },
  });
});

// ========================================
// DATABASE HEALTH CHECK
// ========================================

app.get(
  "/api/health",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        success: true,
        service: "TrustLens AI Backend",
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Database health check failed:", error);

      res.status(503).json({
        success: false,
        service: "TrustLens AI Backend",
        status: "unhealthy",
        database: "disconnected",
      });
    }
  },
);

// ========================================
// 404 HANDLER
// Keep this AFTER all API routes
// ========================================

app.use(
  (req: Request, res: Response): void => {
    console.warn(
      `[404] ${req.method} ${req.originalUrl}`,
    );

    res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  },
);

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use(
  (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    console.error("Server error:", error.message);

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
);

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log("====================================");
  console.log("       TRUSTLENS AI BACKEND");
  console.log("====================================");

  console.log(`Server:      http://localhost:${PORT}`);
  console.log(`API Info:    http://localhost:${PORT}/api`);
  console.log(`Health:      http://localhost:${PORT}/api/health`);

  console.log("------------------------------------");
  console.log("API ROUTES");
  console.log("------------------------------------");

  console.log(`Auth:        http://localhost:${PORT}/api/auth`);
  console.log(`Analyzer:    http://localhost:${PORT}/api/analyzer`);
  console.log(`QR Scanner:  http://localhost:${PORT}/api/qr`);
  console.log(`Payment:     http://localhost:${PORT}/api/payment`);
  console.log(`Document:    http://localhost:${PORT}/api/document`);
  console.log(`History:     http://localhost:${PORT}/api/history`);

  console.log("------------------------------------");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  console.log("====================================");
});