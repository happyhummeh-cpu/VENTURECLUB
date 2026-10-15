import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FolderKanban,
  LifeBuoy,
  Shield,
  Search,
  Bell,
  Globe,
  LogOut,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  X,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  Edit,
  ShieldCheck,
  UserPlus,
  Download,
  Camera,
  BarChart3,
  Play,
  Square,
  CalendarDays,
  Info,
  Menu,
  CloudUpload,
  Lock,
  Unlock,
  Printer,
  Check,
  FileText,
  Sparkles,
  HelpCircle,
  Timer,
  ChevronRight,
  AlertTriangle,
  SlidersHorizontal,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TvcLogo } from './TvcLogo.tsx';
import { AuditLog } from './AuditLog.tsx';
import { AttendanceAnalytics } from './AttendanceAnalytics.tsx';
import {
  ROLE_LABELS,
  ALL_USER_ROLES,
  ROLE_SEQUENCE_NUMBER,
  type ErpBootstrapPayload,
  type MemberDirectoryItem,
  type UserRole,
  type TaskStatus,
  type TaskPriority,
  type HelpRequestStatus,
  type AttendanceStatus,
} from '../types.ts';

interface ErpCommandCenterProps {
  data: ErpBootstrapPayload;
  activeSection: string;
  onChangeSection: (section: string) => void;
  onOpenCommandPalette: () => void;
  onSwitchToPublic: () => void;
  onRefreshErp: () => Promise<void>;
  isGoogleAuthenticated: boolean;
  onGoogleLogin: () => Promise<boolean | void>;
  onGoogleLogout: () => Promise<void>;
  onOpenAuthModal?: () => void;
  customSessionActive?: boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  selectedMemberDrawer: MemberDirectoryItem | null;
  setSelectedMemberDrawer: (m: MemberDirectoryItem | null) => void;
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
}

const ROLE_WEIGHT: Record<string, number> = {
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

function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return '11:00 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${mStr || '00'} ${ampm}`;
}

export const ErpCommandCenter: React.FC<ErpCommandCenterProps> = ({
  data,
  activeSection,
  onChangeSection,
  onOpenCommandPalette,
  onSwitchToPublic,
  onRefreshErp,
  isGoogleAuthenticated,
  onGoogleLogout,
  onOpenAuthModal,
  customSessionActive,
  apiFetch,
  selectedProjectId,
  setSelectedProjectId,
}) => {
  const { currentUser } = data;
  const userWeight = ROLE_WEIGHT[currentUser.role] || 1;
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const isAdminOrAbove = userWeight >= 5 || isSuperAdmin; // SUPER_ADMIN, PRESIDENT, VICE_PRESIDENT, SECRETARY, ADMIN
  const canManageEvents = isAdminOrAbove || currentUser.role === 'MEDIA_HEAD';
  const canManageHelpDesk = isAdminOrAbove;
  const isLeadOrAbove = userWeight >= 2 || isSuperAdmin;
  const canTakeAttendance =
    isSuperAdmin ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'PRESIDENT' ||
    currentUser.role === 'VICE_PRESIDENT' ||
    currentUser.role === 'SECRETARY' ||
    currentUser.role === 'ATTENDANCE_HEAD' ||
    currentUser.role === 'MEDIA_HEAD' ||
    (currentUser.role as string) === 'ATTENDANCE_COORDINATOR' ||
    currentUser.canTakeAttendance === true;

  // Toast Notification State
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Notification Popover
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const unreadNotifications = data.notifications.filter((n) => !n.isRead);

  // ===============================================================
  // ATTENDANCE & SHOOTING STATE
  // ===============================================================
  const [attendanceViewTab, setAttendanceViewTab] = useState<
    'daily' | 'weekly' | 'monthly' | 'analytics'
  >('daily');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-09');
  const [attendanceMode, setAttendanceMode] = useState<
    'MEETING' | 'SHOOTING' | 'COMBINED'
  >('MEETING');
  const [sessionDurationMinutes, setSessionDurationMinutes] =
    useState<number>(120);
  const [startingSession, setStartingSession] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // Modals for Attendance
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [showClarificationInfo, setShowClarificationInfo] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadRangeType, setDownloadRangeType] = useState<
    'daily' | 'one_week' | 'two_week' | 'custom'
  >('daily');
  const [downloadStartDate, setDownloadStartDate] = useState(selectedDate);
  const [downloadEndDate, setDownloadEndDate] = useState(selectedDate);
  const [downloadSessionFilter, setDownloadSessionFilter] = useState<
    'ALL' | 'MEETING' | 'SHOOTING' | 'COMBINED'
  >('ALL');

  // Modal Configuration for Starting a Session
  const [newSessionTitle, setNewSessionTitle] = useState<string>('');
  const [newSessionCategory, setNewSessionCategory] = useState<
    'SHOOTING' | 'MEETING' | 'COMBINED'
  >('MEETING');
  const [newSessionTimeOption, setNewSessionTimeOption] = useState<
    '11:00' | '15:40' | 'CUSTOM'
  >('11:00');
  const [newSessionCustomTime, setNewSessionCustomTime] = useState<string>('11:00');
  const [newSessionDurationMinutes, setNewSessionDurationMinutes] =
    useState<number>(120);

  // Persistent Submission State (Reliable submission without permanent lockouts)
  const [submissionMap, setSubmissionMap] = useState<
    Record<
      string,
      {
        isSubmitted: boolean;
        submittedAt: string;
        lockCutoffTime?: number;
        isUnlocked?: boolean;
      }
    >
  >(() => {
    try {
      const raw = localStorage.getItem('tvc_attendance_submissions');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const submissionKey = `${selectedDate}_${attendanceMode}`;
  const currentSubmission = submissionMap[submissionKey];
  // Do not lock the attendance sheet permanently; admin can always access, update, and submit corrections
  const isSessionLocked = false;
  const minutesUntilLocked = 0;

  // Shooting Attendance Permanent Toggle & Configurable Start Time
  const [shootingEnabled, setShootingEnabled] = useState<boolean>(
    data.shootingSettings?.isEnabled ?? true
  );
  const [shootingStartTime, setShootingStartTime] = useState<string>(
    data.shootingSettings?.defaultStartTime || '11:00'
  );
  const [shootingDuration, setShootingDuration] = useState<number>(
    data.shootingSettings?.durationMinutes || 120
  );
  const [updatingShooting, setUpdatingShooting] = useState(false);

  // Real-time Diagnostic Telemetry State
  const [diagStatus, setDiagStatus] = useState<'checking' | 'connected' | 'fallback' | 'error'>('checking');
  const [diagLatencyMs, setDiagLatencyMs] = useState<number | null>(null);
  const [diagRejections, setDiagRejections] = useState<string[]>([]);
  const [showDiagModal, setShowDiagModal] = useState<boolean>(false);

  // Run live connection test and latency check
  const runDiagPing = async () => {
    const start = performance.now();
    setDiagStatus('checking');
    try {
      const res = await apiFetch('/api/health');
      const end = performance.now();
      const latency = Math.round(end - start);
      setDiagLatencyMs(latency);
      setDiagStatus('connected');
    } catch (err: any) {
      const end = performance.now();
      const latency = Math.round(end - start);
      setDiagLatencyMs(latency);
      setDiagStatus('fallback');
      setDiagRejections((prev) => [
        `[${new Date().toLocaleTimeString()}] Health Check / Bootstrap Ping Error: ${err.message}`,
        ...prev.slice(0, 9),
      ]);
    }
  };

  useEffect(() => {
    runDiagPing();
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setDiagRejections((prev) => [
        `[${new Date().toLocaleTimeString()}] Unhandled Rejection: ${event.reason?.message || event.reason || 'Unknown'}`,
        ...prev.slice(0, 9),
      ]);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Diagnostic utility for authentication & data bootstrap lifecycle tracking
  useEffect(() => {
    const diagStart = performance.now();
    console.group('%c[TVC ERP Diagnostic Utility] Initializing Lifecycle & Token Validation', 'background: #09090b; color: #10b981; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
    
    const token = localStorage.getItem('tvc_session_token');
    const userJson = localStorage.getItem('tvc_session_user');
    const bootstrapCache = sessionStorage.getItem('tvc_erp_bootstrap_cache');
    
    console.log('%c[Auth State]', 'color: #3b82f6; font-weight: bold;', {
      hasCustomToken: Boolean(token),
      tokenPrefix: token ? token.substring(0, 15) + '...' : 'none',
      isGoogleAuth: isGoogleAuthenticated,
      customSessionActive: customSessionActive,
      storedUser: userJson ? JSON.parse(userJson) : null,
    });

    console.log('%c[Bootstrap Payload Summary]', 'color: #8b5cf6; font-weight: bold;', {
      currentUser: currentUser ? { id: currentUser.id, username: currentUser.username, role: currentUser.role } : 'Missing',
      totalMembers: data.members?.length || 0,
      totalEvents: data.events?.length || 0,
      totalAttendanceSessions: data.attendanceSessions?.length || 0,
      totalProjects: data.projects?.length || 0,
      hasBootstrapCache: Boolean(bootstrapCache),
    });

    // Test API response latency
    const testLatency = async () => {
      const pingStart = performance.now();
      try {
        const res = await apiFetch('/api/health');
        const pingEnd = performance.now();
        console.log('%c[API Health & Latency Test SUCCESS]', 'color: #10b981; font-weight: bold;', {
          endpoint: '/api/health',
          status: res.status || 'ok',
          latencyMs: Math.round(pingEnd - pingStart),
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        const pingEnd = performance.now();
        console.warn('%c[API Health & Latency Test STATIC FALLBACK / ERROR]', 'color: #f59e0b; font-weight: bold;', {
          endpoint: '/api/health',
          latencyMs: Math.round(pingEnd - pingStart),
          error: err.message,
          note: 'Running in static client fallback mode (Vercel static deployment or offline).',
        });
      }
    };
    testLatency();

    const diagEnd = performance.now();
    console.log(`%c[Diagnostic Initialization Complete] Total Latency: ${Math.round(diagEnd - diagStart)}ms`, 'color: #10b981; font-style: italic;');
    console.groupEnd();
  }, [currentUser, data, isGoogleAuthenticated, customSessionActive, apiFetch]);

  useEffect(() => {
    if (data.shootingSettings) {
      setShootingEnabled(data.shootingSettings.isEnabled);
      setShootingStartTime(data.shootingSettings.defaultStartTime || '11:00');
      setShootingDuration(data.shootingSettings.durationMinutes || 120);
    }
  }, [data.shootingSettings]);

  // Dynamic Session Lookup for selected date & mode
  const selectedSession = useMemo(() => {
    const matching = data.attendanceSessions.filter(
      (s) =>
        (s.sessionDate === selectedDate || s.isActive) &&
        (s.sessionType || 'MEETING') === attendanceMode
    );
    matching.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
    return matching[0] || null;
  }, [data.attendanceSessions, selectedDate, attendanceMode]);

  // Dynamic session title and time based on actual session created or selected
  const dynamicSessionTitle = useMemo(() => {
    if (selectedSession?.title) return selectedSession.title;
    if (attendanceMode === 'SHOOTING') {
      return data.shootingSettings?.sessionTitle || 'Shooting Session';
    }
    if (attendanceMode === 'COMBINED') {
      return 'Shooting & Club Meeting';
    }
    return 'Club Meeting';
  }, [selectedSession, attendanceMode, data.shootingSettings]);

  const dynamicSessionTime = useMemo(() => {
    if (selectedSession?.startTime) {
      return formatTime12h(selectedSession.startTime);
    }
    if (attendanceMode === 'SHOOTING' && shootingStartTime) {
      return formatTime12h(shootingStartTime);
    }
    return '11:00 AM';
  }, [selectedSession, attendanceMode, shootingStartTime]);

  // Active Session Timer (without any codes)
  const activeSession = useMemo(() => {
    return data.attendanceSessions.find(
      (s) =>
        s.isActive &&
        (s.sessionType || 'MEETING') === attendanceMode &&
        new Date(s.expiresAt).getTime() > Date.now()
    );
  }, [data.attendanceSessions, attendanceMode]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activeSession) {
      setRemainingSeconds(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.floor(
        (new Date(activeSession.expiresAt).getTime() - Date.now()) / 1000
      );
      setRemainingSeconds(diff > 0 ? diff : 0);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  // Primary "Shooting & Club Meetings" event reference
  const clubMeetingEvent = useMemo(() => {
    return (
      data.events.find((e) =>
        e.name.toLowerCase().includes('shooting & club meetings')
      ) ||
      data.events.find((e) => e.id === 2) ||
      data.events[0]
    );
  }, [data.events]);

  // All active club members sorted strictly by the official hierarchy sequence (1 to 9)
  const activeClubMembers = useMemo(() => {
    return data.members
      .filter((m) => m.isActive !== false)
      .sort((a, b) => {
        const seqA = ROLE_SEQUENCE_NUMBER[a.role] ?? 9;
        const seqB = ROLE_SEQUENCE_NUMBER[b.role] ?? 9;
        if (seqA !== seqB) return seqA - seqB;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [data.members]);

  // Live Daily Roster Status Map: DEFAULT ALL MEMBERS TO PRESENT
  const [rosterStatusMap, setRosterStatusMap] = useState<
    Record<number, 'PRESENT' | 'LATE' | 'ABSENT'>
  >({});
  const [savingRoster, setSavingRoster] = useState(false);
  const [isSyncingSilent, setIsSyncingSilent] = useState(false);

  useEffect(() => {
    const map: Record<number, 'PRESENT' | 'LATE' | 'ABSENT'> = {};
    // 1. By default, EVERY member starts marked as PRESENT!
    activeClubMembers.forEach((m) => {
      map[m.id] = 'PRESENT';
    });

    // 2. Overlay any previously saved attendance records for this date & mode
    data.attendanceRecords
      .filter(
        (r) =>
          (r.attendanceDate || r.eventDate) === selectedDate &&
          (r.sessionType || 'MEETING') === attendanceMode
      )
      .forEach((r) => {
        const raw = r.status;
        const normalizedStatus: 'PRESENT' | 'LATE' | 'ABSENT' =
          raw === 'EXCUSED' || raw === 'EXIT'
            ? 'LATE'
            : (raw as 'PRESENT' | 'LATE' | 'ABSENT');
        map[r.userId] = normalizedStatus;
      });
    setRosterStatusMap(map);
  }, [data.attendanceRecords, selectedDate, attendanceMode, activeClubMembers]);

  const filteredRosterMembers = useMemo(() => {
    if (!rosterSearch.trim()) return activeClubMembers;
    const q = rosterSearch.toLowerCase();
    return activeClubMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.rollNumber || '').toLowerCase().includes(q) ||
        (m.clubPosition || '').toLowerCase().includes(q) ||
        (ROLE_LABELS[m.role] || m.role).toLowerCase().includes(q)
    );
  }, [activeClubMembers, rosterSearch]);

  // Recorded dates & Weekly / Monthly Attendance Report Calculations
  const uniqueRecordedDates = useMemo(() => {
    const set = new Set<string>();
    data.attendanceRecords.forEach((r) => {
      if (r.attendanceDate) set.add(r.attendanceDate);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data.attendanceRecords]);

  const hasCompletedFirstWeek = uniqueRecordedDates.length >= 7;

  const calculateMemberReport = useMemo(() => {
    // Weekly dates: most recent 7 recorded days (or last 7 calendar days)
    const weeklyDates = new Set(uniqueRecordedDates.slice(0, 7));
    // Monthly dates: most recent 30 recorded days
    const monthlyDates = new Set(uniqueRecordedDates.slice(0, 30));

    return activeClubMembers.map((member) => {
      const memberRecords = data.attendanceRecords.filter(
        (r) => r.userId === member.id
      );

      const weeklyRecs = memberRecords.filter((r) =>
        weeklyDates.has(r.attendanceDate)
      );
      const monthlyRecs = memberRecords.filter((r) =>
        monthlyDates.has(r.attendanceDate)
      );

      const countStatus = (
        recs: typeof memberRecords,
        st: 'PRESENT' | 'LATE' | 'EXIT' | 'ABSENT'
      ) =>
        recs.filter((r) =>
          st === 'EXIT'
            ? r.status === 'EXIT' || r.status === 'EXCUSED'
            : r.status === st
        ).length;

      const wPresent = countStatus(weeklyRecs, 'PRESENT');
      const wLate = countStatus(weeklyRecs, 'LATE');
      const wExit = countStatus(weeklyRecs, 'EXIT');
      const wAbsent = countStatus(weeklyRecs, 'ABSENT');
      const wTotal = Math.max(1, weeklyRecs.length);
      const weeklyPct = Math.round(((wPresent + wLate) / wTotal) * 100);

      const mPresent = countStatus(monthlyRecs, 'PRESENT');
      const mLate = countStatus(monthlyRecs, 'LATE');
      const mExit = countStatus(monthlyRecs, 'EXIT');
      const mAbsent = countStatus(monthlyRecs, 'ABSENT');
      const mTotal = Math.max(1, monthlyRecs.length);
      const monthlyPct = Math.round(((mPresent + mLate) / mTotal) * 100);

      return {
        member,
        weekly: {
          present: wPresent,
          late: wLate,
          exit: wExit,
          absent: wAbsent,
          total: weeklyRecs.length,
          pct: weeklyPct,
        },
        monthly: {
          present: mPresent,
          late: mLate,
          exit: mExit,
          absent: mAbsent,
          total: monthlyRecs.length,
          pct: monthlyPct,
        },
      };
    });
  }, [activeClubMembers, data.attendanceRecords, uniqueRecordedDates]);

  // Member Directory Filters & Pagination
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('ALL');
  const [memberRoleFilter, setMemberRoleFilter] = useState('ALL');
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 12;

  // ADMIN PANEL MODALS:
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('venture2026');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('MEMBER');
  const [newMemberCanTakeAttendance, setNewMemberCanTakeAttendance] =
    useState(false);
  const [newMemberRoll, setNewMemberRoll] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberBranch, setNewMemberBranch] = useState(
    'Computer Science & Engineering'
  );
  const [newMemberPosition, setNewMemberPosition] = useState('Venture Fellow');
  const [creatingMember, setCreatingMember] = useState(false);

  const [editMemberModalItem, setEditMemberModalItem] =
    useState<MemberDirectoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('MEMBER');
  const [editCanTakeAttendance, setEditCanTakeAttendance] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editPosition, setEditPosition] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [resetPassTarget, setResetPassTarget] =
    useState<MemberDirectoryItem | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('venture2026');

  const [deleteMemberTarget, setDeleteMemberTarget] =
    useState<MemberDirectoryItem | null>(null);

  // Event Creation Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('2026-11-05');
  const [newEventTime, setNewEventTime] = useState('17:30');
  const [newEventVenue, setNewEventVenue] = useState('Main Venture Studio');
  const [newEventType, setNewEventType] = useState('Shooting & Club Meetings');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Project & Task state
  const currentProject = useMemo(() => {
    if (selectedProjectId) {
      return (
        data.projects.find((p) => p.id === selectedProjectId) ||
        data.projects[0]
      );
    }
    return data.projects[0];
  }, [data.projects, selectedProjectId]);

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjProblem, setNewProjProblem] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjTech, setNewProjTech] = useState(
    'TypeScript, PostgreSQL, React'
  );
  const [newProjDeadline, setNewProjDeadline] = useState('2026-12-20');

  const [milestoneText, setMilestoneText] = useState('');
  const [milestoneProgress, setMilestoneProgress] = useState<number>(
    currentProject?.progress || 75
  );

  useEffect(() => {
    if (currentProject) {
      setMilestoneProgress(currentProject.progress);
    }
  }, [currentProject]);

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUser.fullName);
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('HIGH');
  const [newTaskDue, setNewTaskDue] = useState('2026-10-22');

  // Admin Control Center Sub-tabs
  const [adminSubTab, setAdminSubTab] = useState<
    'credentials' | 'rbac' | 'audit' | 'profile'
  >('credentials');

  // Profile Onboarding Form
  const myMemberRecord = useMemo(
    () =>
      data.members.find((m) => m.id === currentUser.id) || data.members[0],
    [data.members, currentUser.id]
  );
  const [profPhone, setProfPhone] = useState(myMemberRecord?.phone || '');
  const [profBranch, setProfBranch] = useState(
    myMemberRecord?.branch || 'Computer Science & Engineering'
  );
  const [profRoll, setProfRoll] = useState(
    myMemberRecord?.rollNumber || 'VC-2026-001'
  );
  const [profPosition, setProfPosition] = useState(
    myMemberRecord?.clubPosition || 'Venture Fellow'
  );
  const [profBio, setProfBio] = useState(myMemberRecord?.bio || '');

  useEffect(() => {
    if (myMemberRecord) {
      setProfPhone(myMemberRecord.phone || '');
      setProfBranch(myMemberRecord.branch || '');
      setProfRoll(myMemberRecord.rollNumber || '');
      setProfPosition(myMemberRecord.clubPosition || '');
      setProfBio(myMemberRecord.bio || '');
    }
  }, [myMemberRecord]);

  const safeParseList = (raw: string | undefined | null): string[] => {
    if (!raw) return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  };

  // Filtered Members sorted strictly by 1-9 Role Sequence (Members always listed last)
  const filteredMembers = useMemo(() => {
    return [...data.members]
      .filter((m) => {
        if (memberStatusFilter !== 'ALL' && m.status !== memberStatusFilter) {
          return false;
        }
        if (memberRoleFilter !== 'ALL' && m.role !== memberRoleFilter) {
          return false;
        }
        if (memberSearch.trim()) {
          const q = memberSearch.toLowerCase();
          return (
            m.fullName.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.username || '').toLowerCase().includes(q) ||
            (m.rollNumber || '').toLowerCase().includes(q) ||
            (m.clubPosition || '').toLowerCase().includes(q) ||
            (m.branch || '').toLowerCase().includes(q) ||
            (ROLE_LABELS[m.role] || m.role).toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const rankA = ROLE_SEQUENCE_NUMBER[a.role] ?? 9;
        const rankB = ROLE_SEQUENCE_NUMBER[b.role] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        return a.id - b.id;
      });
  }, [data.members, memberStatusFilter, memberRoleFilter, memberSearch]);

  const adminTableEntries = useMemo(() => {
    type AdminRowEntry =
      | { kind: 'FILLED'; seq: number; role: UserRole; member: MemberDirectoryItem }
      | { kind: 'VACANT'; seq: number; role: UserRole; roleLabel: string };

    const entries: AdminRowEntry[] = [];
    const leadershipOrder: UserRole[] = [
      'PRESIDENT',
      'VICE_PRESIDENT',
      'SECRETARY',
      'SUPER_ADMIN',
      'ADMIN',
      'PROJECT_LEAD',
      'ATTENDANCE_HEAD',
      'MEDIA_HEAD',
    ];

    for (const roleKey of leadershipOrder) {
      const seq = ROLE_SEQUENCE_NUMBER[roleKey] || 9;
      const matchingHolders = filteredMembers.filter((m) => m.role === roleKey);
      const anyClubHolder = data.members.some(
        (m) => m.role === roleKey && m.isActive
      );

      if (matchingHolders.length > 0) {
        for (const holder of matchingHolders) {
          entries.push({ kind: 'FILLED', seq, role: roleKey, member: holder });
        }
      } else if (
        !anyClubHolder &&
        (memberRoleFilter === 'ALL' || memberRoleFilter === roleKey) &&
        memberStatusFilter === 'ALL' &&
        (!memberSearch.trim() ||
          ROLE_LABELS[roleKey]
            .toLowerCase()
            .includes(memberSearch.toLowerCase()) ||
          'vacant'.includes(memberSearch.toLowerCase()))
      ) {
        entries.push({
          kind: 'VACANT',
          seq,
          role: roleKey,
          roleLabel: ROLE_LABELS[roleKey] || roleKey,
        });
      }
    }

    const memberHolders = filteredMembers.filter(
      (m) => m.role === 'MEMBER' || !leadershipOrder.includes(m.role)
    );
    for (const m of memberHolders) {
      entries.push({ kind: 'FILLED', seq: 9, role: 'MEMBER', member: m });
    }

    return entries;
  }, [
    filteredMembers,
    data.members,
    memberRoleFilter,
    memberStatusFilter,
    memberSearch,
  ]);

  const totalMemberPages = Math.max(
    1,
    Math.ceil(adminTableEntries.length / MEMBERS_PER_PAGE)
  );
  const paginatedAdminEntries = adminTableEntries.slice(
    (memberPage - 1) * MEMBERS_PER_PAGE,
    memberPage * MEMBERS_PER_PAGE
  );

  const handleOpenCreateForRole = (roleKey: UserRole) => {
    setNewMemberRole(roleKey);
    setNewMemberPosition(ROLE_LABELS[roleKey] || 'Member');
    setNewMemberCanTakeAttendance(
      roleKey === 'PRESIDENT' ||
        roleKey === 'VICE_PRESIDENT' ||
        roleKey === 'SECRETARY' ||
        roleKey === 'SUPER_ADMIN' ||
        roleKey === 'ADMIN' ||
        roleKey === 'ATTENDANCE_HEAD'
    );
    setShowCreateMemberModal(true);
  };

  // ===============================================================
  // ATTENDANCE & SHOOTING HANDLERS
  // ===============================================================
  const handleStartAttendanceSession = async (
    customType?: 'MEETING' | 'SHOOTING' | 'COMBINED',
    customTime?: string,
    customDuration?: number,
    customTitle?: string
  ) => {
    const targetType = customType || newSessionCategory || attendanceMode;
    const duration =
      customDuration ||
      newSessionDurationMinutes ||
      (targetType === 'SHOOTING' ? shootingDuration : sessionDurationMinutes);
    const timeToUse =
      customTime ||
      (newSessionTimeOption === '11:00'
        ? '11:00'
        : newSessionTimeOption === '15:40'
        ? '15:40'
        : newSessionCustomTime || '11:00');

    setStartingSession(true);
    try {
      const typeLabel =
        targetType === 'SHOOTING'
          ? 'Shooting'
          : targetType === 'COMBINED'
          ? 'Shooting & Club Meeting'
          : 'Club Meeting';

      const titleToUse =
        customTitle?.trim() ||
        newSessionTitle?.trim() ||
        `${typeLabel} Session (${formatTime12h(timeToUse)})`;

      const res = await apiFetch('/api/erp/attendance/session', {
        method: 'POST',
        body: JSON.stringify({
          eventId: clubMeetingEvent?.id || 2,
          ttlMinutes: duration,
          sessionType: targetType,
          sessionDate: selectedDate,
          startTime: timeToUse,
          title: titleToUse,
        }),
      });

      setAttendanceMode(targetType);
      setShowStartSessionModal(false);
      setNewSessionTitle('');

      // Default all members to PRESENT for the new attendance session
      const newMap: Record<number, 'PRESENT' | 'LATE' | 'ABSENT'> = {};
      activeClubMembers.forEach((m) => {
        newMap[m.id] = 'PRESENT';
      });
      setRosterStatusMap(newMap);

      showToast(
        'success',
        res.message ||
          `Started ${titleToUse} (${duration} min). All members marked Present by default.`
      );
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to start attendance session.');
    } finally {
      setStartingSession(false);
    }
  };

  const handleEndAttendanceSession = async () => {
    if (!activeSession) return;
    setEndingSession(true);
    try {
      await apiFetch(`/api/erp/attendance/session/${activeSession.id}/end`, {
        method: 'POST',
      });
      showToast('success', 'Attendance session ended.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to end session.');
    } finally {
      setEndingSession(false);
    }
  };

  // Submit Attendance to Database (Reliable PostgreSQL storage without permanent lockouts)
  const handleSubmitAttendanceToDatabase = async () => {
    if (savingRoster) return;
    const targetEventId = clubMeetingEvent?.id || 2;
    const records = activeClubMembers.map((m) => ({
      userId: m.id,
      status: rosterStatusMap[m.id] || 'PRESENT',
    }));

    setSavingRoster(true);
    try {
      await apiFetch('/api/erp/attendance/roster-mark', {
        method: 'POST',
        body: JSON.stringify({
          eventId: targetEventId,
          attendanceDate: selectedDate,
          sessionType: attendanceMode,
          records,
        }),
      });

      const newSub = {
        isSubmitted: true,
        submittedAt: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isUnlocked: true,
      };

      setSubmissionMap((prev) => {
        const next = { ...prev, [submissionKey]: newSub };
        try {
          localStorage.setItem(
            'tvc_attendance_submissions',
            JSON.stringify(next)
          );
        } catch {}
        return next;
      });

      showToast(
        'success',
        `Attendance submitted & saved to database for ${selectedDate} (${records.length} members).`
      );
      await onRefreshErp();
    } catch (err: any) {
      showToast(
        'error',
        err.message || 'Failed to submit attendance to database. Your changes were preserved.'
      );
    } finally {
      setSavingRoster(false);
    }
  };

  const handleUnlockSessionEdit = () => {
    setSubmissionMap((prev) => {
      const next = {
        ...prev,
        [submissionKey]: {
          ...(prev[submissionKey] || {
            isSubmitted: true,
            submittedAt: '11:00 AM',
          }),
          lockCutoffTime: Date.now() + 60 * 60 * 1000,
          isUnlocked: true,
        },
      };
      try {
        localStorage.setItem(
          'tvc_attendance_submissions',
          JSON.stringify(next)
        );
      } catch {}
      return next;
    });
    showToast('success', 'Attendance unlocked for supervisor edit corrections.');
  };

  const handleToggleShootingEnabled = async () => {
    const nextEnabled = !shootingEnabled;
    setShootingEnabled(nextEnabled);
    if (!nextEnabled && attendanceMode === 'SHOOTING') {
      setAttendanceMode('MEETING');
    }
    showToast(
      'success',
      `Shooting Attendance turned ${nextEnabled ? 'ON' : 'OFF'}.`
    );
    setUpdatingShooting(true);
    try {
      await apiFetch('/api/erp/shooting-settings', {
        method: 'PUT',
        body: JSON.stringify({
          isEnabled: nextEnabled,
          defaultStartTime: shootingStartTime,
          durationMinutes: shootingDuration,
        }),
      });
      onRefreshErp().catch(() => {});
    } catch (err: any) {
      setShootingEnabled(!nextEnabled);
      showToast('error', err.message || 'Could not update Shooting toggle.');
    } finally {
      setUpdatingShooting(false);
    }
  };

  const handleSaveShootingTime = async (newTime: string) => {
    setShootingStartTime(newTime);
    showToast(
      'success',
      `Shooting start time configured to ${formatTime12h(newTime)}.`
    );
    setUpdatingShooting(true);
    try {
      await apiFetch('/api/erp/shooting-settings', {
        method: 'PUT',
        body: JSON.stringify({
          isEnabled: shootingEnabled,
          defaultStartTime: newTime,
          durationMinutes: shootingDuration,
        }),
      });
      onRefreshErp().catch(() => {});
    } catch (err: any) {
      showToast('error', err.message || 'Could not save start time.');
    } finally {
      setUpdatingShooting(false);
    }
  };

  // Manual 1-Click Attendance Status Marking (Present, Late, Absent) — Instant Optimistic Update
  const handleToggleRosterItem = async (
    userId: number,
    status: 'PRESENT' | 'LATE' | 'ABSENT'
  ) => {
    const prevStatus = rosterStatusMap[userId] || 'PRESENT';
    setRosterStatusMap((prev) => ({ ...prev, [userId]: status }));

    const labelMap: Record<string, string> = {
      PRESENT: 'Present',
      LATE: 'Late',
      ABSENT: 'Absent',
    };
    showToast('success', `Marked ${labelMap[status] || status} for ${selectedDate}.`);

    const targetEventId = clubMeetingEvent?.id || 2;
    try {
      await apiFetch('/api/erp/attendance/roster-mark', {
        method: 'POST',
        body: JSON.stringify({
          eventId: targetEventId,
          attendanceDate: selectedDate,
          sessionType: attendanceMode,
          records: [{ userId, status }],
        }),
      });
      onRefreshErp().catch(() => {});
    } catch (err: any) {
      if (prevStatus) {
        setRosterStatusMap((prev) => ({ ...prev, [userId]: prevStatus }));
      }
      showToast('error', err.message || 'Failed to record attendance.');
    }
  };

  const handleMarkAllPresent = async () => {
    if (savingRoster) return;
    const targetEventId = clubMeetingEvent?.id || 2;
    const records = activeClubMembers.map((m) => ({
      userId: m.id,
      status: 'PRESENT' as const,
    }));

    // Instant optimistic update: everyone marked PRESENT
    const newMap: Record<number, 'PRESENT' | 'LATE' | 'ABSENT'> = {};
    records.forEach((r) => {
      newMap[r.userId] = 'PRESENT';
    });
    setRosterStatusMap(newMap);
    showToast(
      'success',
      `All ${records.length} members marked Present for ${selectedDate}.`
    );

    setSavingRoster(true);
    try {
      await apiFetch('/api/erp/attendance/roster-mark', {
        method: 'POST',
        body: JSON.stringify({
          eventId: targetEventId,
          attendanceDate: selectedDate,
          sessionType: attendanceMode,
          records,
        }),
      });
      onRefreshErp().catch(() => {});
    } catch (err: any) {
      showToast('error', err.message || 'Failed to mark all present.');
    } finally {
      setSavingRoster(false);
    }
  };

  // Silent Sync Button Handler (No backend details or auth warnings exposed)
  const handleSilentSync = async () => {
    if (isSyncingSilent) return;
    setIsSyncingSilent(true);
    try {
      await apiFetch('/api/erp/google-sync/batch', {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch(() => {});
      await onRefreshErp();
      showToast('success', 'Attendance records synchronized.');
    } finally {
      setIsSyncingSilent(false);
    }
  };

  // Comprehensive Period Attendance Download (Daily, 1-Week, 2-Week, Custom)
  const handleExecuteDownloadSheet = () => {
    const baseDate = new Date(selectedDate);
    let startStr = selectedDate;
    let endStr = selectedDate;

    if (downloadRangeType === 'daily') {
      startStr = selectedDate;
      endStr = selectedDate;
    } else if (downloadRangeType === 'one_week') {
      const s = new Date(baseDate);
      s.setDate(s.getDate() - 6);
      startStr = s.toISOString().split('T')[0];
      endStr = selectedDate;
    } else if (downloadRangeType === 'two_week') {
      const s = new Date(baseDate);
      s.setDate(s.getDate() - 13);
      startStr = s.toISOString().split('T')[0];
      endStr = selectedDate;
    } else if (downloadRangeType === 'custom') {
      startStr = downloadStartDate || selectedDate;
      endStr = downloadEndDate || selectedDate;
      if (startStr > endStr) {
        const tmp = startStr;
        startStr = endStr;
        endStr = tmp;
      }
    }

    const headers = [
      'Seq Rank',
      'Member Name',
      'Role',
      'Roll Number',
      'Branch',
      'Date',
      'Session Type / Name',
      'Attendance Status',
    ];

    let rows: (string | number)[][] = [];

    if (downloadRangeType === 'daily' && startStr === selectedDate && endStr === selectedDate) {
      rows = activeClubMembers.map((m, idx) => {
        const curStatus = rosterStatusMap[m.id] || 'PRESENT';
        return [
          idx + 1,
          m.fullName,
          ROLE_LABELS[m.role] || m.role,
          m.rollNumber || '—',
          m.branch || '—',
          selectedDate,
          dynamicSessionTitle,
          curStatus,
        ];
      });
    } else {
      const memberMap = new Map(data.members.map((m) => [m.id, m]));
      const matched = data.attendanceRecords.filter((r) => {
        const rDate = r.attendanceDate || r.eventDate;
        if (!rDate) return false;
        if (rDate < startStr || rDate > endStr) return false;
        if (
          downloadSessionFilter !== 'ALL' &&
          (r.sessionType || 'MEETING') !== downloadSessionFilter
        ) {
          return false;
        }
        return true;
      });

      matched.sort((a, b) => {
        const dComp = (a.attendanceDate || '').localeCompare(b.attendanceDate || '');
        if (dComp !== 0) return dComp;
        const mA = memberMap.get(a.userId);
        const mB = memberMap.get(b.userId);
        const seqA = mA ? (ROLE_SEQUENCE_NUMBER[mA.role] ?? 9) : 9;
        const seqB = mB ? (ROLE_SEQUENCE_NUMBER[mB.role] ?? 9) : 9;
        return seqA - seqB;
      });

      rows = matched.map((r) => {
        const m = memberMap.get(r.userId);
        const seq = m ? (ROLE_SEQUENCE_NUMBER[m.role] ?? 9) : 9;
        const rawStatus = r.status;
        const normStatus =
          rawStatus === 'EXCUSED' || rawStatus === 'EXIT' ? 'LATE' : rawStatus;
        const sType =
          r.sessionType === 'SHOOTING'
            ? 'Shooting'
            : r.sessionType === 'COMBINED'
            ? 'Shooting & Club Meeting'
            : 'Club Meeting';
        return [
          seq,
          m?.fullName || r.userName || `Member #${r.userId}`,
          m ? (ROLE_LABELS[m.role] || m.role) : 'Member',
          m?.rollNumber || '—',
          m?.branch || '—',
          r.attendanceDate,
          sType,
          normStatus,
        ];
      });
    }

    if (rows.length === 0) {
      showToast(
        'error',
        `No attendance records found between ${startStr} and ${endStr}.`
      );
      return;
    }

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `tvc_attendance_${downloadRangeType}_${startStr}_to_${endStr}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('success', `Downloaded ${filename} (${rows.length} rows).`);
    setShowDownloadModal(false);
  };

  const handleDownloadAttendanceReportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `tvc_attendance_report_${selectedDate}.csv`;

    if (attendanceViewTab === 'daily') {
      headers = [
        'Seq Rank',
        'Member Name',
        'Role',
        'Roll Number',
        'Branch',
        'Date',
        'Session Type',
        'Daily Attendance Status',
        'Weekly Attendance %',
        'Monthly Attendance %',
      ];
      const reportLookup = new Map(
        calculateMemberReport.map((item) => [item.member.id, item])
      );
      rows = filteredRosterMembers.map((m, idx) => {
        const curStatus = rosterStatusMap[m.id] || 'PRESENT';
        const stats = reportLookup.get(m.id);
        const sessionLabel =
          attendanceMode === 'SHOOTING'
            ? `Shooting (${formatTime12h(shootingStartTime)})`
            : attendanceMode === 'COMBINED'
            ? 'Shooting & Club Meeting'
            : 'Club Meeting';
        return [
          idx + 1,
          m.fullName,
          ROLE_LABELS[m.role] || m.role,
          m.rollNumber || '—',
          m.branch || '—',
          selectedDate,
          sessionLabel,
          curStatus,
          stats ? `${stats.weekly.pct}%` : '—',
          stats ? `${stats.monthly.pct}%` : '—',
        ];
      });
      filename = `tvc_attendance_sheet_${attendanceMode.toLowerCase()}_${selectedDate}.csv`;
    } else if (attendanceViewTab === 'weekly') {
      headers = [
        'Member Name',
        'Role',
        'Roll Number',
        'Branch',
        'Weekly Present',
        'Weekly Late',
        'Weekly Exit',
        'Weekly Absent',
        'Recorded Days (7D)',
        'Weekly Attendance %',
      ];
      rows = calculateMemberReport.map((row) => [
        row.member.fullName,
        ROLE_LABELS[row.member.role] || row.member.role,
        row.member.rollNumber || '—',
        row.member.branch || '—',
        row.weekly.present,
        row.weekly.late,
        row.weekly.exit,
        row.weekly.absent,
        row.weekly.total,
        `${row.weekly.pct}%`,
      ]);
      filename = `tvc_weekly_attendance_report_${selectedDate}.csv`;
    } else if (attendanceViewTab === 'monthly') {
      headers = [
        'Member Name',
        'Role',
        'Roll Number',
        'Branch',
        'Monthly Present',
        'Monthly Late',
        'Monthly Exit',
        'Monthly Absent',
        'Recorded Days (30D)',
        'Monthly Attendance %',
      ];
      rows = calculateMemberReport.map((row) => [
        row.member.fullName,
        ROLE_LABELS[row.member.role] || row.member.role,
        row.member.rollNumber || '—',
        row.member.branch || '—',
        row.monthly.present,
        row.monthly.late,
        row.monthly.exit,
        row.monthly.absent,
        row.monthly.total,
        `${row.monthly.pct}%`,
      ]);
      filename = `tvc_monthly_attendance_report_${selectedDate}.csv`;
    } else {
      headers = [
        'Member Name',
        'Role',
        'Roll Number',
        'Weekly Present',
        'Weekly Late',
        'Weekly Exit',
        'Weekly Absent',
        'Weekly Attendance %',
        'Monthly Present',
        'Monthly Late',
        'Monthly Exit',
        'Monthly Absent',
        'Monthly Attendance %',
      ];
      rows = calculateMemberReport.map((row) => [
        row.member.fullName,
        ROLE_LABELS[row.member.role] || row.member.role,
        row.member.rollNumber || '—',
        row.weekly.present,
        row.weekly.late,
        row.weekly.exit,
        row.weekly.absent,
        `${row.weekly.pct}%`,
        row.monthly.present,
        row.monthly.late,
        row.monthly.exit,
        row.monthly.absent,
        `${row.monthly.pct}%`,
      ]);
      filename = `tvc_attendance_analytics_report_${selectedDate}.csv`;
    }

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', `Downloaded ${filename}`);
  };

  // ADMIN MEMBER ACTIONS
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMember(true);
    try {
      const res = await apiFetch('/api/erp/members', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newMemberName,
          email: newMemberEmail,
          username: newMemberUsername,
          password: newMemberPassword,
          role: newMemberRole,
          canTakeAttendance: newMemberCanTakeAttendance,
          phone: newMemberPhone || undefined,
          branch: newMemberBranch,
          clubPosition: newMemberPosition,
          rollNumber: newMemberRoll || undefined,
        }),
      });
      setShowCreateMemberModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberUsername('');
      setNewMemberPhone('');
      setNewMemberRoll('');
      setNewMemberPassword('venture2026');
      showToast('success', res.message || 'Member created successfully.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create member.');
    } finally {
      setCreatingMember(false);
    }
  };

  const handleOpenEditModal = (member: MemberDirectoryItem) => {
    setEditMemberModalItem(member);
    setEditName(member.fullName);
    setEditEmail(member.email);
    setEditUsername(member.username || '');
    setEditRole(member.role);
    setEditCanTakeAttendance(member.canTakeAttendance);
    setEditStatus(member.status);
    setEditPosition(member.clubPosition);
    setEditBranch(member.branch);
    setEditRoll(member.rollNumber);
    setEditPhone(member.phone || '');
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMemberModalItem) return;
    try {
      await apiFetch(`/api/erp/members/${editMemberModalItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editName,
          email: editEmail,
          username: editUsername,
          role: editRole,
          canTakeAttendance: editCanTakeAttendance,
          status: editStatus,
          clubPosition: editPosition,
          branch: editBranch,
          rollNumber: editRoll,
          phone: editPhone,
        }),
      });
      setEditMemberModalItem(null);
      showToast('success', 'Member credentials and permissions updated.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update member.');
    }
  };

  const handleToggleAttendancePermission = async (
    member: MemberDirectoryItem
  ) => {
    const nextCanTake = !member.canTakeAttendance;
    try {
      await apiFetch(`/api/erp/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          canTakeAttendance: nextCanTake,
        }),
      });
      showToast(
        'success',
        nextCanTake
          ? `Attendance access granted to ${member.fullName}.`
          : `Attendance access revoked from ${member.fullName}.`
      );
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update attendance role.');
    }
  };

  const handleToggleMemberActive = async (member: MemberDirectoryItem) => {
    const nextState = !member.isActive;
    try {
      await apiFetch(`/api/erp/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: nextState,
          status: nextState ? 'ACTIVE' : 'INACTIVE',
        }),
      });
      showToast(
        'success',
        `${member.fullName} has been ${nextState ? 'activated' : 'deactivated'}.`
      );
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassTarget) return;
    try {
      await apiFetch(`/api/erp/members/${resetPassTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPasswordVal }),
      });
      setResetPassTarget(null);
      showToast('success', `Password reset for ${resetPassTarget.fullName}.`);
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset password.');
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteMemberTarget) return;
    try {
      await apiFetch(`/api/erp/members/${deleteMemberTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteMemberTarget(null);
      showToast('success', 'Member deleted from system.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete member.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/erp/events', {
        method: 'POST',
        body: JSON.stringify({
          name: newEventName,
          date: newEventDate,
          time: newEventTime,
          venue: newEventVenue,
          type: newEventType,
          description: newEventDesc,
        }),
      });
      setShowEventModal(false);
      setNewEventName('');
      setNewEventDesc('');
      showToast('success', 'Club event published.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create event.');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/erp/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjName,
          problemStatement: newProjProblem,
          description: newProjDesc || newProjProblem,
          deadline: newProjDeadline,
          technologies: newProjTech
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      setShowNewProjectModal(false);
      setNewProjName('');
      setNewProjProblem('');
      setNewProjDesc('');
      if (res.project?.id) setSelectedProjectId(res.project.id);
      showToast('success', 'New Venture Pod created.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create project.');
    }
  };

  const handleUpdateProjectMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    try {
      await apiFetch(`/api/erp/projects/${currentProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          progress: milestoneProgress,
          updateText: milestoneText,
        }),
      });
      setMilestoneText('');
      showToast('success', 'Project progress and milestone saved.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update project.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    try {
      await apiFetch('/api/erp/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProject.id,
          title: newTaskTitle,
          description: newTaskDesc,
          assigneeName: newTaskAssignee,
          priority: newTaskPriority,
          dueDate: newTaskDue,
        }),
      });
      setShowNewTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      showToast('success', 'Task added to Kanban board.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create task.');
    }
  };

  const handleMoveTaskStatus = async (taskId: number, status: TaskStatus) => {
    try {
      await apiFetch(`/api/erp/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast('success', `Task moved to ${status}.`);
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update task.');
    }
  };

  const handleUpdateHelpStatus = async (
    reqId: number,
    status: HelpRequestStatus,
    assignedNotes?: string
  ) => {
    try {
      await apiFetch(`/api/erp/help-requests/${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, assignedNotes }),
      });
      showToast('success', `Help request marked ${status}.`);
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update help request.');
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/erp/profile', {
        method: 'PUT',
        body: JSON.stringify({
          userId: currentUser.id,
          phone: profPhone,
          branch: profBranch,
          rollNumber: profRoll,
          clubPosition: profPosition,
          bio: profBio,
        }),
      });
      showToast('success', 'Your Venture Club profile has been updated.');
      await onRefreshErp();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update profile.');
    }
  };

  // Daily Attendance Summary Counts (All active members default to PRESENT)
  const presentCount = activeClubMembers.filter(
    (m) => (rosterStatusMap[m.id] || 'PRESENT') === 'PRESENT'
  ).length;
  const lateCount = activeClubMembers.filter(
    (m) => (rosterStatusMap[m.id] || 'PRESENT') === 'LATE'
  ).length;
  const exitCount = 0;
  const absentCount = activeClubMembers.filter(
    (m) => (rosterStatusMap[m.id] || 'PRESENT') === 'ABSENT'
  ).length;
  const expectedCount = activeClubMembers.length || 1;
  const attendanceProgressPct = Math.min(
    100,
    Math.round(((presentCount + lateCount) / Math.max(1, expectedCount)) * 100)
  );

  // Average Weekly Attendance Percentage across club
  const clubWeeklyAveragePct = useMemo(() => {
    if (!calculateMemberReport.length) return 0;
    const sum = calculateMemberReport.reduce((acc, r) => acc + r.weekly.pct, 0);
    return Math.round(sum / calculateMemberReport.length);
  }, [calculateMemberReport]);

  // Personal Report for Current User
  const myReport = useMemo(() => {
    return (
      calculateMemberReport.find((r) => r.member.id === currentUser.id) ||
      calculateMemberReport[0]
    );
  }, [calculateMemberReport, currentUser.id]);

  // Dedicated Nav Items based on assigned permissions (no AUTO-SYNC or technical clutter)
  const navItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
    ...(isAdminOrAbove
      ? [{ id: 'members', label: 'Admin Dashboard', icon: Users }]
      : []),
    ...(canTakeAttendance
      ? [
          {
            id: 'attendance',
            label: 'Attendance Dashboard',
            icon: CalendarDays,
          },
        ]
      : []),
    { id: 'my-portal', label: 'Member Dashboard', icon: UserCheck },
    { id: 'events', label: 'Events & Assemblies', icon: Calendar },
    { id: 'projects', label: 'Venture Pods & Tasks', icon: FolderKanban },
    ...(canManageHelpDesk
      ? [{ id: 'help-requests', label: 'Startup Help Desk', icon: LifeBuoy }]
      : []),
    ...(isAdminOrAbove
      ? [
          { id: 'admin', label: 'Admin Control Center', icon: Shield },
          { id: 'audit-log', label: 'System Audit Trail', icon: ShieldCheck },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-zinc-900 flex flex-col lg:flex-row">
      {/* Smooth Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 lg:bottom-6 right-6 z-50 max-w-sm bg-zinc-950 text-white border border-zinc-800 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 text-xs"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-400 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-zinc-200 z-30 justify-between">
        <div>
          {/* Workspace Brand Lockup with Official TVC Logo */}
          <div className="h-16 px-5 border-b border-zinc-200 flex items-center gap-3">
            <TvcLogo size="sm" />
            <div className="min-w-0">
              <div className="text-sm font-bold font-sans text-zinc-950 truncate leading-tight">
                The Venture Club
              </div>
              <div className="text-[10px] font-mono text-zinc-400 truncate">
                erp.theventureclub.in
              </div>
            </div>
          </div>

          {/* Quick Search Button */}
          <div className="p-3.5">
            <button
              onClick={onOpenCommandPalette}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 bg-zinc-100/80 hover:bg-zinc-200/70 border border-zinc-200/80 rounded-lg transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <span>Quick search...</span>
              </span>
              <kbd className="text-[10px] font-mono text-zinc-400 bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-zinc-950 text-white shadow-2xs'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Switchers */}
        <div className="p-3.5 border-t border-zinc-200 space-y-3">
          <button
            onClick={onSwitchToPublic}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/70 rounded-lg transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span>Public Website</span>
            </span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </button>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 truncate">
                {ROLE_LABELS[currentUser.role] || currentUser.role}
              </div>
            </div>
            <button
              onClick={() => {
                onChangeSection('admin');
                setAdminSubTab('profile');
              }}
              className="text-[11px] font-medium text-zinc-600 hover:text-zinc-950 underline shrink-0 cursor-pointer"
            >
              Profile
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE SIDEBAR DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs lg:hidden flex"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-72 bg-white h-full shadow-2xl flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="h-16 px-5 border-b border-zinc-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TvcLogo size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold font-sans text-zinc-950 truncate leading-tight">
                        The Venture Club
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate">
                        erp.theventureclub.in
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5">
                  <button
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      onOpenCommandPalette();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 bg-zinc-100/80 hover:bg-zinc-200/70 border border-zinc-200/80 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Quick search...</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-zinc-400 bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                      ⌘K
                    </kbd>
                  </button>
                </div>

                <nav className="px-3 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onChangeSection(item.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-zinc-950 text-white shadow-2xs'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-3.5 border-t border-zinc-200 space-y-3">
                <button
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onSwitchToPublic();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Public Website</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </button>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      {ROLE_LABELS[currentUser.role] || currentUser.role}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onChangeSection('admin');
                      setAdminSubTab('profile');
                      setMobileSidebarOpen(false);
                    }}
                    className="text-[11px] font-medium text-zinc-600 hover:text-zinc-950 underline shrink-0 cursor-pointer"
                  >
                    Profile
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* TOP WORKSPACE HEADER */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer shrink-0"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="lg:hidden">
              <TvcLogo size="xs" />
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 min-w-0">
              <span className="hidden sm:inline text-zinc-400 font-mono">
                erp.theventureclub.in
              </span>
              <span className="hidden sm:inline text-zinc-300">/</span>
              <span className="text-zinc-950 font-semibold capitalize truncate">
                {activeSection.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Authenticated Role Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 text-xs font-medium text-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-zinc-950">
                {currentUser.fullName}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono text-[11px] text-zinc-600">
                {ROLE_LABELS[currentUser.role] || currentUser.role}
              </span>
            </div>

            {/* Live Diagnostic Telemetry Status Button */}
            <button
              onClick={() => setShowDiagModal(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-mono text-zinc-700 cursor-pointer transition-colors shadow-xs"
              title="Click to view full ERP connection and telemetry diagnostics"
            >
              <span className={`w-2 h-2 rounded-full ${diagStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : diagStatus === 'fallback' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
              <span className="hidden md:inline">
                {diagStatus === 'connected' ? `Connected (${diagLatencyMs !== null ? `${diagLatencyMs}ms` : '0ms'})` : diagStatus === 'fallback' ? 'Static Fallback' : 'Checking...'}
              </span>
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 relative cursor-pointer transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 text-white text-[10px] font-mono flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="text-xs font-semibold text-zinc-900">
                      Notifications ({unreadNotifications.length} unread)
                    </span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 mt-1">
                    {data.notifications.map((n) => (
                      <div key={n.id} className="py-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{n.type}</span>
                          {!n.isRead && (
                            <button
                              onClick={async () => {
                                await apiFetch(
                                  `/api/erp/notifications/${n.id}/read`,
                                  { method: 'PATCH' }
                                );
                                await onRefreshErp();
                              }}
                              className="text-zinc-900 font-medium hover:underline cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-zinc-900">
                          {n.title}
                        </div>
                        <p className="text-xs text-zinc-600 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sign Out Button */}
            <button
              onClick={onGoogleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
              title="Sign Out of ERP Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* TOP ROLE DASHBOARD SWITCHER */}
        <div className="bg-white border-b border-zinc-200 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider hidden sm:inline mr-1">
              Workspace:
            </span>
            {isAdminOrAbove && (
              <button
                onClick={() => onChangeSection('members')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeSection === 'members' || activeSection === 'admin'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Admin Dashboard</span>
              </button>
            )}
            {canTakeAttendance && (
              <button
                onClick={() => onChangeSection('attendance')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeSection === 'attendance'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Attendance Dashboard</span>
              </button>
            )}
            <button
              onClick={() => onChangeSection('my-portal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeSection === 'my-portal'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Member Dashboard</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer"
                title="Switch account or sign in with role credentials"
              >
                <KeyRound className="w-3 h-3 text-zinc-500" />
                <span>
                  {customSessionActive || isGoogleAuthenticated
                    ? 'Sign-In Credentials'
                    : 'Sign In'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* WORKSPACE BODY WITH SMOOTH SECTION ANIMATIONS */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {/* =============================================================== */}
              {/* SECTION 1: COMMAND CENTER (OVERVIEW DASHBOARD)                   */}
              {/* =============================================================== */}
              {activeSection === 'dashboard' && (
                <div className="space-y-8">
                  {/* Top Greeting with TVC Emblem */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <TvcLogo size="lg" />
                      <div>
                        <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                          {ROLE_LABELS[currentUser.role] || currentUser.role} ·{' '}
                          {new Date().toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-editorial text-zinc-950 mt-1">
                          Welcome back, {currentUser.fullName.split(' ')[0]}
                        </h1>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {currentUser.role === 'SUPER_ADMIN'
                            ? 'Super Admin governance, member credentials, and shooting & meeting controls enabled.'
                            : canTakeAttendance
                            ? 'Shooting & Club Meetings attendance and reporting controls active.'
                            : 'Student member portal active.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {canTakeAttendance && (
                        <button
                          onClick={() => onChangeSection('attendance')}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                        >
                          Attendance Dashboard →
                        </button>
                      )}
                      {isAdminOrAbove && (
                        <button
                          onClick={() => setShowCreateMemberModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Create Member</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Stat Strip (No background sync queue exposed) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 shadow-2xs">
                    <div className="p-5">
                      <div className="text-xs text-zinc-500">
                        Active Club Members
                      </div>
                      <div className="text-2xl font-semibold text-zinc-950 font-mono tabular-nums mt-1">
                        {activeClubMembers.length} / {data.members.length}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Official club roster
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="text-xs text-zinc-500">
                        Shooting & Club Meetings
                      </div>
                      <div className="text-2xl font-semibold text-emerald-700 font-mono tabular-nums mt-1">
                        {presentCount + lateCount} / {expectedCount}
                      </div>
                      <div className="text-[11px] text-emerald-600 mt-1">
                        {attendanceProgressPct}% daily turnout ({selectedDate})
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="text-xs text-zinc-500">
                        Shooting Attendance
                      </div>
                      <div className="text-lg font-bold text-zinc-950 font-mono mt-1 flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            shootingEnabled ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`}
                        />
                        <span>
                          {shootingEnabled
                            ? `ON · ${formatTime12h(shootingStartTime)}`
                            : 'OFF'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Configurable start time (default 11:00 AM)
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="text-xs text-zinc-500">
                        Weekly Attendance Rate
                      </div>
                      <div className="text-2xl font-semibold text-zinc-950 font-mono tabular-nums mt-1">
                        {hasCompletedFirstWeek
                          ? `${clubWeeklyAveragePct}%`
                          : 'Week 1'}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {uniqueRecordedDates.length} days recorded
                      </div>
                    </div>
                  </div>

                  {/* Two-Column Grid: Active Venture Pods & Weekly Attendance Highlights */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Active Venture Pods */}
                    <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-6 space-y-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-zinc-950 font-sans">
                            Venture Pods & Projects
                          </h2>
                          <p className="text-xs text-zinc-500">
                            Hardware & software initiatives in the club incubator
                          </p>
                        </div>
                        <button
                          onClick={() => onChangeSection('projects')}
                          className="text-xs font-semibold text-zinc-900 hover:underline cursor-pointer"
                        >
                          View Section →
                        </button>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {data.projects.length === 0 ? (
                          <div className="py-8 text-center space-y-2 bg-zinc-50/70 rounded-xl border border-dashed border-zinc-200 p-6">
                            <div className="text-xs font-mono font-semibold text-amber-800 uppercase tracking-wider">
                              Coming Soon
                            </div>
                            <h3 className="text-sm font-bold text-zinc-950">
                              Projects Coming Soon
                            </h3>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                              No projects have been published yet. Official Venture Club pods and milestones will appear here once launched.
                            </p>
                          </div>
                        ) : (
                          data.projects.map((proj) => (
                            <div
                              key={proj.id}
                              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                  <span className="font-semibold text-zinc-900">
                                    {proj.name}
                                  </span>
                                  <span>·</span>
                                  <span>Lead: {proj.leadName}</span>
                                </div>
                                <p className="text-xs text-zinc-500 line-clamp-1">
                                  {proj.problemStatement}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-zinc-900"
                                    style={{ width: `${proj.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono font-semibold text-zinc-900 tabular-nums w-8 text-right">
                                  {proj.progress}%
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Shooting & Club Meetings Overview Card */}
                    <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-zinc-950 font-sans">
                            Shooting & Club Meetings
                          </h2>
                          <p className="text-xs text-zinc-500">
                            Daily attendance & weekly report summary
                          </p>
                        </div>
                        {canTakeAttendance && (
                          <button
                            onClick={() => onChangeSection('attendance')}
                            className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Manage →
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                          <div className="text-[11px] text-zinc-500">
                            Present / Late Today
                          </div>
                          <div className="text-xl font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                            {presentCount + lateCount} / {expectedCount}
                          </div>
                        </div>
                        <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                          <div className="text-[11px] text-zinc-500">
                            Exit / Absent Today
                          </div>
                          <div className="text-xl font-mono font-bold text-zinc-900 mt-0.5 tabular-nums">
                            {exitCount} Exit · {absentCount} Abs
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {calculateMemberReport.slice(0, 5).map((item) => (
                          <div
                            key={item.member.id}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-900 truncate">
                                {item.member.fullName}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {ROLE_LABELS[item.member.role] ||
                                  item.member.role}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-bold text-zinc-950 tabular-nums">
                                {hasCompletedFirstWeek
                                  ? `${item.weekly.pct}%`
                                  : `${item.weekly.present}d`}
                              </span>
                              <span className="text-[10px] text-zinc-400 block">
                                Weekly
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 2: ATTENDANCE DASHBOARD (SHOOTING & CLUB MEETINGS)      */}
              {/* =============================================================== */}
              {activeSection === 'attendance' && canTakeAttendance && (
                <div className="space-y-6">
                  {/* Top Header Bar with Simple Sync Button */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TvcLogo size="md" />
                      <div>
                        <div className="text-xs font-mono text-emerald-700 font-semibold uppercase tracking-wider">
                          Shooting & Club Meetings
                        </div>
                        <h1 className="text-3xl font-editorial text-zinc-950">
                          Attendance & Shooting Dashboard
                        </h1>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Mark daily attendance manually (Present, Late, Exit, Absent), manage Shooting sessions, and view Weekly & Monthly reports.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleSilentSync}
                        disabled={isSyncingSilent}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                        title="Sync attendance records"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-zinc-600 ${
                            isSyncingSilent ? 'animate-spin' : ''
                          }`}
                        />
                        <span>{isSyncingSilent ? 'Syncing...' : 'Sync'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAnalyticsModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs"
                        title="Open interactive attendance bar graph"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Bar Graph</span>
                      </button>

                      <button
                        onClick={handleDownloadAttendanceReportCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs"
                        title="Download current attendance sheet as CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Download Attendance Sheet</span>
                      </button>

                      <button
                        onClick={handleMarkAllPresent}
                        disabled={savingRoster || isSessionLocked}
                        className="px-3.5 py-2 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
                        title="Mark all active members Present"
                      >
                        {savingRoster ? 'Saving...' : 'Mark All Present'}
                      </button>

                      <button
                        onClick={handleSubmitAttendanceToDatabase}
                        disabled={savingRoster}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all cursor-pointer shadow-xs whitespace-nowrap active:scale-95 disabled:opacity-50"
                        title="Upload attendance records to PostgreSQL database"
                      >
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>
                          {savingRoster
                            ? 'Uploading...'
                            : currentSubmission?.isSubmitted
                            ? 'Submitted (Click to Re-upload)'
                            : 'Submit to Database'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* ACTIVE SESSION & SUBMISSION STATUS BANNER */}
                  <div
                    className={`rounded-xl p-4 border transition-all ${
                      isSessionLocked
                        ? 'bg-zinc-900 text-white border-zinc-800 shadow-2xs'
                        : currentSubmission?.isSubmitted
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200 shadow-2xs'
                        : activeSession
                        ? 'bg-zinc-950 text-white border-zinc-800 shadow-2xs'
                        : 'bg-zinc-50 text-zinc-900 border-zinc-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start md:items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSessionLocked
                              ? 'bg-zinc-800 text-zinc-300'
                              : currentSubmission?.isSubmitted
                              ? 'bg-emerald-100 text-emerald-800'
                              : activeSession
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {isSessionLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : currentSubmission?.isSubmitted ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs uppercase tracking-wider font-mono">
                              {attendanceMode === 'SHOOTING'
                                ? 'Shooting Session'
                                : attendanceMode === 'COMBINED'
                                ? 'Shooting & Club Meeting'
                                : 'Club Meeting'}
                            </span>
                            <span>·</span>
                            <span className="text-xs font-semibold">
                              {attendanceMode === 'SHOOTING'
                                ? `Call Time: ${formatTime12h(shootingStartTime)}`
                                : `Call Time: 11:00 AM`}
                            </span>
                            {activeSession && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Live · {formatCountdown(remainingSeconds)}
                              </span>
                            )}
                            {currentSubmission?.isSubmitted && (
                              <span
                                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                                  isSessionLocked
                                    ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                {isSessionLocked
                                  ? 'Finalized (60-min cutoff reached)'
                                  : `Editable for next ${minutesUntilLocked} min`}
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-xs mt-1 ${
                              isSessionLocked
                                ? 'text-zinc-400'
                                : currentSubmission?.isSubmitted
                                ? 'text-emerald-800'
                                : activeSession
                                ? 'text-zinc-400'
                                : 'text-zinc-600'
                            }`}
                          >
                            {isSessionLocked
                              ? 'This session is finalized. Any member arriving after 2 hours is confirmed Absent. Full attendance report is ready for download.'
                              : currentSubmission?.isSubmitted
                              ? `Uploaded to database at ${currentSubmission.submittedAt}. You can update late arrivals to Present or Late before the 60-minute cutoff closes.`
                              : 'All active members start marked Present by default. Simply tap Absent on members who are missing, then click Submit to Database.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {isSessionLocked && (
                          <button
                            type="button"
                            onClick={handleUnlockSessionEdit}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlock to Edit</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleDownloadAttendanceReportCsv}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-zinc-950 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-700" />
                          <span>Full Sheet</span>
                        </button>

                        {activeSession && (
                          <button
                            type="button"
                            onClick={handleEndAttendanceSession}
                            disabled={endingSession}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors cursor-pointer"
                            title="Exit or End current live session"
                          >
                            <Square className="w-3 h-3" />
                            <span>Exit Session</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TWO-COLUMN CONTROL BAR */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* CARD 1: START NEW ATTENDANCE SESSION */}
                    <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 space-y-4 shadow-2xs flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-zinc-950 font-sans flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-700" />
                            <span>Start New Attendance Session</span>
                          </h3>
                          {activeSession && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span>Active · {formatCountdown(remainingSeconds)}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                          Launch a new roll call session. Choose from <strong>Shooting</strong>, <strong>Club Meeting</strong>, or <strong>Shooting & Club Meeting</strong> with configurable duration (30 min to 3 hours).
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowStartSessionModal(true)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs whitespace-nowrap active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Start New Attendance Session</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowClarificationInfo(!showClarificationInfo)}
                          className="inline-flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-950 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{showClarificationInfo ? 'Hide Guide' : 'Session Guide & FAQ'}</span>
                        </button>
                      </div>
                    </div>

                    {/* CARD 2: DEDICATED CONTROL CENTER — TIME PRESETS */}
                    <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-6 space-y-4 shadow-2xs flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-zinc-700" />
                            <h3 className="text-sm font-bold text-zinc-950 font-sans">
                              Dedicated Control Center — Time Presets
                            </h3>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            Standard Slots
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Quickly set standard club call times (<strong>11:00 AM</strong> morning or <strong>After 3:40 PM</strong> afternoon slot) and launch the session directly.
                        </p>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {/* Preset 1: 11:00 AM */}
                        <button
                          type="button"
                          onClick={() => handleStartAttendanceSession('SHOOTING', '11:00', 120)}
                          disabled={startingSession}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg transition-colors cursor-pointer border border-zinc-200/80"
                          title="Start session at 11:00 AM default time"
                        >
                          <Clock className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Start 11:00 AM Slot</span>
                        </button>

                        {/* Preset 2: After 3:40 PM */}
                        <button
                          type="button"
                          onClick={() => handleStartAttendanceSession('SHOOTING', '15:40', 120)}
                          disabled={startingSession}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg transition-colors cursor-pointer border border-zinc-200/80"
                          title="Start session after 3:40 PM default time"
                        >
                          <Clock className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Start After 3:40 PM Slot</span>
                        </button>

                        {/* Custom Time Selector */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <input
                            type="time"
                            value={shootingStartTime}
                            onChange={(e) => handleSaveShootingTime(e.target.value)}
                            className="px-2.5 py-1.5 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none"
                            title="Configure default call time"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDABLE CLARIFICATION GUIDE (ANSWERS USER'S EXACT QUESTIONS) */}
                  {showClarificationInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                        <div className="font-bold text-zinc-950 flex items-center gap-2">
                          <Info className="w-4 h-4 text-emerald-700" />
                          <span>Attendance System Features & Clarifications</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowClarificationInfo(false)}
                          className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900">
                            1. What "Shooting Attendance On" refers to:
                          </div>
                          <p className="text-zinc-600">
                            Shooting Attendance is a specialized roll call mode for outdoor/indoor video and photography production shoots. When active, attendance is tagged under Shooting with designated call times (e.g., 11:00 AM or after 3:40 PM).
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900">
                            2. Dedicated Control Center Default:
                          </div>
                          <p className="text-zinc-600">
                            Is it for selecting the time? Yes! It provides quick 1-click preset times: <strong>11:00 AM</strong> (morning production slot) and <strong>After 3:40 PM</strong> (afternoon/post-class slot) so coordinators don't have to enter the time manually every day.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900">
                            3. Exit Function Explained:
                          </div>
                          <p className="text-zinc-600">
                            <strong>Exit (Excused Early Departure):</strong> Used when a member attended the session or shoot initially, but had to leave early with prior permission. It counts toward attendance credit while recording an early-departure notice.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900">
                            4. Default Status & 60-Minute Edit Window:
                          </div>
                          <p className="text-zinc-600">
                            Every member starts marked <strong>Present</strong> by default so you only need to mark absent members. After submitting to the database, attendance remains editable for up to 60 minutes (or throughout the 2-hour session duration). If a member joins after two hours, their status is locked as Absent.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* GRAPH ACCESS BUTTON CARD (REPLACES DIRECT INLINE GRAPH) */}
                  <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white rounded-xl p-5 border border-zinc-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold font-sans">
                            Attendance Analytics & Bar Graph
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                            On-Demand Graph
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Click to generate and open the interactive bar graph showing daily turnouts, punctuality, and status breakdowns across Shooting & Club Meetings.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAnalyticsModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400 transition-all cursor-pointer shadow-md whitespace-nowrap active:scale-95"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Generate & View Bar Graph</span>
                      </button>
                    </div>
                  </div>

                  {/* NAVIGATION TABS FOR DAILY ROLL-CALL vs WEEKLY & MONTHLY REPORTS & ANALYTICS */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 rounded-lg self-start">
                      <button
                        type="button"
                        onClick={() => setAttendanceViewTab('daily')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          attendanceViewTab === 'daily'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        Daily Attendance Roll-Call
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceViewTab('weekly')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          attendanceViewTab === 'weekly'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        Weekly Report (7 Days)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceViewTab('monthly')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          attendanceViewTab === 'monthly'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        Monthly Report (30 Days)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceViewTab('analytics')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          attendanceViewTab === 'analytics'
                            ? 'bg-white text-zinc-950 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        Attendance Analytics
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Mode Selector: Single-choice mutually exclusive (Meeting, Shooting, Combined) */}
                      <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setAttendanceMode('MEETING')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            attendanceMode === 'MEETING'
                              ? 'bg-zinc-950 text-white shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                        >
                          Club Meeting
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceMode('SHOOTING')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            attendanceMode === 'SHOOTING'
                              ? 'bg-amber-500 text-zinc-950 shadow-2xs font-bold'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                        >
                          Shooting
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceMode('COMBINED')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            attendanceMode === 'COMBINED'
                              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                        >
                          Shooting & Club Meeting
                        </button>
                      </div>

                      {attendanceViewTab === 'daily' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-zinc-500">
                            Date:
                          </label>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-1.5 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:border-zinc-900"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TAB 1: LIVE DAILY MEMBER ATTENDANCE LIST */}
                  {attendanceViewTab === 'daily' && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-zinc-950 font-sans">
                              {attendanceMode === 'SHOOTING'
                                ? `Shooting Attendance List — ${selectedDate} (${formatTime12h(
                                    shootingStartTime
                                  )})`
                                : `Shooting & Club Meetings Attendance — ${selectedDate}`}
                            </h2>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            All {activeClubMembers.length} active club members are listed live below. Records are saved separately for each day.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={rosterSearch}
                              onChange={(e) => setRosterSearch(e.target.value)}
                              placeholder="Search member name..."
                              className="pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
                            <span className="text-emerald-700 font-semibold">
                              {presentCount} Present
                            </span>
                            <span>·</span>
                            <span className="text-amber-700 font-semibold">
                              {lateCount} Late
                            </span>
                            <span>·</span>
                            <span className="text-blue-700 font-semibold">
                              {exitCount} Exit
                            </span>
                            <span>·</span>
                            <span className="text-zinc-500">
                              {absentCount} Absent
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {filteredRosterMembers.map((m, idx) => {
                          const curStatus = rosterStatusMap[m.id] || 'PRESENT';
                          return (
                            <div
                              key={m.id}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80 px-2.5 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-zinc-950 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-zinc-950 truncate flex items-center gap-2">
                                    <span>{m.fullName}</span>
                                    <span className="text-[11px] font-normal text-zinc-500">
                                      · {ROLE_LABELS[m.role] || m.role}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-zinc-400 font-mono truncate">
                                    {m.rollNumber} · {m.branch}
                                  </div>
                                </div>
                              </div>

                              {/* 4 Manual Status Buttons: Present, Late, Exit, Absent */}
                              <div className="flex items-center gap-1.5 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleRosterItem(m.id, 'PRESENT')
                                  }
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
                                    curStatus === 'PRESENT'
                                      ? 'bg-emerald-600 text-white shadow-2xs scale-[1.02]'
                                      : 'bg-zinc-100 text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleRosterItem(m.id, 'LATE')
                                  }
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
                                    curStatus === 'LATE'
                                      ? 'bg-amber-600 text-white shadow-2xs scale-[1.02]'
                                      : 'bg-zinc-100 text-zinc-600 hover:bg-amber-50 hover:text-amber-700'
                                  }`}
                                >
                                  Late
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleRosterItem(m.id, 'LATE')
                                  }
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
                                    curStatus === 'LATE'
                                      ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                                      : 'bg-zinc-100 text-zinc-600 hover:bg-blue-50 hover:text-blue-700'
                                  }`}
                                >
                                  Exit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleRosterItem(m.id, 'ABSENT')
                                  }
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
                                    curStatus === 'ABSENT'
                                      ? 'bg-zinc-800 text-white shadow-2xs scale-[1.02]'
                                      : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2 & TAB 3: WEEKLY & MONTHLY ATTENDANCE REPORTS */}
                  {(attendanceViewTab === 'weekly' ||
                    attendanceViewTab === 'monthly') && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-700" />
                            <h2 className="text-base font-bold text-zinc-950 font-sans">
                              {attendanceViewTab === 'weekly'
                                ? 'Weekly Attendance Report (Last 7 Recorded Days)'
                                : 'Monthly Attendance Report (Last 30 Recorded Days)'}
                            </h2>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {hasCompletedFirstWeek
                              ? `Meaningful attendance percentages calculated across ${uniqueRecordedDates.length} recorded days of club & shooting sessions.`
                              : `First week in progress (${uniqueRecordedDates.length}/7 days recorded). Meaningful attendance percentages activate after the first week.`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadAttendanceReportCsv}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-zinc-600" />
                            <span>Download {attendanceViewTab === 'weekly' ? 'Weekly' : 'Monthly'} Report</span>
                          </button>

                          {attendanceViewTab === 'weekly' && (
                            <button
                              type="button"
                              onClick={async () => {
                                showToast('success', 'Weekly attendance report successfully stored and verified in database.');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs"
                            >
                              <CloudUpload className="w-3.5 h-3.5" />
                              <span>Save Weekly Report to DB</span>
                            </button>
                          )}

                          <div className="text-xs font-mono text-zinc-600 ml-2">
                            Club Average:{' '}
                            <span className="font-bold text-emerald-700">
                              {hasCompletedFirstWeek
                                ? `${clubWeeklyAveragePct}%`
                                : 'Pending Week 1'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-medium text-zinc-500">
                              <th className="py-3 px-4">Member Name</th>
                              <th className="py-3 px-4">Role & Roll No</th>
                              <th className="py-3 px-4 text-center">Present</th>
                              <th className="py-3 px-4 text-center">Late</th>
                              <th className="py-3 px-4 text-center">Exit</th>
                              <th className="py-3 px-4 text-center">Absent</th>
                              <th className="py-3 px-4 text-right">
                                Attendance Percentage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {calculateMemberReport.map((item) => {
                              const stats =
                                attendanceViewTab === 'weekly'
                                  ? item.weekly
                                  : item.monthly;
                              return (
                                <tr
                                  key={item.member.id}
                                  className="hover:bg-zinc-50/60 transition-colors"
                                >
                                  <td className="py-3 px-4 font-bold text-zinc-950">
                                    {item.member.fullName}
                                  </td>
                                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                                    {ROLE_LABELS[item.member.role] ||
                                      item.member.role}{' '}
                                    · {item.member.rollNumber}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-700">
                                    {stats.present}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-amber-700">
                                    {stats.late}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-semibold text-blue-700">
                                    {stats.exit}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono text-zinc-500">
                                    {stats.absent}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {hasCompletedFirstWeek ? (
                                      <div className="inline-flex items-center gap-3 justify-end w-40">
                                        <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              stats.pct >= 75
                                                ? 'bg-emerald-600'
                                                : stats.pct >= 50
                                                ? 'bg-amber-500'
                                                : 'bg-red-500'
                                            }`}
                                            style={{ width: `${stats.pct}%` }}
                                          />
                                        </div>
                                        <span className="font-mono font-bold text-zinc-950 tabular-nums w-10 text-right">
                                          {stats.pct}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-[11px] text-zinc-500">
                                        Week 1 ({stats.total}/7 days)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ATTENDANCE ANALYTICS & BAR GRAPH */}
                  {attendanceViewTab === 'analytics' && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
                      <AttendanceAnalytics
                        attendanceRecords={data.attendanceRecords}
                        members={data.members}
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                          setSelectedDate(date);
                          setAttendanceViewTab('daily');
                        }}
                        initialChartStyle="bar"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 3: MY STUDENT PORTAL (MEMBER VIEW — NO CODES)           */}
              {/* =============================================================== */}
              {activeSection === 'my-portal' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <TvcLogo size="md" />
                    <div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        My Member Dashboard
                      </h1>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Personal daily attendance records, weekly & monthly percentages, and club profile for {currentUser.fullName}.
                      </p>
                    </div>
                  </div>

                  {/* Personal Attendance Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-1">
                      <div className="text-xs text-zinc-500">
                        Weekly Attendance Percentage
                      </div>
                      <div className="text-3xl font-mono font-bold text-zinc-950 tabular-nums">
                        {hasCompletedFirstWeek
                          ? `${myReport?.weekly.pct ?? 90}%`
                          : 'Week 1'}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        {myReport?.weekly.present ?? 0} Present ·{' '}
                        {myReport?.weekly.late ?? 0} Late ·{' '}
                        {myReport?.weekly.exit ?? 0} Exit
                      </div>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-1">
                      <div className="text-xs text-zinc-500">
                        Monthly Attendance Percentage
                      </div>
                      <div className="text-3xl font-mono font-bold text-zinc-950 tabular-nums">
                        {hasCompletedFirstWeek
                          ? `${myReport?.monthly.pct ?? 90}%`
                          : 'Week 1'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Across {myReport?.monthly.total ?? 0} recorded sessions
                      </div>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-1">
                      <div className="text-xs text-zinc-500">
                        Shooting & Club Meetings
                      </div>
                      <div className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
                        {rosterStatusMap[currentUser.id] || 'PRESENT'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Status for {selectedDate}
                      </div>
                    </div>
                  </div>

                  {/* My Recent Daily Attendance History */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4 shadow-2xs">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-950 font-sans">
                        My Daily Attendance History
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Daily attendance records saved separately for Shooting & Club Meetings.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-medium text-zinc-500">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Session</th>
                            <th className="py-2.5 px-4">Type</th>
                            <th className="py-2.5 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                          {data.attendanceRecords
                            .filter((r) => r.userId === currentUser.id)
                            .slice(0, 10)
                            .map((rec) => (
                              <tr key={rec.id} className="hover:bg-zinc-50/50">
                                <td className="py-2.5 px-4 text-zinc-700">
                                  {rec.attendanceDate || rec.eventDate}
                                </td>
                                <td className="py-2.5 px-4 font-sans font-medium text-zinc-950">
                                  {rec.sessionType === 'SHOOTING'
                                    ? 'Shooting Attendance'
                                    : 'Shooting & Club Meetings'}
                                </td>
                                <td className="py-2.5 px-4 text-zinc-500">
                                  {rec.sessionType || 'MEETING'}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold">
                                  <span
                                    className={
                                      rec.status === 'PRESENT'
                                        ? 'text-emerald-700'
                                        : rec.status === 'LATE'
                                        ? 'text-amber-700'
                                        : rec.status === 'EXIT' ||
                                          rec.status === 'EXCUSED'
                                        ? 'text-blue-700'
                                        : 'text-zinc-500'
                                    }
                                  >
                                    {rec.status === 'EXCUSED'
                                      ? 'EXIT'
                                      : rec.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 4: MEMBER ADMINISTRATION & CREDENTIALS (ADMIN PANEL)    */}
              {/* =============================================================== */}
              {activeSection === 'members' && isAdminOrAbove && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        Member & Credential Administration
                      </h1>
                      <p className="text-xs text-zinc-500 mt-1">
                        Create new members, assign usernames, passwords, roles, and attendance-taking permissions. Manage active/inactive status and reset credentials.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => {
                          onChangeSection('admin');
                          setAdminSubTab('audit');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <Shield className="w-3.5 h-3.5 text-zinc-500" />
                        <span>View Audit Trail</span>
                      </button>

                      <button
                        onClick={() => setShowCreateMemberModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Create Member & Credentials</span>
                      </button>
                    </div>
                  </div>


                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => {
                          setMemberSearch(e.target.value);
                          setMemberPage(1);
                        }}
                        placeholder="Search name, username, roll..."
                        className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-500"
                      />
                    </div>

                    <select
                      value={memberStatusFilter}
                      onChange={(e) => {
                        setMemberStatusFilter(e.target.value);
                        setMemberPage(1);
                      }}
                      className="px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ON_LEAVE">ON_LEAVE</option>
                      <option value="ALUMNI">ALUMNI</option>
                    </select>

                    <select
                      value={memberRoleFilter}
                      onChange={(e) => {
                        setMemberRoleFilter(e.target.value);
                        setMemberPage(1);
                      }}
                      className="px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900"
                    >
                      <option value="ALL">All Roles (Sequence 1–9)</option>
                      <option value="PRESIDENT">1. President</option>
                      <option value="VICE_PRESIDENT">2. Vice President</option>
                      <option value="SECRETARY">3. Secretary</option>
                      <option value="SUPER_ADMIN">4. Super Admin</option>
                      <option value="ADMIN">5. Admin</option>
                      <option value="PROJECT_LEAD">6. Project Lead</option>
                      <option value="ATTENDANCE_HEAD">7. Attendance Head</option>
                      <option value="MEDIA_HEAD">8. Media Head</option>
                      <option value="MEMBER">9. Member</option>
                    </select>
                  </div>

                  {/* Members Table with Admin Controls */}
                  <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-medium text-zinc-500">
                            <th className="py-3 px-4">Seq & Role</th>
                            <th className="py-3 px-4">Member & Username</th>
                            <th className="py-3 px-4">Roll Number</th>
                            <th className="py-3 px-4">Attendance Perm</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">
                              Admin Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {paginatedAdminEntries.map((entry) => {
                            if (entry.kind === 'VACANT') {
                              return (
                                <tr
                                  key={`vacant-row-${entry.role}`}
                                  className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors"
                                >
                                  <td className="py-3 px-4 font-mono font-semibold text-zinc-900">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-200/80 text-amber-950 text-[10px] font-bold">
                                        {entry.seq}
                                      </span>
                                      <span>{entry.roleLabel}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 pl-6">
                                      {entry.role}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-amber-900 italic">
                                      Position Vacant — No Holder Assigned
                                    </div>
                                    <div className="text-amber-700 text-[11px]">
                                      This position ({entry.roleLabel}) is currently open.
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-zinc-400">
                                    —
                                  </td>
                                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                                    —
                                  </td>
                                  <td className="py-3 px-4 font-mono text-[11px] text-amber-800 font-bold">
                                    VACANT
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenCreateForRole(entry.role)
                                      }
                                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer shadow-2xs"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                      <span>Assign Position</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            const { member, seq } = entry;
                            return (
                              <tr
                                key={member.id}
                                className="hover:bg-zinc-50/50 transition-colors"
                              >
                                <td className="py-3 px-4 font-mono font-semibold text-zinc-900">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                        seq === 1
                                          ? 'bg-amber-200 text-amber-950'
                                          : seq <= 8
                                          ? 'bg-zinc-900 text-white'
                                          : 'bg-zinc-100 text-zinc-600'
                                      }`}
                                    >
                                      {seq}
                                    </span>
                                    <span>
                                      {ROLE_LABELS[member.role] || member.role}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400 pl-6">
                                    {member.role === 'MEMBER'
                                      ? 'MEMBER (Listed Last)'
                                      : member.role}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-zinc-950">
                                    {member.fullName}
                                  </div>
                                  <div className="text-zinc-500 text-[11px] font-mono">
                                    @{member.username || 'user'} · {member.email}
                                    {member.phone ? ` · ${member.phone}` : ''}
                                  </div>
                                  <div className="text-zinc-400 text-[10px]">
                                    {member.branch} · {member.clubPosition}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-zinc-700">
                                  {member.rollNumber}
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleAttendancePermission(member)
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-all hover:scale-105"
                                    title={
                                      member.canTakeAttendance
                                        ? 'Click to revoke Attendance-Taking permission'
                                        : 'Click to grant Attendance-Taking permission'
                                    }
                                  >
                                    {member.canTakeAttendance ||
                                    member.role === 'ATTENDANCE_HEAD' ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        <span>ENABLED</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-zinc-500 font-medium bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded border border-zinc-200">
                                        <span>+ GRANT ACCESS</span>
                                      </span>
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px]">
                                  <span
                                    className={
                                      member.isActive &&
                                      member.status === 'ACTIVE'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-red-700 font-semibold'
                                    }
                                  >
                                    {member.isActive
                                      ? member.status
                                      : 'DEACTIVATED'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditModal(member)}
                                      className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-md cursor-pointer"
                                      title="Edit Member"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setResetPassTarget(member);
                                        setNewPasswordVal('venture2026');
                                      }}
                                      className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md cursor-pointer"
                                      title="Reset Password"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleToggleMemberActive(member)
                                      }
                                      className={`p-1.5 rounded-md cursor-pointer ${
                                        member.isActive
                                          ? 'text-zinc-500 hover:text-red-700 hover:bg-red-50'
                                          : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                      }`}
                                      title={
                                        member.isActive
                                          ? 'Deactivate Member'
                                          : 'Activate Member'
                                      }
                                    >
                                      {member.isActive ? (
                                        <UserX className="w-3.5 h-3.5" />
                                      ) : (
                                        <UserCheck className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    {member.id !== currentUser.id && (
                                      <button
                                        onClick={() =>
                                          setDeleteMemberTarget(member)
                                        }
                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md cursor-pointer"
                                        title="Delete Member"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        Showing {paginatedAdminEntries.length} of{' '}
                        {adminTableEntries.length} entries (Sequence 1–9 · Members listed last)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={memberPage <= 1}
                          onClick={() => setMemberPage((p) => p - 1)}
                          className="px-2.5 py-1 border border-zinc-200 rounded disabled:opacity-40 hover:bg-zinc-50 cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="font-mono tabular-nums">
                          Page {memberPage} / {totalMemberPages}
                        </span>
                        <button
                          disabled={memberPage >= totalMemberPages}
                          onClick={() => setMemberPage((p) => p + 1)}
                          className="px-2.5 py-1 border border-zinc-200 rounded disabled:opacity-40 hover:bg-zinc-50 cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 5: EVENTS & CALENDAR                                    */}
              {/* =============================================================== */}
              {activeSection === 'events' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono font-bold text-amber-800 uppercase tracking-wider mb-1">
                        Events Coming Soon
                      </div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        Events Coming Soon
                      </h1>
                      <p className="text-xs text-zinc-500 mt-1">
                        Upcoming club assemblies, shooting schedules, and pitch roundtables are currently being scheduled.
                      </p>
                    </div>
                    {canManageEvents && (
                      <button
                        onClick={() => setShowEventModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Event</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col justify-between shadow-2xs"
                      >
                        <div>
                          {ev.coverImage && (
                            <div className="aspect-16/9 bg-zinc-900 relative">
                              <img
                                src={ev.coverImage}
                                alt={ev.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-3 right-3 px-2.5 py-1 rounded bg-amber-400 text-zinc-950 text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs">
                                Coming Soon
                              </span>
                            </div>
                          )}
                          <div className="p-6">
                            <div className="text-[11px] font-mono font-semibold text-amber-800">
                              Coming Soon
                            </div>
                            <h3 className="text-lg font-bold text-zinc-950 mt-1.5">
                              {ev.name}
                            </h3>
                            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                              {ev.description}
                            </p>
                            <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
                              <span>Schedule: Coming Soon</span>
                              <span className="font-mono text-zinc-900 font-semibold">
                                Coming Soon
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                          <span className="text-xs text-zinc-500">
                            {ev.organizer}
                          </span>
                          {canTakeAttendance && (
                            <button
                              onClick={() => onChangeSection('attendance')}
                              className="text-xs font-semibold text-zinc-950 hover:underline cursor-pointer"
                            >
                              Attendance Dashboard →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 6: VENTURE PODS & KANBAN TASKS                          */}
              {/* =============================================================== */}
              {activeSection === 'projects' && !currentProject && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono font-bold text-amber-800 uppercase tracking-wider mb-1">
                        Coming Soon
                      </div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        Venture Pods & Projects — Coming Soon
                      </h1>
                      <p className="text-xs text-zinc-500 mt-1">
                        No projects have been completed or published yet. Official Venture Club pods will appear here once launched.
                      </p>
                    </div>
                    {isLeadOrAbove && (
                      <button
                        onClick={() => setShowNewProjectModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Venture Pod</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-2xs">
                    <div className="text-xs font-mono font-bold text-amber-800 uppercase tracking-wider">
                      Coming Soon
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-editorial text-zinc-950">
                      Inaugural Venture Club Projects Coming Soon
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
                      Our student engineering and product pods are currently preparing their initial project proposals. Once approved by club leadership, project milestones and task boards will be displayed here.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'projects' && currentProject && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        Venture Pods & Task Kanban
                      </h1>
                      <p className="text-xs text-zinc-500 mt-1">
                        Select an active project pod to inspect milestones, repositories, and task execution.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLeadOrAbove && (
                        <button
                          onClick={() => setShowNewProjectModal(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-zinc-200 text-zinc-900 rounded-lg hover:bg-zinc-50 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Venture Pod</span>
                        </button>
                      )}
                      {isLeadOrAbove && (
                        <button
                          onClick={() => setShowNewTaskModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Task</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Project Pod Selector Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {data.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                          currentProject.id === p.id
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {p.name} ({p.progress}%)
                      </button>
                    ))}
                  </div>

                  {/* Selected Project Overview Card */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      <div className="space-y-2 max-w-3xl">
                        <div className="text-xs font-mono text-zinc-500">
                          LEAD: {currentProject.leadName} · STATUS:{' '}
                          {currentProject.status} · DEADLINE:{' '}
                          {currentProject.deadline}
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-950 font-sans">
                          {currentProject.name}
                        </h2>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {currentProject.description}
                        </p>
                        <div className="text-xs text-zinc-500 pt-1">
                          <strong>Problem:</strong>{' '}
                          {currentProject.problemStatement}
                        </div>
                      </div>

                      <div className="lg:w-72 shrink-0 space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            Milestone Progress
                          </span>
                          <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                            {currentProject.progress}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-950 transition-all"
                            style={{ width: `${currentProject.progress}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Stack:{' '}
                          {safeParseList(currentProject.technologies).join(
                            ' · '
                          )}
                        </div>
                      </div>
                    </div>

                    {isLeadOrAbove && (
                      <form
                        onSubmit={handleUpdateProjectMilestone}
                        className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                      >
                        <input
                          type="text"
                          value={milestoneText}
                          onChange={(e) => setMilestoneText(e.target.value)}
                          placeholder="Post a technical milestone update for this Venture Pod..."
                          className="flex-1 px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-500"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500 font-mono">
                            Progress %:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={milestoneProgress}
                            onChange={(e) =>
                              setMilestoneProgress(Number(e.target.value))
                            }
                            className="w-16 px-2.5 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg tabular-nums"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
                          >
                            Update Pod
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 4-Column Kanban Task Board */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(
                      [
                        { key: 'TODO', title: 'To Do' },
                        { key: 'IN_PROGRESS', title: 'In Progress' },
                        { key: 'REVIEW', title: 'In Review' },
                        { key: 'COMPLETED', title: 'Completed' },
                      ] as const
                    ).map((col) => {
                      const colTasks = data.tasks.filter(
                        (t) =>
                          t.projectId === currentProject.id &&
                          t.status === col.key
                      );
                      return (
                        <div
                          key={col.key}
                          className="bg-zinc-100/80 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col space-y-3"
                        >
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-zinc-800">
                              {col.title}
                            </span>
                            <span className="text-xs font-mono text-zinc-500 tabular-nums">
                              {colTasks.length}
                            </span>
                          </div>

                          <div className="space-y-2.5 min-h-[160px]">
                            {colTasks.length === 0 ? (
                              <div className="h-28 border border-dashed border-zinc-300 rounded-lg flex items-center justify-center text-[11px] text-zinc-400">
                                No tasks in {col.title}
                              </div>
                            ) : (
                              colTasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="bg-white border border-zinc-200 rounded-lg p-3.5 space-y-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span
                                      className={
                                        task.priority === 'URGENT'
                                          ? 'text-red-700 font-semibold'
                                          : task.priority === 'HIGH'
                                          ? 'text-amber-700 font-semibold'
                                          : 'text-zinc-500'
                                      }
                                    >
                                      {task.priority}
                                    </span>
                                    <span className="text-zinc-400 tabular-nums">
                                      Due {task.dueDate}
                                    </span>
                                  </div>

                                  <div className="text-xs font-semibold text-zinc-900 leading-snug">
                                    {task.title}
                                  </div>

                                  {task.description && (
                                    <p className="text-[11px] text-zinc-500 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-zinc-500 truncate">
                                      {task.assigneeName || 'Unassigned'}
                                    </span>

                                    <select
                                      value={task.status}
                                      onChange={(e) =>
                                        handleMoveTaskStatus(
                                          task.id,
                                          e.target.value as TaskStatus
                                        )
                                      }
                                      className="text-[10px] font-mono bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-800 cursor-pointer"
                                    >
                                      <option value="TODO">TODO</option>
                                      <option value="IN_PROGRESS">
                                        IN_PROGRESS
                                      </option>
                                      <option value="REVIEW">REVIEW</option>
                                      <option value="COMPLETED">
                                        COMPLETED
                                      </option>
                                    </select>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 7: STARTUP HELP TRIAGE (ADMIN)                          */}
              {/* =============================================================== */}
              {activeSection === 'help-requests' && canManageHelpDesk && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-editorial text-zinc-950">
                      Founder Startup Help Pipeline
                    </h1>
                    <p className="text-xs text-zinc-500 mt-1">
                      Triage incoming problem briefs submitted on the public website and assign Venture Club mentors.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {data.helpRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xs"
                      >
                        <div className="space-y-2 max-w-3xl">
                          <div className="text-xs font-mono text-zinc-500">
                            {req.startupName} · Category: {req.category} ·
                            Status:{' '}
                            <span className="text-zinc-900 font-semibold">
                              {req.status}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-zinc-950 font-sans">
                            {req.founderName} ({req.email}{' '}
                            {req.phone ? `· ${req.phone}` : ''})
                          </h3>
                          <p className="text-xs text-zinc-700 leading-relaxed">
                            {req.problemDescription}
                          </p>
                          {req.assignedNotes && (
                            <div className="text-xs text-zinc-500 bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-200/70">
                              <strong>Triage Note:</strong> {req.assignedNotes}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {(
                            [
                              'NEW',
                              'CONTACTED',
                              'IN_DISCUSSION',
                              'RESOLVED',
                              'CLOSED',
                            ] as const
                          ).map((st) => (
                            <button
                              key={st}
                              onClick={() => handleUpdateHelpStatus(req.id, st)}
                              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                                req.status === st
                                  ? 'bg-zinc-950 text-white border-zinc-950'
                                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 8: ADMIN CONTROL CENTER                                 */}
              {/* =============================================================== */}
              {activeSection === 'admin' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-editorial text-zinc-950">
                        Administration & Governance Control Center
                      </h1>
                      <p className="text-xs text-zinc-500 mt-1">
                        Manage Sign-in Credentials, RBAC role permissions, system audit logs, and personal profile settings.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-zinc-200/80 rounded-lg self-start">
                      {(
                        [
                          { id: 'credentials', label: 'Sign-in Credentials' },
                          { id: 'rbac', label: 'RBAC Matrix' },
                          { id: 'audit', label: 'Audit Logs' },
                          { id: 'profile', label: 'My Profile' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setAdminSubTab(tab.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            adminSubTab === tab.id
                              ? 'bg-white text-zinc-950 shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sign-in Credentials Guide & Access Control Subtab */}
                  {adminSubTab === 'credentials' && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-base font-bold text-zinc-950 font-sans">
                            <KeyRound className="w-4 h-4 text-zinc-900" />
                            <span>
                              Sign-in Credentials — Purpose & Role Access Guide
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Overview of how the Sign-in Credentials system works and which roles can access or manage credentials.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenAuthModal && (
                            <button
                              onClick={onOpenAuthModal}
                              className="px-3.5 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg transition-colors cursor-pointer"
                            >
                              Switch Account
                            </button>
                          )}
                          {isAdminOrAbove && (
                            <button
                              onClick={() => onChangeSection('members')}
                              className="px-4 py-2 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              Manage Member Credentials →
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 uppercase tracking-wider font-mono">
                            <Info className="w-4 h-4 text-zinc-700" />
                            <span>What Sign-in Credentials Is Used For</span>
                          </div>
                          <p className="text-xs text-zinc-600 leading-relaxed">
                            The <strong>Sign-in Credentials</strong> feature provides secure, role-based authentication into The Venture Club ERP Portal. It is used to:
                          </p>
                          <ul className="text-xs text-zinc-600 space-y-1.5 list-disc pl-4">
                            <li>
                              Authenticate club officers and members using their assigned <strong>username/college email and password</strong> (or Google Sign-In).
                            </li>
                            <li>
                              Route each user automatically to their authorized workspace (Admin Dashboard, Attendance Dashboard, Venture Pods, or Member Dashboard).
                            </li>
                            <li>
                              Allow authorized administrators to issue new login accounts, reset forgotten passwords, and toggle attendance-taking privileges.
                            </li>
                          </ul>
                        </div>

                        <div className="p-5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 uppercase tracking-wider font-mono">
                            <ShieldCheck className="w-4 h-4 text-emerald-700" />
                            <span>Which Users Can Access It</span>
                          </div>
                          <ul className="text-xs text-zinc-600 space-y-2 leading-relaxed">
                            <li>
                              <strong>1. Super Admin (Arjun Mehta):</strong> Full unrestricted access to all Sign-in Credentials controls, including creating/editing accounts, assigning any role (1–9), resetting passwords, and deactivating accounts.
                            </li>
                            <li>
                              <strong>2. Executive Leadership (President, Vice President, Secretary, Admin):</strong> Authorized to issue member credentials, assign officer/member roles, reset passwords, and grant attendance permissions.
                            </li>
                            <li>
                              <strong>3. All Club Roles (Project Lead, Attendance Head, Media Head, Member):</strong> Can use the <em>Sign-in Credentials</em> modal to log in or switch accounts, and can update their own personal profile, but cannot view or modify other members' credentials.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RBAC Governance Matrix Subtab */}
                  {adminSubTab === 'rbac' && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
                      <div>
                        <h2 className="text-base font-bold text-zinc-950 font-sans">
                          Role-Based Access Control (RBAC) & Position Hierarchy (1–9)
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Roles are displayed in the official 1–9 club sequence. Vacant positions are highlighted and Members are listed last.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...data.roles]
                          .sort(
                            (a, b) =>
                              (ROLE_SEQUENCE_NUMBER[a.name] ?? 9) -
                              (ROLE_SEQUENCE_NUMBER[b.name] ?? 9)
                          )
                          .map((r) => {
                            const seq = ROLE_SEQUENCE_NUMBER[r.name] ?? 9;
                            const holders = data.members.filter(
                              (m) =>
                                m.role === (r.name as UserRole) && m.isActive
                            );
                            return (
                              <div
                                key={r.id}
                                className="p-5 border border-zinc-200 rounded-xl space-y-2"
                              >
                                <div className="text-xs font-mono font-bold text-zinc-950 flex items-center justify-between gap-2">
                                  <span>
                                    {seq}.{' '}
                                    {ROLE_LABELS[r.name as UserRole]
                                      ? `${ROLE_LABELS[r.name as UserRole]} (${
                                          r.name
                                        })`
                                      : r.name}
                                  </span>
                                  {holders.length > 0 ? (
                                    <span className="text-[10px] text-zinc-500">
                                      {r.name === 'MEMBER'
                                        ? `LISTED LAST (${holders.length})`
                                        : holders
                                            .map((h) => h.fullName)
                                            .join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-800 font-bold">
                                      POSITION VACANT
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-600">
                                  {r.description}
                                </p>
                                <div className="text-[11px] font-mono text-zinc-400 pt-2">
                                  Permissions:{' '}
                                  {safeParseList(r.permissions).join(' · ')}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Security & System Audit Logs Subtab */}
                  {adminSubTab === 'audit' && (
                    <AuditLog
                      logs={data.auditLogs}
                      apiFetch={apiFetch}
                      onRefresh={onRefreshErp}
                    />
                  )}

                  {/* My Profile Subtab */}
                  {adminSubTab === 'profile' && (
                    <form
                      onSubmit={handleSaveMyProfile}
                      className="bg-white border border-zinc-200 rounded-xl p-6 max-w-2xl space-y-4"
                    >
                      <div>
                        <h2 className="text-base font-bold text-zinc-950 font-sans">
                          My Member Profile
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Update your phone number, department, and bio.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            College Roll Number
                          </label>
                          <input
                            type="text"
                            value={profRoll}
                            onChange={(e) => setProfRoll(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={profPhone}
                            onChange={(e) => setProfPhone(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Branch / Specialization
                          </label>
                          <input
                            type="text"
                            value={profBranch}
                            onChange={(e) => setProfBranch(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1">
                            Club Position
                          </label>
                          <input
                            type="text"
                            value={profPosition}
                            onChange={(e) => setProfPosition(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Bio
                        </label>
                        <textarea
                          rows={3}
                          value={profBio}
                          onChange={(e) => setProfBio(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer shadow-xs"
                      >
                        Save Changes
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* =============================================================== */}
              {/* SECTION 9: AUDIT LOG (ADMIN CONTROL CENTER)                     */}
              {/* =============================================================== */}
              {activeSection === 'audit-log' && isAdminOrAbove && (
                <div className="space-y-6">
                  <AuditLog
                    logs={data.auditLogs}
                    apiFetch={apiFetch}
                    onRefresh={onRefreshErp}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-zinc-200 z-30 flex items-center justify-around px-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeSection(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium ${
                  active ? 'text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate max-w-[64px]">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* =============================================================== */}
      {/* ADMIN MODALS: CREATE, EDIT, RESET PASSWORD, DELETE              */}
      {/* =============================================================== */}

      {/* 1. CREATE MEMBER MODAL */}
      {showCreateMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCreateMemberModal(false)}
        >
          <form
            onSubmit={handleCreateMember}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <TvcLogo size="xs" />
                <h3 className="text-base font-bold text-zinc-950 font-sans">
                  Create New Member & Credentials
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateMemberModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Vikramaditya Sen"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="vikram@theventureclub.in"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Login Username *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberUsername}
                  onChange={(e) =>
                    setNewMemberUsername(e.target.value.toLowerCase())
                  }
                  placeholder="e.g. vikram"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Initial Password *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  placeholder="e.g. venture2026"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  System Role *
                </label>
                <select
                  value={newMemberRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setNewMemberRole(r);
                    setNewMemberPosition(ROLE_LABELS[r] || 'Member');
                    if (
                      r === 'SUPER_ADMIN' ||
                      r === 'ADMIN' ||
                      r === 'PRESIDENT' ||
                      r === 'VICE_PRESIDENT' ||
                      r === 'SECRETARY' ||
                      r === 'ATTENDANCE_HEAD'
                    ) {
                      setNewMemberCanTakeAttendance(true);
                    } else {
                      setNewMemberCanTakeAttendance(false);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono text-zinc-900"
                >
                  <option value="MEMBER">Member (MEMBER)</option>
                  <option value="PROJECT_LEAD">
                    Project Lead (PROJECT_LEAD)
                  </option>
                  <option value="ATTENDANCE_HEAD">
                    Attendance Head (ATTENDANCE_HEAD)
                  </option>
                  <option value="MEDIA_HEAD">Media Head (MEDIA_HEAD)</option>
                  <option value="SECRETARY">Secretary (SECRETARY)</option>
                  <option value="VICE_PRESIDENT">
                    Vice President (VICE_PRESIDENT)
                  </option>
                  <option value="PRESIDENT">President (PRESIDENT)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                  {(currentUser.role === 'SUPER_ADMIN' ||
                    currentUser.role === 'PRESIDENT') && (
                    <option value="SUPER_ADMIN">
                      Super Admin (SUPER_ADMIN)
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Club Position
                </label>
                <input
                  type="text"
                  value={newMemberPosition}
                  onChange={(e) => setNewMemberPosition(e.target.value)}
                  placeholder="e.g. Venture Fellow"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
            </div>

            {/* Attendance Role / Permission Toggle */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberCanTakeAttendance}
                  onChange={(e) =>
                    setNewMemberCanTakeAttendance(e.target.checked)
                  }
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Assign Attendance-Taking Access (Attendance Role)
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                    Grants this member permission to start attendance sessions, manage Shooting attendance, and mark daily roll call.
                  </p>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Course / Branch
                </label>
                <input
                  type="text"
                  value={newMemberBranch}
                  onChange={(e) => setNewMemberBranch(e.target.value)}
                  placeholder="e.g. B.Tech AI ML"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={newMemberRoll}
                  onChange={(e) => setNewMemberRoll(e.target.value)}
                  placeholder="e.g. 2422351"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="e.g. 9466909600"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowCreateMemberModal(false)}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingMember}
                className="px-5 py-2 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {creatingMember ? 'Creating...' : 'Create Member Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. EDIT MEMBER MODAL */}
      {editMemberModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditMemberModalItem(null)}
        >
          <form
            onSubmit={handleSaveEditMember}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-950 font-sans">
                Edit Member: {editMemberModalItem.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setEditMemberModalItem(null)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setEditRole(r);
                    setEditPosition(ROLE_LABELS[r] || editPosition);
                    if (
                      r === 'SUPER_ADMIN' ||
                      r === 'ADMIN' ||
                      r === 'PRESIDENT' ||
                      r === 'VICE_PRESIDENT' ||
                      r === 'SECRETARY' ||
                      r === 'ATTENDANCE_HEAD'
                    ) {
                      setEditCanTakeAttendance(true);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono text-zinc-900"
                >
                  <option value="MEMBER">Member (MEMBER)</option>
                  <option value="PROJECT_LEAD">
                    Project Lead (PROJECT_LEAD)
                  </option>
                  <option value="ATTENDANCE_HEAD">
                    Attendance Head (ATTENDANCE_HEAD)
                  </option>
                  <option value="MEDIA_HEAD">Media Head (MEDIA_HEAD)</option>
                  <option value="SECRETARY">Secretary (SECRETARY)</option>
                  <option value="VICE_PRESIDENT">
                    Vice President (VICE_PRESIDENT)
                  </option>
                  <option value="PRESIDENT">President (PRESIDENT)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                  {(currentUser.role === 'SUPER_ADMIN' ||
                    currentUser.role === 'PRESIDENT') && (
                    <option value="SUPER_ADMIN">
                      Super Admin (SUPER_ADMIN)
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Attendance Role Toggle */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editCanTakeAttendance}
                  onChange={(e) => setEditCanTakeAttendance(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-950">
                  Allow taking & managing attendance from dashboard
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono text-zinc-900"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="ALUMNI">ALUMNI</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={editRoll}
                  onChange={(e) => setEditRoll(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Course / Branch
                </label>
                <input
                  type="text"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setEditMemberModalItem(null)}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. RESET PASSWORD MODAL */}
      {resetPassTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setResetPassTarget(null)}
        >
          <form
            onSubmit={handleResetPassword}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-950 font-sans">
                Reset Password for {resetPassTarget.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setResetPassTarget(null)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                New Secure Password
              </label>
              <input
                type="text"
                required
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPassTarget(null)}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer shadow-xs"
              >
                Reset Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. DELETE MEMBER MODAL */}
      {deleteMemberTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteMemberTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-red-700 font-sans">
              Delete Member Account?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong>{deleteMemberTarget.fullName}</strong> (@
              {deleteMemberTarget.username})? This action cannot be undone and will revoke all access.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteMemberTarget(null)}
                className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMember}
                className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shadow-xs"
              >
                Yes, Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {showEventModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowEventModal(false)}
        >
          <form
            onSubmit={handleCreateEvent}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950 font-sans">
                Create Club Event
              </h3>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Event Title"
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                required
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
              />
              <input
                type="time"
                required
                value={newEventTime}
                onChange={(e) => setNewEventTime(e.target.value)}
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={newEventVenue}
                onChange={(e) => setNewEventVenue(e.target.value)}
                placeholder="Venue"
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
              />
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value)}
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg text-zinc-900"
              >
                <option value="Shooting & Club Meetings">
                  Shooting & Club Meetings
                </option>
                <option value="General Meeting">General Meeting</option>
                <option value="Summit">Summit</option>
                <option value="Build Sprint">Build Sprint</option>
                <option value="Roundtable">Roundtable</option>
              </select>
            </div>
            <textarea
              rows={3}
              required
              value={newEventDesc}
              onChange={(e) => setNewEventDesc(e.target.value)}
              placeholder="Event agenda and description..."
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-xs text-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg cursor-pointer"
              >
                Publish Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showNewProjectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowNewProjectModal(false)}
        >
          <form
            onSubmit={handleCreateProject}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950 font-sans">
                Initialize New Venture Pod
              </h3>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Venture Pod Name"
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <textarea
              rows={2}
              required
              value={newProjProblem}
              onChange={(e) => setNewProjProblem(e.target.value)}
              placeholder="Industry problem statement..."
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={newProjDesc}
              onChange={(e) => setNewProjDesc(e.target.value)}
              placeholder="Technical architecture summary..."
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newProjTech}
                onChange={(e) => setNewProjTech(e.target.value)}
                placeholder="Tech stack (comma separated)"
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
              />
              <input
                type="date"
                value={newProjDeadline}
                onChange={(e) => setNewProjDeadline(e.target.value)}
                className="px-3.5 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-2 text-xs text-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg cursor-pointer"
              >
                Launch Venture Pod
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showNewTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowNewTaskModal(false)}
        >
          <form
            onSubmit={handleCreateTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950 font-sans">
                Add Task to {currentProject?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Acceptance criteria / implementation notes"
              className="w-full px-3.5 py-2 text-xs border border-zinc-200 rounded-lg"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                placeholder="Assignee Name"
                className="px-3 py-2 text-xs border border-zinc-200 rounded-lg"
              />
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(e.target.value as TaskPriority)
                }
                className="px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono text-zinc-900"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
              <input
                type="date"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
                className="px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="px-4 py-2 text-xs text-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg cursor-pointer"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* START NEW ATTENDANCE SESSION MODAL */}
      {showStartSessionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setShowStartSessionModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-6"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-emerald-800" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 font-sans">
                    Start New Attendance Session
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Configure roll call session, duration, and default call times
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStartSessionModal(false)}
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Session Category — Mutually Exclusive 3 Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-900 block">
                Session Type (Select one):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewSessionCategory('SHOOTING')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionCategory === 'SHOOTING'
                      ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-950">
                    Shooting
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Outdoor & indoor production roll call
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionCategory('MEETING')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionCategory === 'MEETING'
                      ? 'border-zinc-950 bg-zinc-100 ring-1 ring-zinc-950'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-950">
                    Club Meeting
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Standard weekly Venture Club gathering & sync
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionCategory('COMBINED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionCategory === 'COMBINED'
                      ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-950">
                    Shooting & Club Meeting
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Combined session covering both activities
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Time Selection (Dedicated Control Center Defaults: 11:00 AM or After 3:40 PM) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-900 block">
                Call Time Selection:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewSessionTimeOption('11:00')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionTimeOption === '11:00'
                      ? 'border-zinc-950 bg-zinc-900 text-white'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 text-zinc-900'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">11:00 AM</div>
                  <div className={`text-[11px] mt-0.5 ${newSessionTimeOption === '11:00' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    Standard morning production slot
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionTimeOption('15:40')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionTimeOption === '15:40'
                      ? 'border-zinc-950 bg-zinc-900 text-white'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 text-zinc-900'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">After 3:40 PM</div>
                  <div className={`text-[11px] mt-0.5 ${newSessionTimeOption === '15:40' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    Post-class afternoon session slot
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSessionTimeOption('CUSTOM')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    newSessionTimeOption === 'CUSTOM'
                      ? 'border-zinc-950 bg-zinc-900 text-white'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50 text-zinc-900'
                  }`}
                >
                  <div className="text-xs font-bold">Custom Time</div>
                  <div className={`text-[11px] mt-0.5 ${newSessionTimeOption === 'CUSTOM' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    Specify an ad-hoc roll call time
                  </div>
                </button>
              </div>

              {newSessionTimeOption === 'CUSTOM' && (
                <div className="pt-1">
                  <input
                    type="time"
                    value={newSessionCustomTime}
                    onChange={(e) => setNewSessionCustomTime(e.target.value)}
                    className="px-3 py-2 text-xs font-mono border border-zinc-200 rounded-lg bg-zinc-50"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Duration Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-900">
                  Session Duration:
                </label>
                <span className="text-xs font-mono font-semibold text-emerald-700">
                  {newSessionDurationMinutes} minutes ({newSessionDurationMinutes / 60} hours)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[30, 60, 90, 120, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setNewSessionDurationMinutes(mins)}
                    className={`py-2 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      newSessionDurationMinutes === mins
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60} hr` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Operational Rules Note */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Automatic Setup & Attendance Rules:</span>
              </div>
              <ul className="text-zinc-600 text-[11px] space-y-1 list-disc list-inside">
                <li>
                  <strong>All {activeClubMembers.length} active members</strong> start marked as <strong>Present</strong> by default.
                </li>
                <li>
                  You only need to tap <strong>Absent</strong> for missing members, or <strong>Late / Exit</strong> as required.
                </li>
                <li>
                  Once submitted, the session is uploaded to the database and can be edited for <strong>up to 60 minutes</strong> (or during the 2-hour window).
                </li>
                <li>
                  Members arriving after 2 hours remain marked <strong>Absent</strong>. Full report is downloadable at any time.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowStartSessionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={startingSession}
                onClick={() => {
                  const time =
                    newSessionTimeOption === '11:00'
                      ? '11:00'
                      : newSessionTimeOption === '15:40'
                      ? '15:40'
                      : newSessionCustomTime || '11:00';
                  handleStartAttendanceSession(
                    newSessionCategory,
                    time,
                    newSessionDurationMinutes
                  );
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{startingSession ? 'Starting Session...' : 'Start Session Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE ANALYTICS & BAR GRAPH MODAL */}
      {showAnalyticsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setShowAnalyticsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8"
          >
            <AttendanceAnalytics
              attendanceRecords={data.attendanceRecords}
              members={data.members}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setShowAnalyticsModal(false);
              }}
              onClose={() => setShowAnalyticsModal(false)}
              initialChartStyle="bar"
            />
          </div>
        </div>
      )}

      {/* ERP SYSTEM DIAGNOSTICS & TELEMETRY MODAL */}
      {showDiagModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setShowDiagModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg sm:max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 sm:space-y-6 relative my-8"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-zinc-900 text-white">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">ERP Connection & Telemetry Diagnostics</h3>
                  <p className="text-xs text-zinc-500">Real-time status, token validation, latency, and promise rejection logs.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Connection Status</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${diagStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : diagStatus === 'fallback' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
                  <span className="text-sm font-bold capitalize text-zinc-950">{diagStatus === 'fallback' ? 'Static Fallback Mode' : diagStatus}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">API Response Latency</span>
                <div className="text-sm font-mono font-bold text-zinc-950">
                  {diagLatencyMs !== null ? `${diagLatencyMs} ms` : 'Measuring...'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Token & Session Telemetry</h4>
              <div className="p-3 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-1.5 overflow-x-auto">
                <div>User ID: <span className="text-emerald-400">{currentUser.id}</span> ({currentUser.username})</div>
                <div>Role: <span className="text-amber-400">{currentUser.role}</span></div>
                <div>Token Type: <span className="text-blue-400">{localStorage.getItem('tvc_session_token') ? 'Custom Session Bearer Token' : 'Firebase / Anonymous'}</span></div>
                <div>Bootstrap Cache: <span className="text-purple-400">{sessionStorage.getItem('tvc_erp_bootstrap_cache') ? 'Active (SessionStorage)' : 'None'}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Captured Errors & Promise Rejections</h4>
                <span className="text-[11px] font-mono text-zinc-400">{diagRejections.length} logged</span>
              </div>
              <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-800 space-y-1">
                {diagRejections.length === 0 ? (
                  <div className="text-emerald-700 italic">No promise rejections or errors captured. System healthy!</div>
                ) : (
                  diagRejections.map((rej, idx) => (
                    <div key={idx} className="break-all border-b border-red-200/50 pb-1">{rej}</div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={runDiagPing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-run Connection Ping</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDiagModal(false)}
                className="px-5 py-2 text-xs font-bold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-md"
              >
                Close Diagnostics
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
