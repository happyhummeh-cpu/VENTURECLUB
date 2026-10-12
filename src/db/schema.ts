import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    username: text('username'),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('MEMBER'), // SUPER_ADMIN | ADMIN | ATTENDANCE_COORDINATOR | PROJECT_LEAD | MEMBER
    canTakeAttendance: boolean('can_take_attendance').notNull().default(false),
    permissions: text('permissions').notNull().default('[]'),
    isActive: boolean('is_active').notNull().default(true),
    isOnboarded: boolean('is_onboarded').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_role_idx').on(table.role),
    index('users_email_idx').on(table.email),
    index('users_username_idx').on(table.username),
  ]
);

export const memberProfiles = pgTable(
  'member_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    phone: text('phone'),
    college: text('college').notNull().default('Institute of Engineering & Venture Design'),
    branch: text('branch').notNull().default('Computer Science & Engineering'),
    course: text('course').notNull().default('B.Tech'),
    year: integer('year').notNull().default(3),
    semester: integer('semester').notNull().default(5),
    rollNumber: text('roll_number').notNull().default('VC-2026-001'),
    clubPosition: text('club_position').notNull().default('Venture Fellow'),
    joiningDate: text('joining_date').notNull().default('2025-08-15'),
    skills: text('skills').notNull().default('["Product Strategy","Full-Stack"]'),
    bio: text('bio'),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | INACTIVE | ALUMNI | ON_LEAVE
    linkedinUrl: text('linkedin_url'),
    githubUrl: text('github_url'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('member_profiles_status_idx').on(table.status),
    index('member_profiles_roll_idx').on(table.rollNumber),
  ]
);

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  permissions: text('permissions').notNull(), // JSON string array
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    date: text('date').notNull(),
    time: text('time').notNull(),
    venue: text('venue').notNull(),
    organizer: text('organizer').notNull(),
    coordinators: text('coordinators').notNull().default('[]'),
    type: text('type').notNull().default('General Meeting'),
    status: text('status').notNull().default('UPCOMING'), // UPCOMING | ONGOING | COMPLETED | CANCELLED
    coverImage: text('cover_image'),
    gallery: text('gallery').notNull().default('[]'),
    expectedCount: integer('expected_count').notNull().default(60),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('events_status_idx').on(table.status),
    index('events_date_idx').on(table.date),
  ]
);

export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull().unique(),
    sessionType: text('session_type').notNull().default('MEETING'), // MEETING | SHOOTING
    sessionDate: text('session_date').notNull().default('2026-10-09'),
    startTime: text('start_time').notNull().default('11:00'),
    durationMinutes: integer('duration_minutes').notNull().default(15),
    title: text('title').notNull().default('Shooting & Club Meetings'),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at').notNull(),
    createdByUid: text('created_by_uid').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('attendance_sessions_event_idx').on(table.eventId),
    index('attendance_sessions_code_idx').on(table.code),
    index('attendance_sessions_date_idx').on(table.sessionDate),
  ]
);

export const shootingSettings = pgTable('shooting_settings', {
  id: serial('id').primaryKey(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  defaultStartTime: text('default_start_time').notNull().default('11:00'),
  sessionTitle: text('session_title').notNull().default('Shooting Attendance'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  updatedByUid: text('updated_by_uid'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: integer('session_id').references(() => attendanceSessions.id, {
      onDelete: 'set null',
    }),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    attendanceDate: text('attendance_date').notNull().default('2026-10-09'),
    sessionType: text('session_type').notNull().default('MEETING'), // MEETING | SHOOTING
    status: text('status').notNull().default('PRESENT'), // PRESENT | LATE | EXIT | ABSENT
    method: text('method').notNull().default('MANUAL_OVERRIDE'), // MANUAL_OVERRIDE | SESSION
    markedByUid: text('marked_by_uid'),
    markedAt: timestamp('marked_at').defaultNow().notNull(),
  },
  (table) => [
    index('attendance_records_user_idx').on(table.userId),
    index('attendance_records_date_idx').on(table.attendanceDate),
    index('attendance_records_daily_lookup_idx').on(
      table.userId,
      table.attendanceDate,
      table.sessionType
    ),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    problemStatement: text('problem_statement').notNull(),
    leadUserId: integer('lead_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    leadName: text('lead_name').notNull(),
    startDate: text('start_date').notNull(),
    deadline: text('deadline').notNull(),
    status: text('status').notNull().default('ONGOING'), // PLANNING | ONGOING | ON_HOLD | COMPLETED | CANCELLED
    progress: integer('progress').notNull().default(0),
    technologies: text('technologies').notNull().default('[]'),
    repositoryUrl: text('repository_url'),
    demoUrl: text('demo_url'),
    recentUpdates: text('recent_updates').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('projects_status_idx').on(table.status)]
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectRole: text('project_role').notNull().default('Builder'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('project_member_unique').on(table.projectId, table.userId),
  ]
);

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    assigneeUserId: integer('assignee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    assigneeName: text('assignee_name'),
    status: text('status').notNull().default('TODO'), // TODO | IN_PROGRESS | REVIEW | COMPLETED
    priority: text('priority').notNull().default('MEDIUM'), // LOW | MEDIUM | HIGH | URGENT
    dueDate: text('due_date').notNull(),
    comments: text('comments').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('tasks_project_idx').on(table.projectId),
    index('tasks_status_idx').on(table.status),
  ]
);

export const helpRequests = pgTable(
  'help_requests',
  {
    id: serial('id').primaryKey(),
    founderName: text('founder_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    startupName: text('startup_name').notNull(),
    category: text('category').notNull(),
    problemDescription: text('problem_description').notNull(),
    websiteOrLinkedin: text('website_or_linkedin'),
    status: text('status').notNull().default('NEW'), // NEW | CONTACTED | IN_DISCUSSION | RESOLVED | CLOSED
    assignedNotes: text('assigned_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('help_requests_status_idx').on(table.status)]
);

export const galleryItems = pgTable('gallery_items', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  caption: text('caption').notNull(),
  mediaType: text('media_type').notNull().default('IMAGE'), // IMAGE | VIDEO
  mediaUrl: text('media_url').notNull(),
  category: text('category').notNull().default('Summit'),
  eventDate: text('event_date').notNull(),
  isApproved: boolean('is_approved').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('ANNOUNCEMENT'), // EVENT | PROJECT | TASK | ATTENDANCE | ANNOUNCEMENT
    isRead: boolean('is_read').notNull().default(false),
    linkPath: text('link_path'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUid: text('actor_uid').notNull(),
    actorName: text('actor_name').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

export const googleSyncRecords = pgTable(
  'google_sync_records',
  {
    id: serial('id').primaryKey(),
    syncType: text('sync_type').notNull(), // ATTENDANCE | HELP_REQUEST
    referenceId: integer('reference_id').notNull(),
    spreadsheetId: text('spreadsheet_id'),
    sheetRange: text('sheet_range').notNull().default('Sheet1!A:H'),
    payload: text('payload').notNull(), // JSON array of values
    status: text('status').notNull().default('PENDING'), // SYNCED | PENDING | FAILED
    errorMessage: text('error_message'),
    lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('google_sync_status_idx').on(table.status)]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(memberProfiles, {
    fields: [users.id],
    references: [memberProfiles.userId],
  }),
  attendanceRecords: many(attendanceRecords),
  projectMemberships: many(projectMembers),
  assignedTasks: many(tasks),
  notifications: many(notifications),
}));

export const memberProfilesRelations = relations(memberProfiles, ({ one }) => ({
  user: one(users, {
    fields: [memberProfiles.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  sessions: many(attendanceSessions),
  attendanceRecords: many(attendanceRecords),
}));

export const attendanceSessionsRelations = relations(
  attendanceSessions,
  ({ one, many }) => ({
    event: one(events, {
      fields: [attendanceSessions.eventId],
      references: [events.id],
    }),
    records: many(attendanceRecords),
  })
);

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    event: one(events, {
      fields: [attendanceRecords.eventId],
      references: [events.id],
    }),
    session: one(attendanceSessions, {
      fields: [attendanceRecords.sessionId],
      references: [attendanceSessions.id],
    }),
    user: one(users, {
      fields: [attendanceRecords.userId],
      references: [users.id],
    }),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  lead: one(users, {
    fields: [projects.leadUserId],
    references: [users.id],
  }),
  members: many(projectMembers),
  tasks: many(tasks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeUserId],
    references: [users.id],
  }),
}));
