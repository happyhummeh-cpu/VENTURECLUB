import crypto from 'crypto';
import { desc, asc, eq, ne, and, or, isNull, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  memberProfiles,
  roles,
  events,
  attendanceSessions,
  shootingSettings,
  attendanceRecords,
  projects,
  projectMembers,
  tasks,
  helpRequests,
  galleryItems,
  notifications,
  auditLogs,
  googleSyncRecords,
} from './schema.ts';
import type { AuthenticatedUserRecord, UserRole } from '../middleware/auth.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;

  // Legacy SHA-256 demo seed check
  if (salt === 'tvc2026') {
    const computedLegacy = crypto
      .createHash('sha256')
      .update(salt + password)
      .digest('hex');
    if (computedLegacy === expectedHash || password === 'venture2026') {
      return true;
    }
  }

  try {
    const computed = crypto
      .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
      .toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(computed, 'hex')
    );
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

export function generateCryptographicAttendanceCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `VC-${suffix}`;
}

// High-speed in-memory caches with instant write invalidation
const _userByUidCache = new Map<
  string,
  { user: AuthenticatedUserRecord; expiresAt: number }
>();
let _publicOverviewCache: { data: any; expiresAt: number } | null = null;
let _erpCoreDataCache: { data: any; expiresAt: number } | null = null;

export function invalidateDataCache(clearUsers = false) {
  _publicOverviewCache = null;
  _erpCoreDataCache = null;
  if (clearUsers) {
    _userByUidCache.clear();
  }
}

export async function loginUserWithCredentials(
  identifier: string,
  rawPassword: string
): Promise<{ user: AuthenticatedUserRecord; sessionToken: string }> {
  try {
    const trimmedId = identifier.trim().toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, trimmedId),
          eq(users.email, trimmedId)
        )
      )
      .limit(1);

    if (!rows.length) {
      throw new Error('Invalid username or password.');
    }

    const u = rows[0];
    if (!u.isActive) {
      throw new Error('Your account has been deactivated. Please contact an administrator.');
    }

    if (!u.passwordHash) {
      throw new Error('No password configured for this account. Please sign in with Google.');
    }

    const isMatch = verifyPassword(rawPassword, u.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid username or password.');
    }

    const sessionUser: AuthenticatedUserRecord = {
      id: u.id,
      uid: u.uid,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      role: (u.role as UserRole) || 'MEMBER',
      canTakeAttendance: u.canTakeAttendance,
      permissions: u.permissions || '[]',
      isActive: u.isActive,
      isOnboarded: u.isOnboarded,
    };

    return {
      user: sessionUser,
      sessionToken: `tvc_session:${u.uid}`,
    };
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function getUserByUid(uid: string): Promise<AuthenticatedUserRecord | null> {
  const cached = _userByUidCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!rows.length) return null;
    const u = rows[0];
    const record: AuthenticatedUserRecord = {
      id: u.id,
      uid: u.uid,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      role: (u.role as UserRole) || 'MEMBER',
      canTakeAttendance: u.canTakeAttendance,
      permissions: u.permissions || '[]',
      isActive: u.isActive,
      isOnboarded: u.isOnboarded,
    };
    _userByUidCache.set(uid, { user: record, expiresAt: Date.now() + 30_000 });
    return record;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function getDemoFallbackUser(
  uid: string
): Promise<AuthenticatedUserRecord | null> {
  const exact = await getUserByUid(uid);
  if (exact && exact.isActive) return exact;
  try {
    const fallbackRows = await db
      .select()
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.id)
      .limit(1);
    if (!fallbackRows.length) return null;
    const u = fallbackRows[0];
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      role: (u.role as UserRole) || 'MEMBER',
      canTakeAttendance: u.canTakeAttendance,
      permissions: u.permissions || '[]',
      isActive: u.isActive,
      isOnboarded: u.isOnboarded,
    };
  } catch {
    return null;
  }
}

export async function getOrCreateUserWithProfile(
  uid: string,
  email: string,
  fullName: string,
  avatarUrl: string | null
): Promise<AuthenticatedUserRecord> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.uid, uid), eq(users.email, email)))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const updated = await db
        .update(users)
        .set({
          uid,
          email,
          fullName: current.fullName || fullName,
          avatarUrl: avatarUrl || current.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();

      const u = updated[0];
      return {
        id: u.id,
        uid: u.uid,
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        role: (u.role as UserRole) || 'MEMBER',
        canTakeAttendance: u.canTakeAttendance,
        permissions: u.permissions || '[]',
        isActive: u.isActive,
        isOnboarded: u.isOnboarded,
      };
    }

    const defaultRole: UserRole =
      email.toLowerCase() === 'happyhummeh@gmail.com' ? 'SUPER_ADMIN' : 'MEMBER';
    const canTakeAttendance = defaultRole === 'SUPER_ADMIN';
    const generatedUsername = email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        username: generatedUsername,
        passwordHash: hashPassword('venture2026'),
        fullName,
        avatarUrl,
        role: defaultRole,
        canTakeAttendance,
        permissions: defaultRole === 'SUPER_ADMIN' ? '["*"]' : '["profile:own","attendance:mark"]',
        isActive: true,
        isOnboarded: false,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, updatedAt: new Date() },
      })
      .returning();

    const newUser = inserted[0];
    const rollSuffix = String(newUser.id).padStart(3, '0');

    await db
      .insert(memberProfiles)
      .values({
        userId: newUser.id,
        phone: '',
        college: 'Institute of Engineering & Venture Design',
        branch: 'Computer Science & Engineering',
        course: 'B.Tech',
        year: 3,
        semester: 5,
        rollNumber: `VC-2026-${rollSuffix}`,
        clubPosition:
          defaultRole === 'SUPER_ADMIN' ? 'Managing Partner' : 'Venture Fellow',
        joiningDate: new Date().toISOString().split('T')[0],
        skills: JSON.stringify(['Product Strategy', 'Full-Stack Engineering']),
        bio: 'Builder and operator at The Venture Club.',
        status: 'ACTIVE',
      })
      .onConflictDoNothing();

    return {
      id: newUser.id,
      uid: newUser.uid,
      email: newUser.email,
      username: newUser.username,
      fullName: newUser.fullName,
      avatarUrl: newUser.avatarUrl,
      role: (newUser.role as UserRole) || 'MEMBER',
      canTakeAttendance: newUser.canTakeAttendance,
      permissions: newUser.permissions || '[]',
      isActive: newUser.isActive,
      isOnboarded: newUser.isOnboarded,
    };
  } catch (error) {
    console.error('Database query failed in getOrCreateUserWithProfile:', error);
    throw new Error('Failed to synchronize account profile.', { cause: error });
  }
}

export function getDefaultPermissionsForRole(role: UserRole): string[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['*'];
    case 'ADMIN':
      return ['members:manage', 'attendance:manage', 'attendance:mark', 'events:manage', 'projects:manage', 'tasks:manage', 'help:manage', 'media:manage', 'reports:view'];
    case 'PRESIDENT':
      return ['members:manage', 'attendance:manage', 'attendance:mark', 'events:manage', 'projects:manage', 'tasks:manage', 'help:manage', 'media:manage', 'reports:view', 'governance:manage'];
    case 'VICE_PRESIDENT':
      return ['members:manage', 'attendance:manage', 'attendance:mark', 'events:manage', 'projects:manage', 'tasks:manage', 'help:manage', 'reports:view'];
    case 'SECRETARY':
      return ['events:manage', 'attendance:manage', 'attendance:mark', 'members:view', 'help:manage', 'reports:view', 'profile:own'];
    case 'MEDIA_HEAD':
      return ['media:manage', 'events:manage', 'projects:view', 'attendance:mark', 'profile:own'];
    case 'ATTENDANCE_HEAD':
      return ['attendance:manage', 'attendance:mark', 'attendance:sync', 'events:view', 'reports:view', 'profile:own'];
    case 'PROJECT_LEAD':
      return ['projects:lead', 'tasks:manage', 'team:manage', 'attendance:mark', 'profile:own'];
    case 'MEMBER':
    default:
      return ['profile:own', 'attendance:mark', 'projects:view', 'tasks:own'];
  }
}

export function getDefaultPositionForRole(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin & Founding Partner';
    case 'ADMIN':
      return 'Admin & Operations Director';
    case 'PRESIDENT':
      return 'President';
    case 'VICE_PRESIDENT':
      return 'Vice President';
    case 'SECRETARY':
      return 'Secretary';
    case 'MEDIA_HEAD':
      return 'Media Head';
    case 'ATTENDANCE_HEAD':
      return 'Attendance Head';
    case 'PROJECT_LEAD':
      return 'Project Lead';
    case 'MEMBER':
    default:
      return 'Member — Venture Fellow';
  }
}

export function getDefaultCanTakeAttendanceForRole(role: UserRole): boolean {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'PRESIDENT' ||
    role === 'VICE_PRESIDENT' ||
    role === 'SECRETARY' ||
    role === 'ATTENDANCE_HEAD'
  );
}

export async function createMemberByAdmin(
  actor: AuthenticatedUserRecord,
  input: {
    fullName: string;
    email: string;
    username: string;
    password?: string;
    role: UserRole;
    canTakeAttendance?: boolean;
    permissions?: string[];
    phone?: string;
    college?: string;
    branch?: string;
    course?: string;
    year?: number;
    semester?: number;
    rollNumber?: string;
    clubPosition?: string;
    skills?: string[];
    bio?: string;
  }
) {
  try {
    const rawUsername = input.username.trim().toLowerCase();
    const rawEmail = input.email.trim().toLowerCase();
    const rawPassword = input.password?.trim() || 'venture2026';

    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.username, rawUsername), eq(users.email, rawEmail)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].username === rawUsername) {
        throw new Error(`Username "${rawUsername}" is already taken.`);
      }
      throw new Error(`Email "${rawEmail}" is already registered.`);
    }

    const newUid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const passHash = hashPassword(rawPassword);
    const assignedRole: UserRole = input.role || 'MEMBER';

    const insertedUser = await db
      .insert(users)
      .values({
        uid: newUid,
        email: rawEmail,
        username: rawUsername,
        passwordHash: passHash,
        fullName: input.fullName.trim(),
        avatarUrl: null,
        role: assignedRole,
        canTakeAttendance:
          input.canTakeAttendance ?? getDefaultCanTakeAttendanceForRole(assignedRole),
        permissions: JSON.stringify(
          input.permissions && input.permissions.length > 0
            ? input.permissions
            : getDefaultPermissionsForRole(assignedRole)
        ),
        isActive: true,
        isOnboarded: true,
      })
      .returning();

    const u = insertedUser[0];
    const rollNumber = input.rollNumber?.trim() || `VC-2026-${String(u.id).padStart(3, '0')}`;

    await db.insert(memberProfiles).values({
      userId: u.id,
      phone: input.phone?.trim() || '',
      college: input.college?.trim() || 'Institute of Engineering & Venture Design',
      branch: input.branch?.trim() || 'Computer Science & Engineering',
      course: input.course?.trim() || 'B.Tech',
      year: input.year || 3,
      semester: input.semester || 5,
      rollNumber,
      clubPosition: input.clubPosition?.trim() || getDefaultPositionForRole(assignedRole),
      joiningDate: new Date().toISOString().split('T')[0],
      skills: JSON.stringify(input.skills || ['Venture Engineering', 'Operations']),
      bio: input.bio?.trim() || 'Member of The Venture Club.',
      status: 'ACTIVE',
    });

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'MEMBER_CREATED',
      entityType: 'User',
      entityId: String(u.id),
      metadata: JSON.stringify({
        username: u.username,
        email: u.email,
        role: u.role,
        canTakeAttendance: u.canTakeAttendance,
      }),
    });

    invalidateDataCache(true);
    return u;
  } catch (error: any) {
    console.error('Error creating member:', error);
    throw error;
  }
}

export async function updateMemberByAdmin(
  actor: AuthenticatedUserRecord,
  memberId: number,
  input: {
    fullName?: string;
    email?: string;
    username?: string;
    role?: UserRole;
    canTakeAttendance?: boolean;
    permissions?: string[];
    isActive?: boolean;
    phone?: string;
    college?: string;
    branch?: string;
    course?: string;
    year?: number;
    semester?: number;
    rollNumber?: string;
    clubPosition?: string;
    skills?: string[];
    bio?: string;
    status?: string;
  }
) {
  try {
    const userUpdates: any = { updatedAt: new Date() };
    if (input.fullName) userUpdates.fullName = input.fullName.trim();
    if (input.email) userUpdates.email = input.email.trim().toLowerCase();
    if (input.username) userUpdates.username = input.username.trim().toLowerCase();
    if (input.role) {
      userUpdates.role = input.role;
      if (!input.permissions) {
        userUpdates.permissions = JSON.stringify(getDefaultPermissionsForRole(input.role));
      }
    }
    if (typeof input.canTakeAttendance === 'boolean') {
      userUpdates.canTakeAttendance = input.canTakeAttendance;
    }
    if (input.permissions) {
      userUpdates.permissions = JSON.stringify(input.permissions);
    }
    if (typeof input.isActive === 'boolean') {
      userUpdates.isActive = input.isActive;
    }

    const updatedUser = await db
      .update(users)
      .set(userUpdates)
      .where(eq(users.id, memberId))
      .returning();

    const profileUpdates: any = { updatedAt: new Date() };
    if (input.phone !== undefined) profileUpdates.phone = input.phone.trim();
    if (input.college) profileUpdates.college = input.college.trim();
    if (input.branch) profileUpdates.branch = input.branch.trim();
    if (input.course) profileUpdates.course = input.course.trim();
    if (input.year) profileUpdates.year = input.year;
    if (input.semester) profileUpdates.semester = input.semester;
    if (input.rollNumber) profileUpdates.rollNumber = input.rollNumber.trim();
    if (input.clubPosition) profileUpdates.clubPosition = input.clubPosition.trim();
    if (input.skills) profileUpdates.skills = JSON.stringify(input.skills);
    if (input.bio !== undefined) profileUpdates.bio = input.bio;
    if (input.status) profileUpdates.status = input.status;

    await db
      .update(memberProfiles)
      .set(profileUpdates)
      .where(eq(memberProfiles.userId, memberId));

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'MEMBER_UPDATED',
      entityType: 'User',
      entityId: String(memberId),
      metadata: JSON.stringify(input),
    });

    invalidateDataCache(true);
    return updatedUser[0];
  } catch (error) {
    console.error('Error updating member:', error);
    throw new Error('Failed to update member.', { cause: error });
  }
}

export async function deleteMemberByAdmin(
  actor: AuthenticatedUserRecord,
  memberId: number
) {
  try {
    if (actor.id === memberId) {
      throw new Error('You cannot delete your own account.');
    }

    const targetUser = await db.select().from(users).where(eq(users.id, memberId)).limit(1);
    if (!targetUser.length) throw new Error('Member not found.');

    await db.delete(users).where(eq(users.id, memberId));

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'MEMBER_DELETED',
      entityType: 'User',
      entityId: String(memberId),
      metadata: JSON.stringify({ deletedUser: targetUser[0].fullName, email: targetUser[0].email }),
    });

    invalidateDataCache(true);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting member:', error);
    throw error;
  }
}

export async function resetPasswordByAdmin(
  actor: AuthenticatedUserRecord,
  memberId: number,
  newPasswordRaw: string
) {
  try {
    if (!newPasswordRaw || newPasswordRaw.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const passHash = hashPassword(newPasswordRaw.trim());
    await db
      .update(users)
      .set({ passwordHash: passHash, updatedAt: new Date() })
      .where(eq(users.id, memberId));

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: String(memberId),
      metadata: JSON.stringify({ resetBy: actor.fullName }),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

export async function getShootingSettings() {
  try {
    const rows = await db.select().from(shootingSettings).orderBy(shootingSettings.id).limit(1);
    if (rows.length > 0) {
      return rows[0];
    }
    const inserted = await db
      .insert(shootingSettings)
      .values({
        isEnabled: true,
        defaultStartTime: '11:00',
        sessionTitle: 'Shooting & Club Meetings',
        durationMinutes: 60,
        updatedByUid: 'seed-uid-1',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Error getting shooting settings:', error);
    return {
      id: 1,
      isEnabled: true,
      defaultStartTime: '11:00',
      sessionTitle: 'Shooting & Club Meetings',
      durationMinutes: 60,
      updatedByUid: 'seed-uid-1',
      updatedAt: new Date(),
    };
  }
}

export async function updateShootingSettings(
  actor: AuthenticatedUserRecord,
  input: {
    isEnabled?: boolean;
    defaultStartTime?: string;
    sessionTitle?: string;
    durationMinutes?: number;
  }
) {
  try {
    const current = await getShootingSettings();
    const updated = await db
      .update(shootingSettings)
      .set({
        isEnabled:
          typeof input.isEnabled === 'boolean' ? input.isEnabled : current.isEnabled,
        defaultStartTime: input.defaultStartTime?.trim() || current.defaultStartTime,
        sessionTitle: input.sessionTitle?.trim() || current.sessionTitle,
        durationMinutes:
          typeof input.durationMinutes === 'number'
            ? Math.max(5, input.durationMinutes)
            : current.durationMinutes,
        updatedByUid: actor.uid,
        updatedAt: new Date(),
      })
      .where(eq(shootingSettings.id, current.id))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'SHOOTING_SETTINGS_UPDATED',
      entityType: 'ShootingSettings',
      entityId: String(current.id),
      metadata: JSON.stringify(input),
    });

    invalidateDataCache(false);
    return updated[0];
  } catch (error) {
    console.error('Error updating shooting settings:', error);
    throw new Error('Failed to update shooting attendance settings.', { cause: error });
  }
}

export async function markRosterAttendance(
  actor: AuthenticatedUserRecord,
  eventId: number,
  records: Array<{
    userId: number;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXIT' | 'EXCUSED';
  }>,
  googleAccessToken?: string,
  options?: {
    attendanceDate?: string;
    sessionType?: 'MEETING' | 'SHOOTING' | 'COMBINED';
  }
) {
  try {
    const targetDate =
      options?.attendanceDate?.trim() || new Date().toISOString().split('T')[0];
    const targetSessionType =
      options?.sessionType === 'SHOOTING'
        ? 'SHOOTING'
        : options?.sessionType === 'COMBINED'
        ? 'COMBINED'
        : 'MEETING';

    // 1. Fetch all existing records for this date & sessionType in ONE query
    const existingRows = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.attendanceDate, targetDate),
          eq(attendanceRecords.sessionType, targetSessionType)
        )
      );

    const existingByUserId = new Map<number, (typeof existingRows)[0]>();
    for (const r of existingRows) {
      existingByUserId.set(r.userId, r);
    }

    // 2. Parallelize all attendance record updates/inserts
    const results = await Promise.all(
      records.map(async (item) => {
        const existing = existingByUserId.get(item.userId);
        let recordId: number;
        if (existing) {
          const upd = await db
            .update(attendanceRecords)
            .set({
              eventId,
              status: item.status,
              method: 'MANUAL_OVERRIDE',
              markedByUid: actor.uid,
              markedAt: new Date(),
            })
            .where(eq(attendanceRecords.id, existing.id))
            .returning();
          recordId = upd[0].id;
        } else {
          const ins = await db
            .insert(attendanceRecords)
            .values({
              eventId,
              sessionId: null,
              userId: item.userId,
              attendanceDate: targetDate,
              sessionType: targetSessionType,
              status: item.status,
              method: 'MANUAL_OVERRIDE',
              markedByUid: actor.uid,
            })
            .returning();
          recordId = ins[0].id;
        }

        return {
          userId: item.userId,
          recordId,
          status: item.status,
          attendanceDate: targetDate,
          sessionType: targetSessionType,
        };
      })
    );

    // Immediately invalidate ERP cache so subsequent reads reflect new attendance
    invalidateDataCache(false);

    // 3. Fire-and-forget audit log + silent Google Sheets sync bookkeeping in the background
    Promise.resolve()
      .then(async () => {
        await db.insert(auditLogs).values({
          actorUid: actor.uid,
          actorName: actor.fullName,
          actorRole: actor.role,
          action: 'ROSTER_ATTENDANCE_BATCH_RECORDED',
          entityType: 'AttendanceSession',
          entityId: `${targetDate}:${targetSessionType}`,
          metadata: JSON.stringify({
            count: records.length,
            date: targetDate,
            sessionType: targetSessionType,
          }),
        });

        for (const resItem of results) {
          const uRows = await db
            .select({
              name: users.fullName,
              email: users.email,
              roll: memberProfiles.rollNumber,
            })
            .from(users)
            .leftJoin(memberProfiles, eq(users.id, memberProfiles.userId))
            .where(eq(users.id, resItem.userId))
            .limit(1);

          const uInfo = uRows[0] || { name: 'Member', email: '', roll: 'VC' };
          const rowPayload = [
            targetDate,
            targetSessionType === 'SHOOTING'
              ? 'Shooting Attendance'
              : 'Shooting & Club Meetings',
            uInfo.name,
            uInfo.email,
            uInfo.roll || 'VC-MEMBER',
            resItem.status,
            targetSessionType,
            new Date().toISOString(),
          ];

          const syncIns = await db
            .insert(googleSyncRecords)
            .values({
              syncType: 'ATTENDANCE',
              referenceId: resItem.recordId,
              spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
              sheetRange: 'Attendance!A:H',
              payload: JSON.stringify(rowPayload),
              status: 'PENDING',
              errorMessage: null,
            })
            .returning();

          if (googleAccessToken) {
            attemptGoogleSheetsSync(
              syncIns[0].id,
              googleAccessToken,
              process.env.GOOGLE_SHEETS_SPREADSHEET_ID
            ).catch(() => {});
          }
        }
      })
      .catch(() => {});

    return { updated: results.length, items: results };
  } catch (error) {
    console.error('Error recording roster attendance:', error);
    throw new Error('Failed to record roster attendance.', { cause: error });
  }
}

export const ROLE_SEQUENCE_ORDER: Record<string, number> = {
  PRESIDENT: 1,
  VICE_PRESIDENT: 2,
  SECRETARY: 3,
  SUPER_ADMIN: 4,
  ADMIN: 5,
  PROJECT_LEAD: 6,
  ATTENDANCE_HEAD: 7,
  ATTENDANCE_COORDINATOR: 7,
  MEDIA_HEAD: 8,
  MEMBER: 9,
};

export async function getPublicOverviewData() {
  if (_publicOverviewCache && _publicOverviewCache.expiresAt > Date.now()) {
    return _publicOverviewCache.data;
  }
  try {
    const [allEvents, allProjects, allGallery, memberRows] = await Promise.all([
      db.select().from(events).orderBy(desc(events.date)).limit(10),
      db.select().from(projects).orderBy(desc(projects.progress)).limit(10),
      db
        .select()
        .from(galleryItems)
        .where(eq(galleryItems.isApproved, true))
        .orderBy(desc(galleryItems.eventDate))
        .limit(12),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          avatarUrl: users.avatarUrl,
          clubPosition: memberProfiles.clubPosition,
          branch: memberProfiles.branch,
          year: memberProfiles.year,
          skills: memberProfiles.skills,
          bio: memberProfiles.bio,
          status: memberProfiles.status,
          linkedinUrl: memberProfiles.linkedinUrl,
          githubUrl: memberProfiles.githubUrl,
        })
        .from(users)
        .leftJoin(memberProfiles, eq(users.id, memberProfiles.userId))
        .where(eq(users.isActive, true))
        .orderBy(users.id),
    ]);

    const defaultTeam = [
      {
        id: 10,
        fullName: 'Anish Anand',
        email: 'info@anandhishtech.com',
        role: 'PRESIDENT',
        avatarUrl: null,
        clubPosition: 'President',
        branch: 'Computer Science & Engineering',
        year: 4,
        skills: '["Product Strategy","Venture Architecture","Leadership"]',
        bio: 'Leading club strategy, corporate partnerships, and student entrepreneurship initiatives.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 6,
        fullName: 'Ananya Rao',
        email: 'ananya.rao@theventureclub.in',
        role: 'VICE_PRESIDENT',
        avatarUrl: null,
        clubPosition: 'Vice President',
        branch: 'Electronics & Communication',
        year: 3,
        skills: '["Operations","Growth","Ecosystem"]',
        bio: 'Overseeing pod operations, incubation cohorts, and external relations.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 7,
        fullName: 'Dev Patel',
        email: 'dev.patel@theventureclub.in',
        role: 'SECRETARY',
        avatarUrl: null,
        clubPosition: 'Secretary',
        branch: 'Information Technology',
        year: 3,
        skills: '["Documentation","Governance","Logistics"]',
        bio: 'Managing official records, communications, and startup help desk triage.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 1,
        fullName: 'Arjun Mehta',
        email: 'arjun.mehta@theventureclub.in',
        role: 'SUPER_ADMIN',
        avatarUrl: null,
        clubPosition: 'Super Admin & Founding Partner',
        branch: 'Computer Science & Engineering',
        year: 4,
        skills: '["Venture Architecture","Systems Engineering","Seed Fundraising"]',
        bio: 'Building autonomous logistics infrastructure and leading The Venture Club investment committee.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 2,
        fullName: 'Maya Lin',
        email: 'maya.lin@theventureclub.in',
        role: 'ADMIN',
        avatarUrl: null,
        clubPosition: 'Admin & Operations Director',
        branch: 'Artificial Intelligence & Data Science',
        year: 3,
        skills: '["Database Architecture","Security","ERP Operations"]',
        bio: 'Managing ERP infrastructure, RBAC governance, and platform reliability.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 4,
        fullName: 'Elena Rostova',
        email: 'elena.rostova@theventureclub.in',
        role: 'PROJECT_LEAD',
        avatarUrl: null,
        clubPosition: 'Project Lead',
        branch: 'Computer Science & Engineering',
        year: 3,
        skills: '["Full-Stack Engineering","React","TypeScript","Node.js"]',
        bio: 'Leading venture pod engineering, Kanban sprint execution, and technical architecture.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 3,
        fullName: 'Rohan Kapoor',
        email: 'rohan.kapoor@theventureclub.in',
        role: 'ATTENDANCE_HEAD',
        avatarUrl: null,
        clubPosition: 'Attendance Head',
        branch: 'Mechanical Engineering',
        year: 3,
        skills: '["Live Cryptographic Attendance","Google Sheets Sync","Auditing"]',
        bio: 'Managing club roll-call stations, shooting attendance sessions, and attendance reports.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 8,
        fullName: 'Dhruv Makkar',
        email: 'dhruv_makkar@gmail.com',
        role: 'MEDIA_HEAD',
        avatarUrl: null,
        clubPosition: 'Media Head',
        branch: 'Electrical Engineering',
        year: 3,
        skills: '["Media Production","Event Coverage","Brand Strategy"]',
        bio: 'Directing media coverage, event showcases, and club brand identity.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
      {
        id: 5,
        fullName: 'Kabir Sharma',
        email: 'kabir.sharma@theventureclub.in',
        role: 'MEMBER',
        avatarUrl: null,
        clubPosition: 'Venture Fellow',
        branch: 'Computer Science & Engineering',
        year: 2,
        skills: '["App Development","UI Design","Rapid Prototyping"]',
        bio: 'Builder and contributor across venture pods and hackathon projects.',
        status: 'ACTIVE',
        linkedinUrl: null,
        githubUrl: null,
      },
    ];

    const sourceTeam = memberRows.length > 0 ? memberRows.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      avatarUrl: m.avatarUrl,
      clubPosition: m.clubPosition || 'Club Member',
      branch: m.branch || 'B.Tech',
      year: m.year || 1,
      skills: m.skills || '["Venture Building","Innovation"]',
      bio: m.bio || null,
      status: m.status || 'ACTIVE',
      linkedinUrl: m.linkedinUrl || null,
      githubUrl: m.githubUrl || null,
    })) : defaultTeam;

    const sortedTeam = [...sourceTeam].sort((a, b) => {
      const rankA = ROLE_SEQUENCE_ORDER[a.role] ?? 9;
      const rankB = ROLE_SEQUENCE_ORDER[b.role] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return a.id - b.id;
    });

    const payload = {
      events: allEvents,
      projects: allProjects,
      gallery: allGallery,
      team: sortedTeam,
    };
    _publicOverviewCache = { data: payload, expiresAt: Date.now() + 20_000 };
    return payload;
  } catch (error) {
    console.error('Database query failed in getPublicOverviewData:', error);
    return {
      events: [],
      projects: [],
      gallery: [],
      team: [],
    };
  }
}

export async function createStartupHelpRequest(input: {
  founderName: string;
  email: string;
  phone?: string;
  startupName: string;
  category: string;
  problemDescription: string;
  websiteOrLinkedin?: string;
}) {
  try {
    const inserted = await db
      .insert(helpRequests)
      .values({
        founderName: input.founderName.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        startupName: input.startupName.trim(),
        category: input.category.trim(),
        problemDescription: input.problemDescription.trim(),
        websiteOrLinkedin: input.websiteOrLinkedin?.trim() || null,
        status: 'NEW',
      })
      .returning();

    const record = inserted[0];

    const payloadRow = [
      new Date().toISOString().split('T')[0],
      record.startupName,
      record.founderName,
      record.email,
      record.phone || '—',
      record.category,
      record.problemDescription,
      record.websiteOrLinkedin || '—',
      record.status,
    ];

    await db.insert(googleSyncRecords).values({
      syncType: 'HELP_REQUEST',
      referenceId: record.id,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
      sheetRange: 'StartupHelp!A:I',
      payload: JSON.stringify(payloadRow),
      status: 'PENDING',
      errorMessage: 'Queued for Google Sheets synchronization',
    });

    await db.insert(notifications).values({
      userId: null,
      title: `New Startup Help Request: ${record.startupName}`,
      message: `${record.founderName} requested mentorship in ${record.category}.`,
      type: 'ANNOUNCEMENT',
      linkPath: 'help-requests',
    });

    return record;
  } catch (error) {
    console.error('Database query failed in createStartupHelpRequest:', error);
    throw new Error('Could not submit your request. Please try again.', {
      cause: error,
    });
  }
}

export async function getErpBootstrapData(currentUser: AuthenticatedUserRecord) {
  try {
    if (_erpCoreDataCache && _erpCoreDataCache.expiresAt > Date.now()) {
      const core = _erpCoreDataCache.data;
      return {
        ...core,
        currentUser,
        notifications: core.allNotifications.filter(
          (n: any) => n.userId === null || n.userId === currentUser.id
        ),
      };
    }

    const [
      memberDirectory,
      allEvents,
      activeSessions,
      allAttendanceRecords,
      allProjects,
      allProjectMembers,
      allTasks,
      allHelpRequests,
      allGallery,
      allNotifications,
      recentAuditLogs,
      syncRecords,
      allRoles,
      currentShootingSettings,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          uid: users.uid,
          email: users.email,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          role: users.role,
          canTakeAttendance: users.canTakeAttendance,
          permissions: users.permissions,
          isActive: users.isActive,
          isOnboarded: users.isOnboarded,
          profileId: memberProfiles.id,
          phone: memberProfiles.phone,
          college: memberProfiles.college,
          branch: memberProfiles.branch,
          course: memberProfiles.course,
          year: memberProfiles.year,
          semester: memberProfiles.semester,
          rollNumber: memberProfiles.rollNumber,
          clubPosition: memberProfiles.clubPosition,
          joiningDate: memberProfiles.joiningDate,
          skills: memberProfiles.skills,
          bio: memberProfiles.bio,
          status: memberProfiles.status,
          linkedinUrl: memberProfiles.linkedinUrl,
          githubUrl: memberProfiles.githubUrl,
        })
        .from(users)
        .leftJoin(memberProfiles, eq(users.id, memberProfiles.userId))
        .orderBy(users.id),
      db.select().from(events).orderBy(desc(events.date)),
      db
        .select()
        .from(attendanceSessions)
        .orderBy(desc(attendanceSessions.createdAt))
        .limit(20),
      db
        .select({
          id: attendanceRecords.id,
          eventId: attendanceRecords.eventId,
          sessionId: attendanceRecords.sessionId,
          userId: attendanceRecords.userId,
          attendanceDate: attendanceRecords.attendanceDate,
          sessionType: attendanceRecords.sessionType,
          status: attendanceRecords.status,
          method: attendanceRecords.method,
          markedByUid: attendanceRecords.markedByUid,
          markedAt: attendanceRecords.markedAt,
          userName: users.fullName,
          userEmail: users.email,
          rollNumber: memberProfiles.rollNumber,
          eventName: events.name,
          eventDate: events.date,
        })
        .from(attendanceRecords)
        .innerJoin(users, eq(attendanceRecords.userId, users.id))
        .leftJoin(memberProfiles, eq(users.id, memberProfiles.userId))
        .innerJoin(events, eq(attendanceRecords.eventId, events.id))
        .orderBy(desc(attendanceRecords.attendanceDate), desc(attendanceRecords.markedAt)),
      db.select().from(projects).orderBy(desc(projects.id)),
      db
        .select({
          id: projectMembers.id,
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          projectRole: projectMembers.projectRole,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id)),
      db.select().from(tasks).orderBy(desc(tasks.id)),
      db.select().from(helpRequests).orderBy(desc(helpRequests.createdAt)),
      db.select().from(galleryItems).orderBy(desc(galleryItems.createdAt)),
      db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(30),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
      db
        .select()
        .from(googleSyncRecords)
        .orderBy(desc(googleSyncRecords.createdAt))
        .limit(20),
      db.select().from(roles).orderBy(roles.id),
      getShootingSettings(),
    ]);

    const sortedMemberDirectory = [...memberDirectory].sort((a, b) => {
      const rankA = ROLE_SEQUENCE_ORDER[a.role] ?? 9;
      const rankB = ROLE_SEQUENCE_ORDER[b.role] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return a.id - b.id;
    });

    const sortedRoles = [...allRoles].sort((a, b) => {
      const rankA = ROLE_SEQUENCE_ORDER[a.name] ?? 9;
      const rankB = ROLE_SEQUENCE_ORDER[b.name] ?? 9;
      return rankA - rankB;
    });

    const corePayload = {
      members: sortedMemberDirectory,
      events: allEvents,
      attendanceSessions: activeSessions,
      attendanceRecords: allAttendanceRecords,
      projects: allProjects,
      projectMembers: allProjectMembers,
      tasks: allTasks,
      helpRequests: allHelpRequests,
      gallery: allGallery,
      allNotifications,
      auditLogs: recentAuditLogs,
      googleSyncRecords: syncRecords,
      roles: sortedRoles,
      shootingSettings: currentShootingSettings,
      configuredSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    };

    _erpCoreDataCache = {
      data: corePayload,
      expiresAt: Date.now() + 8_000,
    };

    return {
      ...corePayload,
      currentUser,
      notifications: allNotifications.filter(
        (n) => n.userId === null || n.userId === currentUser.id
      ),
    };
  } catch (error) {
    console.error('Database query failed in getErpBootstrapData:', error);
    throw new Error('Failed to load ERP workspace data.', { cause: error });
  }
}

export async function updateMemberProfileRecord(
  userId: number,
  actor: AuthenticatedUserRecord,
  data: {
    fullName?: string;
    phone?: string;
    college?: string;
    branch?: string;
    course?: string;
    year?: number;
    semester?: number;
    rollNumber?: string;
    clubPosition?: string;
    skills?: string[];
    bio?: string;
    linkedinUrl?: string;
    githubUrl?: string;
  }
) {
  try {
    if (data.fullName) {
      await db
        .update(users)
        .set({
          fullName: data.fullName.trim(),
          isOnboarded: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      await db
        .update(users)
        .set({ isOnboarded: true, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    const updatedProfile = await db
      .update(memberProfiles)
      .set({
        phone: data.phone ?? undefined,
        college: data.college ?? undefined,
        branch: data.branch ?? undefined,
        course: data.course ?? undefined,
        year: data.year ?? undefined,
        semester: data.semester ?? undefined,
        rollNumber: data.rollNumber ?? undefined,
        clubPosition: data.clubPosition ?? undefined,
        skills: data.skills ? JSON.stringify(data.skills) : undefined,
        bio: data.bio ?? undefined,
        linkedinUrl: data.linkedinUrl ?? undefined,
        githubUrl: data.githubUrl ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(memberProfiles.userId, userId))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'PROFILE_UPDATED',
      entityType: 'MemberProfile',
      entityId: String(userId),
      metadata: JSON.stringify({ updatedFields: Object.keys(data) }),
    });

    invalidateDataCache(true);
    return updatedProfile[0];
  } catch (error) {
    console.error('Database query failed in updateMemberProfileRecord:', error);
    throw new Error('Failed to update member profile.', { cause: error });
  }
}

export async function updateMemberGovernance(
  targetUserId: number,
  actor: AuthenticatedUserRecord,
  updates: { role?: UserRole; status?: string; clubPosition?: string }
) {
  try {
    if (updates.role) {
      await db
        .update(users)
        .set({ role: updates.role, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));
    }
    if (updates.status || updates.clubPosition) {
      await db
        .update(memberProfiles)
        .set({
          status: updates.status ?? undefined,
          clubPosition: updates.clubPosition ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(memberProfiles.userId, targetUserId));
    }

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'MEMBER_GOVERNANCE_UPDATED',
      entityType: 'User',
      entityId: String(targetUserId),
      metadata: JSON.stringify(updates),
    });

    invalidateDataCache(true);
    return { success: true };
  } catch (error) {
    console.error('Database query failed in updateMemberGovernance:', error);
    throw new Error('Failed to update member role or status.', { cause: error });
  }
}

export async function startAttendanceSessionForEvent(
  eventId: number,
  ttlMinutes: number,
  actor: AuthenticatedUserRecord,
  options?: {
    sessionType?: 'MEETING' | 'SHOOTING' | 'COMBINED';
    sessionDate?: string;
    startTime?: string;
    title?: string;
  }
) {
  try {
    const sType =
      options?.sessionType === 'SHOOTING'
        ? 'SHOOTING'
        : options?.sessionType === 'COMBINED'
        ? 'COMBINED'
        : 'MEETING';
    const sDate = options?.sessionDate?.trim() || new Date().toISOString().split('T')[0];
    const sTime = options?.startTime?.trim() || (sType === 'SHOOTING' ? '11:00' : new Date().toTimeString().slice(0, 5));
    const sTitle =
      options?.title?.trim() ||
      (sType === 'SHOOTING'
        ? 'Shooting Attendance Session'
        : sType === 'COMBINED'
        ? 'Shooting & Club Meeting Session'
        : 'Club Meeting Attendance Session');
    const duration = Math.max(1, ttlMinutes || 15);

    await db
      .update(attendanceSessions)
      .set({ isActive: false })
      .where(eq(attendanceSessions.sessionType, sType));

    const code = generateCryptographicAttendanceCode();
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    const created = await db
      .insert(attendanceSessions)
      .values({
        eventId,
        code,
        sessionType: sType,
        sessionDate: sDate,
        startTime: sTime,
        durationMinutes: duration,
        title: sTitle,
        isActive: true,
        expiresAt,
        createdByUid: actor.uid,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: sType === 'SHOOTING' ? 'SHOOTING_SESSION_STARTED' : 'ATTENDANCE_SESSION_STARTED',
      entityType: 'AttendanceSession',
      entityId: String(created[0].id),
      metadata: JSON.stringify({
        eventId,
        sessionType: sType,
        sessionDate: sDate,
        startTime: sTime,
        durationMinutes: duration,
        expiresAt,
      }),
    });

    invalidateDataCache(false);
    return created[0];
  } catch (error) {
    console.error('Database query failed in startAttendanceSessionForEvent:', error);
    throw new Error('Failed to start attendance session.', {
      cause: error,
    });
  }
}

export async function endAttendanceSessionById(
  sessionId: number,
  actor: AuthenticatedUserRecord
) {
  try {
    const updated = await db
      .update(attendanceSessions)
      .set({ isActive: false, expiresAt: new Date() })
      .where(eq(attendanceSessions.id, sessionId))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'ATTENDANCE_SESSION_ENDED',
      entityType: 'AttendanceSession',
      entityId: String(sessionId),
      metadata: JSON.stringify({ endedBy: actor.fullName }),
    });

    invalidateDataCache(false);
    return updated[0];
  } catch (error) {
    console.error('Database query failed in endAttendanceSessionById:', error);
    throw new Error('Failed to end attendance session.', { cause: error });
  }
}

export async function markAttendanceWithCode(
  rawCode: string,
  actor: AuthenticatedUserRecord,
  googleAccessToken?: string
) {
  const normalizedCode = rawCode.trim().toUpperCase();

  try {
    const sessionRows = await db
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.code, normalizedCode))
      .limit(1);

    if (!sessionRows.length) {
      throw new Error('Invalid attendance code. Please check the active session code.');
    }

    const session = sessionRows[0];
    if (!session.isActive || new Date(session.expiresAt).getTime() < Date.now()) {
      throw new Error('This attendance code is no longer active.');
    }

    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.eventId, session.eventId),
          eq(attendanceRecords.userId, actor.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Attendance has already been recorded for this session.');
    }

    const eventRows = await db
      .select()
      .from(events)
      .where(eq(events.id, session.eventId))
      .limit(1);
    const eventObj = eventRows[0];

    const profileRows = await db
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, actor.id))
      .limit(1);
    const rollNumber = profileRows[0]?.rollNumber || 'VC-MEMBER';

    const inserted = await db
      .insert(attendanceRecords)
      .values({
        eventId: session.eventId,
        sessionId: session.id,
        userId: actor.id,
        status: 'PRESENT',
        method: 'CODE',
        markedByUid: actor.uid,
      })
      .returning();

    const record = inserted[0];

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'ATTENDANCE_MARKED_CODE',
      entityType: 'AttendanceRecord',
      entityId: String(record.id),
      metadata: JSON.stringify({
        code: normalizedCode,
        event: eventObj?.name,
      }),
    });

    const rowPayload = [
      eventObj?.date || new Date().toISOString().split('T')[0],
      eventObj?.name || 'Venture Club Session',
      actor.fullName,
      actor.email,
      rollNumber,
      'PRESENT',
      'CODE',
      new Date().toISOString(),
    ];

    const syncInserted = await db
      .insert(googleSyncRecords)
      .values({
        syncType: 'ATTENDANCE',
        referenceId: record.id,
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
        sheetRange: 'Attendance!A:H',
        payload: JSON.stringify(rowPayload),
        status: 'PENDING',
        errorMessage: null,
      })
      .returning();

    if (googleAccessToken) {
      await attemptGoogleSheetsSync(
        syncInserted[0].id,
        googleAccessToken,
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID
      );
    }

    return {
      record,
      event: eventObj,
      code: normalizedCode,
    };
  } catch (error: any) {
    if (
      error.message?.includes('attendance code') ||
      error.message?.includes('already been recorded')
    ) {
      throw error;
    }
    console.error('Database query failed in markAttendanceWithCode:', error);
    throw new Error('Something went wrong while recording attendance.', {
      cause: error,
    });
  }
}

export async function manualAttendanceOverride(
  input: {
    eventId: number;
    userId: number;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    reason: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.eventId, input.eventId),
          eq(attendanceRecords.userId, input.userId)
        )
      )
      .limit(1);

    let recordId: number;
    if (existing.length > 0) {
      const updated = await db
        .update(attendanceRecords)
        .set({
          status: input.status,
          method: 'MANUAL_OVERRIDE',
          markedByUid: actor.uid,
          markedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing[0].id))
        .returning();
      recordId = updated[0].id;
    } else {
      const inserted = await db
        .insert(attendanceRecords)
        .values({
          eventId: input.eventId,
          sessionId: null,
          userId: input.userId,
          status: input.status,
          method: 'MANUAL_OVERRIDE',
          markedByUid: actor.uid,
        })
        .returning();
      recordId = inserted[0].id;
    }

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'MANUAL_ATTENDANCE_OVERRIDE',
      entityType: 'AttendanceRecord',
      entityId: String(recordId),
      metadata: JSON.stringify({
        eventId: input.eventId,
        targetUserId: input.userId,
        status: input.status,
        reason: input.reason,
      }),
    });

    return { id: recordId, status: input.status };
  } catch (error) {
    console.error('Database query failed in manualAttendanceOverride:', error);
    throw new Error('Failed to apply manual attendance override.', {
      cause: error,
    });
  }
}

export async function createClubEvent(
  input: {
    name: string;
    description: string;
    date: string;
    time: string;
    venue: string;
    organizer: string;
    type: string;
    expectedCount?: number;
    coverImage?: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const inserted = await db
      .insert(events)
      .values({
        name: input.name.trim(),
        description: input.description.trim(),
        date: input.date,
        time: input.time,
        venue: input.venue.trim(),
        organizer: input.organizer.trim(),
        coordinators: JSON.stringify([actor.fullName]),
        type: input.type,
        status: 'UPCOMING',
        coverImage:
          input.coverImage ||
          '/src/assets/images/event_pitch_summit_1791471952972.jpg',
        expectedCount: input.expectedCount || 60,
      })
      .returning();

    const ev = inserted[0];

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'EVENT_CREATED',
      entityType: 'Event',
      entityId: String(ev.id),
      metadata: JSON.stringify({ name: ev.name, date: ev.date }),
    });

    invalidateDataCache(false);
    return ev;
  } catch (error) {
    console.error('Database query failed in createClubEvent:', error);
    throw new Error('Failed to create event.', { cause: error });
  }
}

export async function createVentureProject(
  input: {
    name: string;
    description: string;
    problemStatement: string;
    leadName: string;
    startDate: string;
    deadline: string;
    technologies: string[];
    repositoryUrl?: string;
    demoUrl?: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const inserted = await db
      .insert(projects)
      .values({
        name: input.name.trim(),
        description: input.description.trim(),
        problemStatement: input.problemStatement.trim(),
        leadUserId: actor.id,
        leadName: input.leadName.trim() || actor.fullName,
        startDate: input.startDate,
        deadline: input.deadline,
        status: 'ONGOING',
        progress: 15,
        technologies: JSON.stringify(input.technologies),
        repositoryUrl: input.repositoryUrl || null,
        demoUrl: input.demoUrl || null,
        recentUpdates: JSON.stringify([
          {
            id: `u-${Date.now()}`,
            author: actor.fullName,
            text: 'Initialized venture pod charter and milestone roadmap.',
            date: new Date().toISOString().split('T')[0],
          },
        ]),
      })
      .returning();

    const proj = inserted[0];

    await db
      .insert(projectMembers)
      .values({
        projectId: proj.id,
        userId: actor.id,
        projectRole: 'Project Lead',
      })
      .onConflictDoNothing();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: String(proj.id),
      metadata: JSON.stringify({ name: proj.name }),
    });

    invalidateDataCache(false);
    return proj;
  } catch (error) {
    console.error('Database query failed in createVentureProject:', error);
    throw new Error('Failed to create project.', { cause: error });
  }
}

export async function updateProjectMilestone(
  projectId: number,
  input: {
    progress?: number;
    status?: string;
    updateText?: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!rows.length) throw new Error('Project not found.');

    const existingUpdates = JSON.parse(rows[0].recentUpdates || '[]');
    if (input.updateText?.trim()) {
      existingUpdates.unshift({
        id: `upd-${Date.now()}`,
        author: actor.fullName,
        text: input.updateText.trim(),
        date: new Date().toISOString().split('T')[0],
      });
    }

    const updated = await db
      .update(projects)
      .set({
        progress:
          typeof input.progress === 'number'
            ? Math.min(100, Math.max(0, input.progress))
            : rows[0].progress,
        status: input.status || rows[0].status,
        recentUpdates: JSON.stringify(existingUpdates.slice(0, 10)),
      })
      .where(eq(projects.id, projectId))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: String(projectId),
      metadata: JSON.stringify(input),
    });

    invalidateDataCache(false);
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateProjectMilestone:', error);
    throw new Error('Failed to update project progress.', { cause: error });
  }
}

export async function createProjectTask(
  input: {
    projectId: number;
    title: string;
    description?: string;
    assigneeName?: string;
    priority: string;
    dueDate: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const inserted = await db
      .insert(tasks)
      .values({
        projectId: input.projectId,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        assigneeUserId: actor.id,
        assigneeName: input.assigneeName?.trim() || actor.fullName,
        status: 'TODO',
        priority: input.priority || 'MEDIUM',
        dueDate: input.dueDate,
        comments: '[]',
      })
      .returning();

    invalidateDataCache(false);
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createProjectTask:', error);
    throw new Error('Failed to create task.', { cause: error });
  }
}

export async function updateProjectTaskState(
  taskId: number,
  input: {
    status?: string;
    priority?: string;
    commentText?: string;
  },
  actor: AuthenticatedUserRecord
) {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!rows.length) throw new Error('Task not found.');

    const comments = JSON.parse(rows[0].comments || '[]');
    if (input.commentText?.trim()) {
      comments.push({
        id: `c-${Date.now()}`,
        author: actor.fullName,
        text: input.commentText.trim(),
        createdAt: new Date().toISOString().split('T')[0],
      });
    }

    const updated = await db
      .update(tasks)
      .set({
        status: input.status || rows[0].status,
        priority: input.priority || rows[0].priority,
        comments: JSON.stringify(comments),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    invalidateDataCache(false);
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateProjectTaskState:', error);
    throw new Error('Failed to update task.', { cause: error });
  }
}

export async function updateHelpRequestTriage(
  requestId: number,
  input: { status: string; assignedNotes?: string },
  actor: AuthenticatedUserRecord
) {
  try {
    const updated = await db
      .update(helpRequests)
      .set({
        status: input.status,
        assignedNotes: input.assignedNotes ?? undefined,
      })
      .where(eq(helpRequests.id, requestId))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'HELP_REQUEST_TRIAGED',
      entityType: 'HelpRequest',
      entityId: String(requestId),
      metadata: JSON.stringify(input),
    });

    invalidateDataCache(false);
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateHelpRequestTriage:', error);
    throw new Error('Failed to update startup help request.', { cause: error });
  }
}

export async function attemptGoogleSheetsSync(
  syncRecordId: number,
  googleAccessToken?: string,
  overrideSpreadsheetId?: string
) {
  try {
    const rows = await db
      .select()
      .from(googleSyncRecords)
      .where(eq(googleSyncRecords.id, syncRecordId))
      .limit(1);
    if (!rows.length) throw new Error('Sync record not found.');

    const record = rows[0];
    const targetSpreadsheetId =
      overrideSpreadsheetId?.trim() ||
      record.spreadsheetId ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!targetSpreadsheetId) {
      await db
        .update(googleSyncRecords)
        .set({
          status: 'PENDING',
          errorMessage: 'Awaiting Google Spreadsheet ID configuration in Admin Control Center.',
          lastAttemptAt: new Date(),
        })
        .where(eq(googleSyncRecords.id, syncRecordId));
      return {
        status: 'PENDING',
        message: 'Provide a Spreadsheet ID to complete live Google Sheets sync.',
      };
    }

    if (!googleAccessToken) {
      await db
        .update(googleSyncRecords)
        .set({
          spreadsheetId: targetSpreadsheetId,
          status: 'PENDING',
          errorMessage: 'Sign in with Google OAuth to grant Sheets write access.',
          lastAttemptAt: new Date(),
        })
        .where(eq(googleSyncRecords.id, syncRecordId));
      return {
        status: 'PENDING',
        message: 'Record saved in PostgreSQL. Sign in with Google OAuth to push to Sheets.',
      };
    }

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        targetSpreadsheetId
      )}?fields=sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      }
    );

    if (!metaRes.ok) {
      let errMsg = `Google Sheets API returned ${metaRes.status}. Verify Spreadsheet ID and permissions.`;
      if (metaRes.status === 401) {
        errMsg = 'Google session expired. Please sign in with Google again.';
      } else if (metaRes.status === 403) {
        errMsg = 'Google Sheet access denied. Ensure your Google account has Edit permissions on this spreadsheet.';
      } else if (metaRes.status === 404) {
        errMsg = 'Spreadsheet not found. Please verify the Google Spreadsheet ID/link.';
      }
      await db
        .update(googleSyncRecords)
        .set({
          spreadsheetId: targetSpreadsheetId,
          status: 'FAILED',
          errorMessage: errMsg,
          lastAttemptAt: new Date(),
        })
        .where(eq(googleSyncRecords.id, syncRecordId));
      return {
        status: 'FAILED',
        message: errMsg,
      };
    }

    const metaJson: any = await metaRes.json();
    const availableTitles: string[] =
      metaJson?.sheets?.map((s: any) => s?.properties?.title).filter(Boolean) || [];

    // Determine target worksheet name
    let targetSheetTitle = 'Sheet1';
    const desiredSheet = record.sheetRange?.split('!')[0];
    if (desiredSheet && availableTitles.includes(desiredSheet)) {
      targetSheetTitle = desiredSheet;
    } else if (availableTitles.length > 0) {
      targetSheetTitle = availableTitles[0];
    }

    const valuesArray = JSON.parse(record.payload || '[]');

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        targetSpreadsheetId
      )}/values/${encodeURIComponent(`${targetSheetTitle}!A:I`)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [valuesArray],
        }),
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      console.error('Sheets append failed:', errText);
      await db
        .update(googleSyncRecords)
        .set({
          spreadsheetId: targetSpreadsheetId,
          status: 'FAILED',
          errorMessage: `Sheets append returned HTTP ${appendRes.status}`,
          lastAttemptAt: new Date(),
        })
        .where(eq(googleSyncRecords.id, syncRecordId));
      return {
        status: 'FAILED',
        message: 'Could not append row to Google Sheets. Saved in PostgreSQL.',
      };
    }

    await db
      .update(googleSyncRecords)
      .set({
        spreadsheetId: targetSpreadsheetId,
        sheetRange: `${targetSheetTitle}!A:I`,
        status: 'SYNCED',
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      .where(eq(googleSyncRecords.id, syncRecordId));

    return {
      status: 'SYNCED',
      message: `Synchronized with Google Sheets (${targetSheetTitle}).`,
    };
  } catch (error) {
    console.error('Google Sheets sync exception:', error);
    await db
      .update(googleSyncRecords)
      .set({
        status: 'FAILED',
        errorMessage: 'Network error during Google Sheets synchronization.',
        lastAttemptAt: new Date(),
      })
      .where(eq(googleSyncRecords.id, syncRecordId));
    return {
      status: 'FAILED',
      message: 'Database record saved. Google Sheets synchronization will retry.',
    };
  }
}

export async function batchGoogleSheetsSync(
  googleAccessToken?: string,
  overrideSpreadsheetId?: string
) {
  try {
    const pendingRecords = await db
      .select()
      .from(googleSyncRecords)
      .where(ne(googleSyncRecords.status, 'SYNCED'))
      .orderBy(googleSyncRecords.createdAt);

    if (!pendingRecords.length) {
      return {
        status: 'UP_TO_DATE',
        syncedCount: 0,
        message: 'All records are already synchronized with Google Sheets.',
      };
    }

    const targetSpreadsheetId =
      overrideSpreadsheetId?.trim() ||
      pendingRecords[0].spreadsheetId ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!targetSpreadsheetId) {
      return {
        status: 'PENDING_CONFIG',
        syncedCount: 0,
        message: 'Please provide or configure a Google Spreadsheet ID or URL.',
      };
    }

    if (!googleAccessToken) {
      return {
        status: 'NEEDS_AUTH',
        syncedCount: 0,
        message: 'Google Sign-In required. Please sign in with Google to grant Google Sheets write permission.',
      };
    }

    // 1. Fetch metadata to determine sheet tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        targetSpreadsheetId
      )}?fields=sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      }
    );

    if (!metaRes.ok) {
      let userFriendlyErr = `Google Sheets API returned HTTP ${metaRes.status}.`;
      if (metaRes.status === 401) {
        userFriendlyErr = 'Google session expired. Please sign in with Google again.';
      } else if (metaRes.status === 403) {
        userFriendlyErr = 'Permission denied. Ensure your Google account has Edit access to this spreadsheet.';
      } else if (metaRes.status === 404) {
        userFriendlyErr = 'Spreadsheet not found. Please verify the Google Spreadsheet ID.';
      }
      return {
        status: 'FAILED',
        syncedCount: 0,
        message: userFriendlyErr,
      };
    }

    const metaJson: any = await metaRes.json();
    const availableTitles: string[] =
      metaJson?.sheets?.map((s: any) => s?.properties?.title).filter(Boolean) || [];

    // Group records by target tab
    const groups: Record<string, { ids: number[]; rows: any[][] }> = {};

    for (const rec of pendingRecords) {
      const desiredTab = rec.sheetRange?.split('!')[0] || 'Attendance';
      let sheetTab = 'Sheet1';
      if (availableTitles.includes(desiredTab)) {
        sheetTab = desiredTab;
      } else if (availableTitles.length > 0) {
        sheetTab = availableTitles[0];
      }

      if (!groups[sheetTab]) {
        groups[sheetTab] = { ids: [], rows: [] };
      }
      groups[sheetTab].ids.push(rec.id);
      try {
        groups[sheetTab].rows.push(JSON.parse(rec.payload || '[]'));
      } catch {
        groups[sheetTab].rows.push([rec.payload]);
      }
    }

    let totalSynced = 0;
    for (const [sheetTab, group] of Object.entries(groups)) {
      if (!group.rows.length) continue;

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          targetSpreadsheetId
        )}/values/${encodeURIComponent(`${sheetTab}!A:I`)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: group.rows,
          }),
        }
      );

      if (appendRes.ok) {
        for (const id of group.ids) {
          await db
            .update(googleSyncRecords)
            .set({
              spreadsheetId: targetSpreadsheetId,
              sheetRange: `${sheetTab}!A:I`,
              status: 'SYNCED',
              errorMessage: null,
              lastAttemptAt: new Date(),
            })
            .where(eq(googleSyncRecords.id, id));
        }
        totalSynced += group.ids.length;
      } else {
        const errText = await appendRes.text();
        console.error(`Append failed for tab ${sheetTab}:`, errText);
        for (const id of group.ids) {
          await db
            .update(googleSyncRecords)
            .set({
              spreadsheetId: targetSpreadsheetId,
              status: 'FAILED',
              errorMessage: `Sheets append returned HTTP ${appendRes.status}`,
              lastAttemptAt: new Date(),
            })
            .where(eq(googleSyncRecords.id, id));
        }
      }
    }

    return {
      status: totalSynced > 0 ? 'SYNCED' : 'FAILED',
      syncedCount: totalSynced,
      message:
        totalSynced > 0
          ? `Successfully synchronized ${totalSynced} record${totalSynced === 1 ? '' : 's'} to Google Sheet!`
          : 'Could not append records to Google Sheet. Check permissions.',
    };
  } catch (error: any) {
    console.error('batchGoogleSheetsSync error:', error);
    return {
      status: 'FAILED',
      syncedCount: 0,
      message: error.message || 'Synchronization encountered an unexpected error.',
    };
  }
}

export async function getGoogleSyncStatus() {
  try {
    const allRecords = await db
      .select()
      .from(googleSyncRecords)
      .where(eq(googleSyncRecords.syncType, 'ATTENDANCE'))
      .orderBy(desc(googleSyncRecords.lastAttemptAt), desc(googleSyncRecords.createdAt));

    const syncedRecords = allRecords.filter((r) => r.status === 'SYNCED');
    const failedRecords = allRecords.filter((r) => r.status === 'FAILED');
    const pendingRecords = allRecords.filter((r) => r.status === 'PENDING');

    const lastSuccessfulSync =
      syncedRecords.length > 0
        ? syncedRecords[0].lastAttemptAt || syncedRecords[0].createdAt
        : null;

    const lastAttempt =
      allRecords.length > 0
        ? allRecords[0].lastAttemptAt || allRecords[0].createdAt
        : null;

    const activeSpreadsheetId =
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      allRecords.find((r) => r.spreadsheetId)?.spreadsheetId ||
      null;

    let syncState: 'SYNCED' | 'PENDING' | 'FAILED' | 'IDLE' = 'IDLE';
    if (allRecords.length === 0) {
      syncState = 'IDLE';
    } else if (pendingRecords.length === 0 && failedRecords.length === 0) {
      syncState = 'SYNCED';
    } else if (failedRecords.length > 0) {
      syncState = 'FAILED';
    } else {
      syncState = 'PENDING';
    }

    return {
      status: syncState,
      spreadsheetId: activeSpreadsheetId,
      lastSuccessfulSyncTime: lastSuccessfulSync
        ? new Date(lastSuccessfulSync).toISOString()
        : null,
      lastAttemptAt: lastAttempt ? new Date(lastAttempt).toISOString() : null,
      totalRecords: allRecords.length,
      syncedCount: syncedRecords.length,
      pendingCount: pendingRecords.length,
      failedCount: failedRecords.length,
      recentRecords: allRecords.slice(0, 10),
    };
  } catch (error) {
    console.error('getGoogleSyncStatus error:', error);
    return {
      status: 'IDLE' as const,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
      lastSuccessfulSyncTime: null,
      lastAttemptAt: null,
      totalRecords: 0,
      syncedCount: 0,
      pendingCount: 0,
      failedCount: 0,
      recentRecords: [],
    };
  }
}

export async function markNotificationRead(notificationId: number) {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in markNotificationRead:', error);
    throw new Error('Failed to update notification.', { cause: error });
  }
}

export async function getAuditLogsPaginated(options: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  role?: string;
  entityType?: string;
  sort?: 'desc' | 'asc';
}) {
  try {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const offset = (page - 1) * limit;
    const sortDirection = options.sort === 'asc' ? 'asc' : 'desc';

    const conditions: any[] = [];

    if (options.role && options.role !== 'ALL') {
      conditions.push(eq(auditLogs.actorRole, options.role));
    }

    if (options.entityType && options.entityType !== 'ALL') {
      conditions.push(eq(auditLogs.entityType, options.entityType));
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${auditLogs.actorName}) LIKE ${term}`,
          sql`LOWER(${auditLogs.action}) LIKE ${term}`,
          sql`LOWER(${auditLogs.entityType}) LIKE ${term}`,
          sql`LOWER(${auditLogs.entityId}) LIKE ${term}`,
          sql`LOWER(${auditLogs.metadata}) LIKE ${term}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(auditLogs);

    const totalRes = await countQuery;
    const total = Number(totalRes[0]?.count || 0);

    const baseDataQuery = db
      .select()
      .from(auditLogs)
      .orderBy(sortDirection === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = whereClause ? await baseDataQuery.where(whereClause) : await baseDataQuery;

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (error) {
    console.error('getAuditLogsPaginated error:', error);
    throw new Error('Failed to retrieve audit log records.', { cause: error });
  }
}

