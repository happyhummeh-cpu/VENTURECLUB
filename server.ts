import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  requireAuth,
  requireRole,
  requireAttendanceAccess,
  AuthRequest,
  UserRole,
} from './src/middleware/auth.ts';
import {
  getPublicOverviewData,
  createStartupHelpRequest,
  getErpBootstrapData,
  getUserByUid,
  loginUserWithCredentials,
  createMemberByAdmin,
  updateMemberByAdmin,
  deleteMemberByAdmin,
  resetPasswordByAdmin,
  markRosterAttendance,
  updateMemberProfileRecord,
  updateMemberGovernance,
  startAttendanceSessionForEvent,
  endAttendanceSessionById,
  updateShootingSettings,
  markAttendanceWithCode,
  manualAttendanceOverride,
  createClubEvent,
  createVentureProject,
  updateProjectMilestone,
  createProjectTask,
  updateProjectTaskState,
  updateHelpRequestTriage,
  attemptGoogleSheetsSync,
  batchGoogleSheetsSync,
  getGoogleSyncStatus,
  markNotificationRead,
  getAuditLogsPaginated,
} from './src/db/queries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'anon'}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests in a short period. Please wait a moment and try again.',
      });
    }
    entry.count += 1;
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (req.path === '/src/main.tsx') {
      res.setHeader('Clear-Site-Data', '"cache"');
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // ==========================================
  // AUTHENTICATION API
  // ==========================================
  app.post(
    '/api/auth/login',
    rateLimit(20, 60_000),
    async (req: Request, res: Response) => {
      try {
        const { identifier, password } = req.body || {};
        if (!identifier?.trim() || !password) {
          return res.status(400).json({
            error: 'Please enter your username/email and password.',
          });
        }
        const { user, sessionToken } = await loginUserWithCredentials(
          identifier,
          password
        );
        res.json({
          user,
          sessionToken,
          token: sessionToken,
          message: `Welcome back, ${user.fullName}!`,
        });
      } catch (error: any) {
        console.error('POST /api/auth/login error:', error);
        res.status(401).json({
          error: error.message || 'Invalid username or password.',
        });
      }
    }
  );

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // ==========================================
  // PUBLIC WEBSITE API
  // ==========================================
  app.get('/api/public/overview', async (_req: Request, res: Response) => {
    try {
      const data = await getPublicOverviewData();
      res.json(data);
    } catch (error: any) {
      console.error('GET /api/public/overview error:', error);
      res.status(500).json({
        error: error.message || 'Unable to load public website data.',
      });
    }
  });

  app.post(
    '/api/public/help-request',
    rateLimit(10, 60_000),
    async (req: Request, res: Response) => {
      try {
        const {
          founderName,
          email,
          phone,
          startupName,
          category,
          problemDescription,
          websiteOrLinkedin,
        } = req.body || {};

        if (
          !founderName?.trim() ||
          !email?.trim() ||
          !startupName?.trim() ||
          !category?.trim() ||
          !problemDescription?.trim()
        ) {
          return res.status(400).json({
            error: 'Please fill in your name, email, startup name, category, and problem description.',
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({
            error: 'Please enter a valid email address.',
          });
        }

        const created = await createStartupHelpRequest({
          founderName,
          email,
          phone,
          startupName,
          category,
          problemDescription,
          websiteOrLinkedin,
        });

        res.status(201).json({
          record: created,
          message:
            'Your startup problem brief has been received and queued for Google Sheets synchronization.',
        });
      } catch (error: any) {
        console.error('POST /api/public/help-request error:', error);
        res.status(500).json({
          error: error.message || 'Something went wrong. Please try again.',
        });
      }
    }
  );

  // ==========================================
  // ERP WORKSPACE API
  // ==========================================
  app.get(
    '/api/erp/bootstrap',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const data = await getErpBootstrapData(req.dbUser!);
        res.json(data);
      } catch (error: any) {
        console.error('GET /api/erp/bootstrap error:', error);
        res.status(500).json({
          error: error.message || 'Failed to load ERP workspace.',
        });
      }
    }
  );

  // Member Management by Admin / Executive Leadership (Create, Update, Delete, Reset Password)
  app.post(
    '/api/erp/members',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          fullName,
          email,
          username,
          password,
          role,
          canTakeAttendance,
          permissions,
          phone,
          college,
          branch,
          course,
          year,
          semester,
          rollNumber,
          clubPosition,
          skills,
          bio,
        } = req.body || {};

        if (!fullName?.trim() || !email?.trim() || !username?.trim()) {
          return res.status(400).json({
            error: 'Full name, email, and username are required.',
          });
        }

        const newMember = await createMemberByAdmin(req.dbUser!, {
          fullName,
          email,
          username,
          password,
          role: role || 'MEMBER',
          canTakeAttendance: Boolean(canTakeAttendance),
          permissions: Array.isArray(permissions) ? permissions : [],
          phone,
          college,
          branch,
          course,
          year: year ? Number(year) : 3,
          semester: semester ? Number(semester) : 5,
          rollNumber,
          clubPosition,
          skills: Array.isArray(skills) ? skills : undefined,
          bio,
        });

        res.status(201).json({
          member: newMember,
          message: `Member ${newMember.fullName} created successfully.`,
        });
      } catch (error: any) {
        console.error('POST /api/erp/members error:', error);
        res.status(400).json({
          error: error.message || 'Failed to create member.',
        });
      }
    }
  );

  app.put(
    '/api/erp/members/:id',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const memberId = Number(req.params.id);
        const updated = await updateMemberByAdmin(
          req.dbUser!,
          memberId,
          req.body
        );
        res.json({
          member: updated,
          message: 'Member updated successfully.',
        });
      } catch (error: any) {
        console.error('PUT /api/erp/members/:id error:', error);
        res.status(400).json({
          error: error.message || 'Failed to update member.',
        });
      }
    }
  );

  app.delete(
    '/api/erp/members/:id',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const memberId = Number(req.params.id);
        await deleteMemberByAdmin(req.dbUser!, memberId);
        res.json({ message: 'Member deleted successfully.' });
      } catch (error: any) {
        console.error('DELETE /api/erp/members/:id error:', error);
        res.status(400).json({
          error: error.message || 'Failed to delete member.',
        });
      }
    }
  );

  app.post(
    '/api/erp/members/:id/reset-password',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const memberId = Number(req.params.id);
        const { password } = req.body || {};
        if (!password || password.length < 4) {
          return res.status(400).json({
            error: 'Password must be at least 4 characters long.',
          });
        }
        await resetPasswordByAdmin(req.dbUser!, memberId, password);
        res.json({ message: 'Password has been reset successfully.' });
      } catch (error: any) {
        console.error('POST /api/erp/members/:id/reset-password error:', error);
        res.status(400).json({
          error: error.message || 'Failed to reset password.',
        });
      }
    }
  );

  app.put(
    '/api/erp/profile',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const targetUserId = req.body.userId
          ? Number(req.body.userId)
          : req.dbUser!.id;

        if (
          targetUserId !== req.dbUser!.id &&
          req.dbUser!.role !== 'PRESIDENT' &&
          req.dbUser!.role !== 'VICE_PRESIDENT' &&
          req.dbUser!.role !== 'SECRETARY' &&
          req.dbUser!.role !== 'SUPER_ADMIN' &&
          req.dbUser!.role !== 'ADMIN'
        ) {
          return res.status(403).json({
            error: 'You can only update your own profile.',
          });
        }

        const updated = await updateMemberProfileRecord(
          targetUserId,
          req.dbUser!,
          req.body
        );
        res.json({ profile: updated, message: 'Member profile saved.' });
      } catch (error: any) {
        console.error('PUT /api/erp/profile error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update profile.',
        });
      }
    }
  );

  app.patch(
    '/api/erp/members/:id/governance',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = Number(req.params.id);
        const { role, status, clubPosition } = req.body || {};

        if (
          role &&
          role === 'SUPER_ADMIN' &&
          req.dbUser!.role !== 'SUPER_ADMIN' &&
          req.dbUser!.role !== 'PRESIDENT'
        ) {
          return res.status(403).json({
            error: 'Only President or Super Admin can assign the SUPER_ADMIN role.',
          });
        }

        await updateMemberGovernance(targetId, req.dbUser!, {
          role: role as UserRole | undefined,
          status,
          clubPosition,
        });

        res.json({ message: 'Member role and governance updated.' });
      } catch (error: any) {
        console.error('PATCH /api/erp/members/:id/governance error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update member governance.',
        });
      }
    }
  );

  // ==========================================
  // ATTENDANCE DASHBOARD, SHOOTING & LIVE ROSTER API
  // ==========================================
  app.put(
    '/api/erp/shooting-settings',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const updated = await updateShootingSettings(req.dbUser!, req.body || {});
        res.json({
          shootingSettings: updated,
          message: updated.isEnabled
            ? `Shooting Attendance enabled (Start time: ${updated.defaultStartTime}).`
            : 'Shooting Attendance disabled.',
        });
      } catch (error: any) {
        console.error('PUT /api/erp/shooting-settings error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update shooting attendance settings.',
        });
      }
    }
  );

  app.post(
    '/api/erp/attendance/session',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          eventId,
          ttlMinutes,
          sessionType,
          sessionDate,
          startTime,
          title,
        } = req.body || {};
        const targetEventId = Number(eventId) || 2;
        const duration = Number(ttlMinutes) || 15;
        const session = await startAttendanceSessionForEvent(
          targetEventId,
          duration,
          req.dbUser!,
          {
            sessionType:
              sessionType === 'SHOOTING'
                ? 'SHOOTING'
                : sessionType === 'COMBINED'
                ? 'COMBINED'
                : 'MEETING',
            sessionDate,
            startTime,
            title,
          }
        );
        res.status(201).json({
          session,
          message:
            sessionType === 'SHOOTING'
              ? `Shooting attendance session started (${startTime || '11:00'}).`
              : `Attendance session started for ${duration} minutes.`,
        });
      } catch (error: any) {
        console.error('POST /api/erp/attendance/session error:', error);
        res.status(500).json({
          error: error.message || 'Failed to start attendance session.',
        });
      }
    }
  );

  app.post(
    '/api/erp/attendance/session/:id/end',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const sessionId = Number(req.params.id);
        const ended = await endAttendanceSessionById(sessionId, req.dbUser!);
        res.json({
          session: ended,
          message: 'Attendance session ended.',
        });
      } catch (error: any) {
        console.error('POST /api/erp/attendance/session/:id/end error:', error);
        res.status(500).json({
          error: error.message || 'Failed to end attendance session.',
        });
      }
    }
  );

  // Roster Roll-Call by Attendance Coordinator or Admin (silent background sync)
  app.post(
    '/api/erp/attendance/roster-mark',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const { eventId, records, attendanceDate, sessionType } = req.body || {};
        if (!Array.isArray(records) || !records.length) {
          return res.status(400).json({
            error: 'Please provide attendance records to mark.',
          });
        }

        const result = await markRosterAttendance(
          req.dbUser!,
          Number(eventId) || 2,
          records,
          req.googleAccessToken,
          {
            attendanceDate,
            sessionType:
              sessionType === 'SHOOTING'
                ? 'SHOOTING'
                : sessionType === 'COMBINED'
                ? 'COMBINED'
                : 'MEETING',
          }
        );

        res.json({
          ...result,
          message: `Attendance saved for ${result.updated} ${
            result.updated === 1 ? 'member' : 'members'
          }.`,
        });
      } catch (error: any) {
        console.error('POST /api/erp/attendance/roster-mark error:', error);
        res.status(500).json({
          error: error.message || 'Failed to record roster attendance.',
        });
      }
    }
  );

  app.post(
    '/api/erp/attendance/mark',
    requireAuth,
    rateLimit(20, 60_000),
    async (req: AuthRequest, res: Response) => {
      try {
        const { code } = req.body || {};
        if (!code?.trim()) {
          return res.status(400).json({
            error: 'Please enter the session attendance code.',
          });
        }
        const result = await markAttendanceWithCode(
          code,
          req.dbUser!,
          req.googleAccessToken
        );
        res.json({
          ...result,
          message:
            'Attendance marked. Your attendance was recorded and automatically queued for Google Sheets synchronization.',
        });
      } catch (error: any) {
        console.error('POST /api/erp/attendance/mark error:', error);
        res.status(400).json({
          error: error.message || 'Could not verify attendance code.',
        });
      }
    }
  );

  app.post(
    '/api/erp/attendance/manual',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const { eventId, userId, status, reason } = req.body || {};
        if (!eventId || !userId || !status) {
          return res.status(400).json({
            error: 'Event, member, and attendance status are required.',
          });
        }
        const result = await manualAttendanceOverride(
          {
            eventId: Number(eventId),
            userId: Number(userId),
            status,
            reason: reason || 'Attendance coordinator verification',
          },
          req.dbUser!
        );
        res.json({
          ...result,
          message: 'Attendance recorded and logged in the audit trail.',
        });
      } catch (error: any) {
        console.error('POST /api/erp/attendance/manual error:', error);
        res.status(500).json({
          error: error.message || 'Failed to override attendance.',
        });
      }
    }
  );

  // ==========================================
  // EVENTS & PROJECTS API
  // ==========================================
  app.post(
    '/api/erp/events',
    requireAuth,
    requireRole('MEDIA_HEAD'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          name,
          description,
          date,
          time,
          venue,
          organizer,
          type,
          expectedCount,
          coverImage,
        } = req.body || {};

        if (!name?.trim() || !date || !time || !venue?.trim()) {
          return res.status(400).json({
            error: 'Event name, date, time, and venue are required.',
          });
        }

        const created = await createClubEvent(
          {
            name,
            description: description || 'Venture Club session.',
            date,
            time,
            venue,
            organizer: organizer || req.dbUser!.fullName,
            type: type || 'General Meeting',
            expectedCount: Number(expectedCount) || 60,
            coverImage,
          },
          req.dbUser!
        );

        res.status(201).json({ event: created });
      } catch (error: any) {
        console.error('POST /api/erp/events error:', error);
        res.status(500).json({
          error: error.message || 'Failed to create event.',
        });
      }
    }
  );

  app.post(
    '/api/erp/projects',
    requireAuth,
    requireRole('PROJECT_LEAD'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          name,
          description,
          problemStatement,
          leadName,
          startDate,
          deadline,
          technologies,
          repositoryUrl,
          demoUrl,
        } = req.body || {};

        if (!name?.trim() || !problemStatement?.trim()) {
          return res.status(400).json({
            error: 'Project name and problem statement are required.',
          });
        }

        const project = await createVentureProject(
          {
            name,
            description: description || problemStatement,
            problemStatement,
            leadName: leadName || req.dbUser!.fullName,
            startDate: startDate || new Date().toISOString().split('T')[0],
            deadline: deadline || '2026-12-15',
            technologies: Array.isArray(technologies) ? technologies : [],
            repositoryUrl,
            demoUrl,
          },
          req.dbUser!
        );

        res.status(201).json({ project });
      } catch (error: any) {
        console.error('POST /api/erp/projects error:', error);
        res.status(500).json({
          error: error.message || 'Failed to create project.',
        });
      }
    }
  );

  app.patch(
    '/api/erp/projects/:id',
    requireAuth,
    requireRole('PROJECT_LEAD'),
    async (req: AuthRequest, res: Response) => {
      try {
        const projectId = Number(req.params.id);
        const updated = await updateProjectMilestone(
          projectId,
          req.body || {},
          req.dbUser!
        );
        res.json({ project: updated });
      } catch (error: any) {
        console.error('PATCH /api/erp/projects/:id error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update project.',
        });
      }
    }
  );

  app.post(
    '/api/erp/tasks',
    requireAuth,
    requireRole('PROJECT_LEAD'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          projectId,
          title,
          description,
          assigneeName,
          priority,
          dueDate,
        } = req.body || {};

        if (!projectId || !title?.trim()) {
          return res.status(400).json({
            error: 'Project and task title are required.',
          });
        }

        const task = await createProjectTask(
          {
            projectId: Number(projectId),
            title,
            description,
            assigneeName,
            priority: priority || 'MEDIUM',
            dueDate: dueDate || '2026-10-25',
          },
          req.dbUser!
        );

        res.status(201).json({ task });
      } catch (error: any) {
        console.error('POST /api/erp/tasks error:', error);
        res.status(500).json({
          error: error.message || 'Failed to create task.',
        });
      }
    }
  );

  app.patch(
    '/api/erp/tasks/:id',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const taskId = Number(req.params.id);
        const updated = await updateProjectTaskState(
          taskId,
          req.body || {},
          req.dbUser!
        );
        res.json({ task: updated });
      } catch (error: any) {
        console.error('PATCH /api/erp/tasks/:id error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update task.',
        });
      }
    }
  );

  app.patch(
    '/api/erp/help-requests/:id',
    requireAuth,
    requireRole('SECRETARY'),
    async (req: AuthRequest, res: Response) => {
      try {
        const requestId = Number(req.params.id);
        const { status, assignedNotes } = req.body || {};
        const updated = await updateHelpRequestTriage(
          requestId,
          { status, assignedNotes },
          req.dbUser!
        );
        res.json({ helpRequest: updated });
      } catch (error: any) {
        console.error('PATCH /api/erp/help-requests/:id error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update help request.',
        });
      }
    }
  );

  app.post(
    '/api/erp/google-sync/:id/retry',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const syncId = Number(req.params.id);
        const { spreadsheetId } = req.body || {};
        const result = await attemptGoogleSheetsSync(
          syncId,
          req.googleAccessToken,
          spreadsheetId
        );
        res.json(result);
      } catch (error: any) {
        console.error('POST /api/erp/google-sync/:id/retry error:', error);
        res.status(500).json({
          error: error.message || 'Failed to retry Google Sheets sync.',
        });
      }
    }
  );

  app.post(
    '/api/erp/google-sync/batch',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const { spreadsheetId } = req.body || {};
        const result = await batchGoogleSheetsSync(
          req.googleAccessToken,
          spreadsheetId
        );
        res.json(result);
      } catch (error: any) {
        console.error('POST /api/erp/google-sync/batch error:', error);
        res.status(500).json({
          error: error.message || 'Failed to execute batch Google Sheets sync.',
        });
      }
    }
  );

  app.post(
    '/api/erp/google-sync/config',
    requireAuth,
    requireRole('VICE_PRESIDENT'),
    async (req: AuthRequest, res: Response) => {
      try {
        const { spreadsheetId } = req.body || {};
        if (typeof spreadsheetId === 'string') {
          process.env.GOOGLE_SHEETS_SPREADSHEET_ID = spreadsheetId.trim();
        }
        res.json({
          success: true,
          configuredSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
        });
      } catch (error: any) {
        console.error('POST /api/erp/google-sync/config error:', error);
        res.status(500).json({
          error: error.message || 'Failed to update spreadsheet configuration.',
        });
      }
    }
  );

  app.get(
    '/api/erp/google-sync/status',
    requireAuth,
    async (_req: AuthRequest, res: Response) => {
      try {
        const status = await getGoogleSyncStatus();
        res.json(status);
      } catch (error: any) {
        console.error('GET /api/erp/google-sync/status error:', error);
        res.status(500).json({
          error: error.message || 'Failed to fetch Google sync status.',
        });
      }
    }
  );

  app.post(
    '/api/erp/google-sync/force-refresh',
    requireAuth,
    requireAttendanceAccess,
    async (req: AuthRequest, res: Response) => {
      try {
        const { spreadsheetId } = req.body || {};
        const syncResult = await batchGoogleSheetsSync(
          req.googleAccessToken,
          spreadsheetId
        );
        const syncStatus = await getGoogleSyncStatus();
        res.json({
          ...syncResult,
          syncStatus,
        });
      } catch (error: any) {
        console.error('POST /api/erp/google-sync/force-refresh error:', error);
        res.status(500).json({
          error: error.message || 'Failed to force refresh Google Sheets sync.',
        });
      }
    }
  );

  app.patch(
    '/api/erp/notifications/:id/read',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await markNotificationRead(Number(req.params.id));
        res.json({ success: true });
      } catch (error: any) {
        console.error('PATCH /api/erp/notifications/:id/read error:', error);
        res.status(500).json({ error: 'Failed to update notification.' });
      }
    }
  );

  app.get(
    '/api/erp/audit-logs',
    requireAuth,
    requireRole('ADMIN'),
    async (req: AuthRequest, res: Response) => {
      try {
        const page = req.query.page ? Number(req.query.page) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const role = typeof req.query.role === 'string' ? req.query.role : undefined;
        const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';

        const result = await getAuditLogsPaginated({
          page,
          limit,
          search,
          category,
          role,
          entityType,
          sort,
        });

        res.json(result);
      } catch (error: any) {
        console.error('GET /api/erp/audit-logs error:', error);
        res.status(500).json({
          error: error.message || 'Failed to retrieve system audit logs.',
        });
      }
    }
  );

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const isProduction =
    process.env.NODE_ENV === 'production' && fs.existsSync(distIndexHtml);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/src/assets',
      express.static(path.join(__dirname, 'src', 'assets'), {
        maxAge: '7d',
      })
    );
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Venture Club ERP & Public Portal server running on port ${PORT}`);
    // Pre-warm database connection pool and in-memory caches for instant first-load response
    Promise.all([
      getPublicOverviewData(),
      getUserByUid('seed-uid-1').then((u) => (u ? getErpBootstrapData(u) : null)),
    ]).catch(() => {});
  });
}

startServer();
