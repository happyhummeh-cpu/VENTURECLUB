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

export const ROLE_LABELS: Record<UserRole, string> = {
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  SECRETARY: 'Secretary',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PROJECT_LEAD: 'Project Lead',
  ATTENDANCE_HEAD: 'Attendance Head',
  MEDIA_HEAD: 'Media Head',
  MEMBER: 'Member',
};

export const ALL_USER_ROLES: UserRole[] = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'SUPER_ADMIN',
  'ADMIN',
  'PROJECT_LEAD',
  'ATTENDANCE_HEAD',
  'MEDIA_HEAD',
  'MEMBER',
];

export const ROLE_SEQUENCE_NUMBER: Record<string, number> = {
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

export const FIRST_PAGE_CORE_ROLES: UserRole[] = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'PROJECT_LEAD',
  'ATTENDANCE_HEAD',
  'MEDIA_HEAD',
];
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'ON_LEAVE';
export type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type ProjectStatus = 'PLANNING' | 'ONGOING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type HelpRequestStatus = 'NEW' | 'CONTACTED' | 'IN_DISCUSSION' | 'RESOLVED' | 'CLOSED';

export interface MemberDirectoryItem {
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
  profileId?: number;
  phone: string | null;
  college: string;
  branch: string;
  course: string;
  year: number;
  semester: number;
  rollNumber: string;
  clubPosition: string;
  joiningDate: string;
  skills: string;
  bio: string | null;
  status: MemberStatus;
  linkedinUrl: string | null;
  githubUrl: string | null;
}

export interface ClubEvent {
  id: number;
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  organizer: string;
  coordinators: string;
  type: string;
  status: EventStatus;
  coverImage: string | null;
  gallery: string;
  expectedCount: number;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'EXIT' | 'ABSENT' | 'EXCUSED';

export interface ShootingSettings {
  id: number;
  isEnabled: boolean;
  defaultStartTime: string;
  sessionTitle: string;
  durationMinutes: number;
  updatedByUid: string | null;
  updatedAt: string;
}

export interface AttendanceSession {
  id: number;
  eventId: number;
  code: string;
  sessionType: 'MEETING' | 'SHOOTING';
  sessionDate: string;
  startTime: string;
  durationMinutes: number;
  title: string;
  isActive: boolean;
  expiresAt: string;
  createdByUid: string;
  createdAt: string;
}

export interface AttendanceRecordItem {
  id: number;
  eventId: number;
  sessionId: number | null;
  userId: number;
  attendanceDate: string;
  sessionType: 'MEETING' | 'SHOOTING';
  status: AttendanceStatus;
  method: 'CODE' | 'MANUAL_OVERRIDE' | 'SESSION';
  markedByUid: string | null;
  markedAt: string;
  userName: string;
  userEmail: string;
  rollNumber: string | null;
  eventName: string;
  eventDate: string;
}

export interface VentureProject {
  id: number;
  name: string;
  description: string;
  problemStatement: string;
  leadUserId: number | null;
  leadName: string;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  progress: number;
  technologies: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  recentUpdates: string;
}

export interface ProjectMemberItem {
  id: number;
  projectId: number;
  userId: number;
  projectRole: string;
  fullName: string;
  email: string;
  role: string;
}

export interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  assigneeUserId: number | null;
  assigneeName: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  comments: string;
}

export interface StartupHelpRequest {
  id: number;
  founderName: string;
  email: string;
  phone: string | null;
  startupName: string;
  category: string;
  problemDescription: string;
  websiteOrLinkedin: string | null;
  status: HelpRequestStatus;
  assignedNotes: string | null;
  createdAt: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  category: string;
  eventDate: string;
  isApproved: boolean;
}

export interface NotificationItem {
  id: number;
  userId: number | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkPath: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: number;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string;
  createdAt: string;
}

export interface GoogleSyncRecordItem {
  id: number;
  syncType: 'ATTENDANCE' | 'HELP_REQUEST';
  referenceId: number;
  spreadsheetId: string | null;
  sheetRange: string;
  payload: string;
  status: 'SYNCED' | 'PENDING' | 'FAILED';
  errorMessage: string | null;
  lastAttemptAt: string;
}

export interface GoogleSyncStatusInfo {
  status: 'SYNCED' | 'PENDING' | 'FAILED' | 'IDLE';
  spreadsheetId: string | null;
  lastSuccessfulSyncTime: string | null;
  lastAttemptAt: string | null;
  totalRecords: number;
  syncedCount: number;
  pendingCount: number;
  failedCount: number;
  recentRecords?: GoogleSyncRecordItem[];
}

export interface RoleDefinition {
  id: number;
  name: UserRole;
  description: string;
  permissions: string;
}

export interface ErpBootstrapPayload {
  currentUser: {
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
  };
  members: MemberDirectoryItem[];
  events: ClubEvent[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecordItem[];
  projects: VentureProject[];
  projectMembers: ProjectMemberItem[];
  tasks: ProjectTask[];
  helpRequests: StartupHelpRequest[];
  gallery: GalleryItem[];
  notifications: NotificationItem[];
  auditLogs: AuditLogItem[];
  googleSyncRecords: GoogleSyncRecordItem[];
  roles: RoleDefinition[];
  shootingSettings: ShootingSettings;
  configuredSpreadsheetId?: string | null;
}
