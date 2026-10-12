import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  getOrCreateUserWithProfile,
  getDemoFallbackUser,
  getUserByUid,
} from '../db/queries.ts';

export type UserRole =
  | 'PRESIDENT'
  | 'VICE_PRESIDENT'
  | 'SECRETARY'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'PROJECT_LEAD'
  | 'ATTENDANCE_HEAD'
  | 'MEDIA_HEAD'
  | 'MEMBER';

export interface AuthenticatedUserRecord {
  id: number;
  uid: string;
  email: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  canTakeAttendance: boolean;
  permissions: string;
  isActive: boolean;
  isOnboarded: boolean;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthenticatedUserRecord;
  googleAccessToken?: string;
}

export const ROLE_WEIGHT: Record<string, number> = {
  SUPER_ADMIN: 10,
  PRESIDENT: 9,
  VICE_PRESIDENT: 8,
  SECRETARY: 7,
  ADMIN: 5,
  PROJECT_LEAD: 4,
  ATTENDANCE_HEAD: 3,
  ATTENDANCE_COORDINATOR: 3,
  MEDIA_HEAD: 2,
  MEMBER: 1,
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const googleTokenHeader = req.headers['x-google-access-token'];
  if (typeof googleTokenHeader === 'string' && googleTokenHeader.trim()) {
    req.googleAccessToken = googleTokenHeader.trim();
  }

  // 1. Check for custom session token from Username+Password login (format: Bearer tvc_session:<uid>)
  if (authHeader && authHeader.startsWith('Bearer tvc_session:')) {
    const sessionUid = authHeader.replace('Bearer tvc_session:', '').trim();
    try {
      const dbUser = await getUserByUid(sessionUid);
      if (!dbUser) {
        return res.status(401).json({
          error: 'Your session has expired. Please sign in again.',
        });
      }
      if (!dbUser.isActive) {
        return res.status(403).json({
          error: 'Your account has been deactivated. Please contact an administrator.',
        });
      }
      req.dbUser = dbUser;
      req.user = {
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.fullName,
      } as unknown as DecodedIdToken;
      return next();
    } catch (err) {
      console.error('Session lookup failed:', err);
      return res.status(401).json({ error: 'Session verification failed.' });
    }
  }

  // 2. Standard Firebase ID Token (Google OAuth sign-in)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Your session has expired. Please sign in to continue.',
    });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const email = decodedToken.email || `${decodedToken.uid}@theventureclub.in`;
    const name =
      decodedToken.name ||
      email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const picture = decodedToken.picture || null;

    const dbUser = await getOrCreateUserWithProfile(
      decodedToken.uid,
      email,
      name,
      picture
    );

    if (!dbUser.isActive) {
      return res.status(403).json({
        error: 'Your account has been deactivated by an administrator.',
      });
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({
      error: 'Your session has expired. Please sign in again.',
    });
  }
};

export const requireRole = (minRole: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({
        error: 'Your session has expired. Please sign in again.',
      });
    }
    const userWeight = ROLE_WEIGHT[req.dbUser.role] || 1;
    const requiredWeight = ROLE_WEIGHT[minRole] || 1;

    if (userWeight < requiredWeight) {
      return res.status(403).json({
        error: `Insufficient permissions. This action requires ${minRole} access.`,
      });
    }
    next();
  };
};

// Specialized middleware: checks if user has attendance-taking access
export const requireAttendanceAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser) {
    return res.status(401).json({
      error: 'Your session has expired. Please sign in again.',
    });
  }

  const hasAccess =
    req.dbUser.role === 'SUPER_ADMIN' ||
    req.dbUser.role === 'ADMIN' ||
    req.dbUser.role === 'PRESIDENT' ||
    req.dbUser.role === 'VICE_PRESIDENT' ||
    req.dbUser.role === 'SECRETARY' ||
    req.dbUser.role === 'ATTENDANCE_HEAD' ||
    (req.dbUser.role as string) === 'ATTENDANCE_COORDINATOR' ||
    req.dbUser.canTakeAttendance === true;

  if (!hasAccess) {
    return res.status(403).json({
      error: 'You do not have permission to manage or record attendance for other members.',
    });
  }

  next();
};
