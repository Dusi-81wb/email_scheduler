import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  googleId: string | null;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || 'outbox_super_secure_jwt_secret_key_2026';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (req.headers['x-auth-token'] as string);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required. Please log in via Google.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User session invalid. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired authentication token.',
      details: error.message,
    });
  }
};
