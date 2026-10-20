import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "./auth.schemas";

const router = Router();

function createToken(userId: string): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId }, secret, {
    expiresIn: "1d",
  });
}

// ==========================================
// REGISTER
// POST /api/auth/register
// ==========================================

router.post(
  "/register",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = registerSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Invalid registration details",
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      const { name, email, password } = parsed.data;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "An account with this email already exists",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      const token = createToken(user.id);

      res.status(201).json({
        success: true,
        message: "Registration successful",
        token,
        user,
      });
    } catch (error) {
      console.error("Registration error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to complete registration",
      });
    }
  },
);

// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

router.post(
  "/login",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid email and password",
        });
        return;
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      const passwordMatches = await bcrypt.compare(
        password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      const token = createToken(user.id);

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to complete login",
      });
    }
  },
);

// ==========================================
// CURRENT USER
// GET /api/auth/me
// ==========================================

router.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      const user = await prisma.user.findUnique({
        where: { id: authReq.userId! },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      console.error("Current user error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve user details",
      });
    }
  },
);

export default router;