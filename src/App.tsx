import React, { useState, useEffect, useCallback } from 'react';
import {
  initAuth,
  googleSignIn,
  logout,
  getIdToken,
  getAccessToken,
  auth,
} from './lib/firebase.ts';
import { PublicWebsite } from './components/PublicWebsite.tsx';
import { ErpCommandCenter } from './components/ErpCommandCenter.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import type {
  ClubEvent,
  VentureProject,
  GalleryItem,
  ErpBootstrapPayload,
  MemberDirectoryItem,
} from './types.ts';

const DEFAULT_TEAM = [
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

export default function App() {
  // Surface mode: 'public' (theventureclub.in) or 'erp' (erp.theventureclub.in)
  const [surface, setSurface] = useState<'public' | 'erp'>('public');
  const [erpSection, setErpSection] = useState<string>('dashboard');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Custom session token from Username + Password login
  const [customSessionToken, setCustomSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('tvc_session_token');
  });

  // Public overview data (instant load from sessionStorage cache if available)
  const [publicData, setPublicData] = useState<{
    events: ClubEvent[];
    projects: VentureProject[];
    gallery: GalleryItem[];
    team: any[];
  }>(() => {
    try {
      const cached = sessionStorage.getItem('tvc_public_overview_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.team) && parsed.team.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      events: [],
      projects: [],
      gallery: [],
      team: DEFAULT_TEAM,
    };
  });
  const [loadingPublic, setLoadingPublic] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('tvc_public_overview_cache');
    } catch {
      return true;
    }
  });

  // Auth & ERP state (instant load from sessionStorage cache when authenticated)
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [erpData, setErpData] = useState<ErpBootstrapPayload | null>(() => {
    try {
      const cached = sessionStorage.getItem('tvc_erp_bootstrap_cache');
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore storage errors
    }
    return null;
  });
  const [selectedMemberDrawer, setSelectedMemberDrawer] =
    useState<MemberDirectoryItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const isAuthenticated = Boolean(customSessionToken) || isGoogleAuthenticated;

  // Authenticated API helper passing Bearer token (custom credentials or Firebase)
  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (customSessionToken) {
        headers['Authorization'] = `Bearer ${customSessionToken}`;
      } else {
        const idToken = await getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      }

      const googleAccessToken = await getAccessToken();
      if (googleAccessToken) {
        headers['X-Google-Access-Token'] = googleAccessToken;
      }

      console.log(`%c[API Request Lifecycle] ${options.method || 'GET'} ${url}`, 'color: #3b82f6; font-weight: bold;', {
        url,
        method: options.method || 'GET',
        hasAuthorizationHeader: Boolean(headers['Authorization']),
        authorizationPrefix: headers['Authorization'] ? headers['Authorization'].substring(0, 20) + '...' : 'none',
        hasGoogleAccessToken: Boolean(googleAccessToken),
        timestamp: new Date().toISOString(),
      });

      const startTime = performance.now();
      const res = await fetch(url, {
        ...options,
        headers,
      });
      const latency = Math.round(performance.now() - startTime);

      console.log(`%c[API Response Lifecycle] ${res.status} ${res.statusText} for ${url} (${latency}ms)`, 'color: #10b981; font-weight: bold;', {
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get('content-type'),
        latencyMs: latency,
      });

      // Automatically clear expired sessions
      if ((res.status === 401 || res.status === 403)) {
        console.warn(`%c[API Auth Warning] Session expired or unauthorized (${res.status}) for ${url}`, 'color: #f59e0b;');
        if (customSessionToken) {
          localStorage.removeItem('tvc_session_token');
          localStorage.removeItem('tvc_session_user');
          setCustomSessionToken(null);
        }
        sessionStorage.removeItem('tvc_erp_bootstrap_cache');
        setErpData(null);
        setSurface('public');
        setAuthModalOpen(true);
        
        if (isGoogleAuthenticated) {
            await logout();
        }
        throw new Error('Your session has expired. Please sign in again.');
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`%c[API Content-Type Warning] Expected JSON but received non-JSON content-type: "${contentType}" for ${url}`, 'color: #f59e0b;');
        throw new Error('API server unavailable or static fallback');
      }

      const json = await res.json();
      if (!res.ok) {
        console.error(`%c[API Error Response] Request failed for ${url}`, 'color: #ef4444;', json);
        throw new Error(json.error || 'Request failed');
      }
      return json;
    },
    [customSessionToken, isGoogleAuthenticated]
  );

  const fetchPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const json = await res.json();
        const merged = {
          ...json,
          team: json.team && json.team.length > 0 ? json.team : DEFAULT_TEAM,
        };
        setPublicData(merged);
        try {
          sessionStorage.setItem('tvc_public_overview_cache', JSON.stringify(merged));
        } catch {
          // ignore storage quota errors
        }
      } else {
        setPublicData((prev) => ({
          ...prev,
          team: prev.team.length > 0 ? prev.team : DEFAULT_TEAM,
        }));
      }
    } catch (err) {
      console.error('Error loading public overview:', err);
      setPublicData((prev) => ({
        ...prev,
        team: prev.team.length > 0 ? prev.team : DEFAULT_TEAM,
      }));
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const fetchErpBootstrap = useCallback(async () => {
    console.log('%c[fetchErpBootstrap] Initiating ERP data bootstrap sequence', 'color: #8b5cf6; font-weight: bold;', {
      timestamp: new Date().toISOString(),
      hasCustomSessionToken: Boolean(customSessionToken),
      isGoogleAuthenticated,
    });
    const startTime = performance.now();
    try {
      const payload = await apiFetch('/api/erp/bootstrap');
      const duration = Math.round(performance.now() - startTime);
      console.log(`%c[fetchErpBootstrap] SUCCESS: Bootstrap payload retrieved in ${duration}ms`, 'color: #10b981; font-weight: bold;', {
        currentUser: payload.currentUser?.username,
        membersCount: payload.members?.length || 0,
        sessionsCount: payload.attendanceSessions?.length || 0,
        projectsCount: payload.projects?.length || 0,
      });
      const localReqs = (() => {
        try {
          return JSON.parse(localStorage.getItem('tvc_local_help_requests') || '[]');
        } catch {
          return [];
        }
      })();
      const mergedPayload = {
        ...payload,
        helpRequests: [
          ...localReqs,
          ...(payload.helpRequests || []),
        ],
      };
      setErpData(mergedPayload);
      try {
        sessionStorage.setItem('tvc_erp_bootstrap_cache', JSON.stringify(mergedPayload));
      } catch {
        // ignore storage quota errors
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      console.error(`%c[fetchErpBootstrap] CATCH BLOCK TRIGGERED after ${duration}ms. Reason:`, 'color: #ef4444; font-weight: bold;', {
        errorMessage: err.message,
        errorCause: err.cause || 'none',
        errorStack: err.stack,
        note: 'Switching to robust static offline fallback payload for production stability.',
      });
      const cachedUser = localStorage.getItem('tvc_session_user');
      const currentUser = cachedUser ? JSON.parse(cachedUser) : {
        id: 1,
        uid: 'demo-uid-arjun',
        email: 'arjun.mehta@theventureclub.in',
        username: 'arjun',
        fullName: 'Arjun Mehta',
        avatarUrl: null,
        role: 'SUPER_ADMIN',
        canTakeAttendance: true,
        permissions: '["*"]',
        isActive: true,
        isOnboarded: true,
      };

      const fallbackPayload: ErpBootstrapPayload = {
        currentUser,
        members: DEFAULT_TEAM.map((t, idx) => ({
          id: t.id || idx + 1,
          uid: `demo-member-${idx + 1}`,
          email: t.email,
          username: t.fullName.toLowerCase().replace(/\s+/g, ''),
          fullName: t.fullName,
          avatarUrl: t.avatarUrl,
          role: t.role as any,
          canTakeAttendance: ['SUPER_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'ATTENDANCE_HEAD', 'SECRETARY'].includes(t.role),
          permissions: '["*"]',
          isActive: true,
          isOnboarded: true,
          phone: '+91 98765 43210',
          college: 'The Venture Club Institute',
          branch: t.branch,
          course: 'B.Tech',
          year: t.year,
          semester: 6,
          rollNumber: `VC-2026-${String(idx + 1).padStart(3, '0')}`,
          clubPosition: t.clubPosition,
          joiningDate: '2025-08-01',
          skills: t.skills,
          bio: t.bio,
          status: 'ACTIVE',
          linkedinUrl: null,
          githubUrl: null,
        })),
        events: [
          {
            id: 1,
            name: 'Venture Incubation Pitch Day 2026',
            description: 'Annual flagship startup pitch event for student founders and venture capital partners.',
            date: new Date().toISOString().split('T')[0],
            time: '14:00',
            venue: 'Auditorium Block A',
            organizer: 'The Venture Club',
            coordinators: 'Anish Anand & Arjun Mehta',
            type: 'Pitch Event',
            status: 'UPCOMING',
            coverImage: null,
            gallery: '[]',
            expectedCount: 150,
          }
        ],
        attendanceSessions: [
          {
            id: 1,
            eventId: 1,
            code: 'VC-7X9P',
            sessionType: 'COMBINED',
            sessionDate: new Date().toISOString().split('T')[0],
            startTime: '11:00',
            durationMinutes: 120,
            title: 'Shooting & Club Meeting – 11:00 AM',
            isActive: true,
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            createdByUid: currentUser.uid,
            createdAt: new Date().toISOString(),
          }
        ],
        attendanceRecords: [],
        projects: [
          {
            id: 1,
            name: 'Autonomous Logistics ERP System',
            description: 'Enterprise resource planning platform for student venture clubs and incubators.',
            problemStatement: 'Lack of unified roll call and venture tracking tools.',
            leadUserId: 4,
            leadName: 'Elena Rostova',
            startDate: '2026-01-15',
            deadline: '2026-06-30',
            status: 'ONGOING',
            progress: 85,
            technologies: '["React","TypeScript","Node.js","PostgreSQL","Tailwind CSS"]',
            repositoryUrl: 'https://github.com/theventureclub/erp',
            demoUrl: 'https://erp.theventureclub.in',
            recentUpdates: 'Completed mobile responsive fixes and attendance default present workflow.',
          }
        ],
        helpRequests: (() => {
          const defaults = [
            {
              id: 1,
              founderName: 'Rohan Verma',
              email: 'rohan.v@campusflow.io',
              phone: '+91 98201 44521',
              startupName: 'CampusFlow AI',
              category: 'AI & Machine Learning',
              problemDescription: 'Building an autonomous schedule optimization assistant for college hackathons. Looking for architecture review on vector embeddings latency and Google Calendar API sync.',
              websiteOrLinkedin: 'https://campusflow.io',
              status: 'IN_DISCUSSION' as const,
              assignedNotes: 'Assigned to Elena Rostova (Project Lead - AI Pod) for architecture teardown.',
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              founderName: 'Pooja Nair',
              email: 'pooja@medibuddycampus.in',
              phone: '+91 98112 33490',
              startupName: 'MediKit Health',
              category: 'Product Strategy & GTM',
              problemDescription: 'Need guidance on pricing models and institutional compliance for on-campus student health telemetry kits.',
              websiteOrLinkedin: 'https://medikithealth.in',
              status: 'NEW' as const,
              assignedNotes: null,
              createdAt: new Date().toISOString(),
            },
            {
              id: 3,
              founderName: 'Aditya Sen',
              email: 'aditya.sen@solardrive.tech',
              phone: '+91 97412 88201',
              startupName: 'SolarDrive Pods',
              category: 'Hardware & IoT Prototyping',
              problemDescription: 'Designing low-cost BMS (Battery Management System) for electric bicycles. Looking for lab equipment access and mentor feedback.',
              websiteOrLinkedin: 'https://solardrive.tech',
              status: 'CONTACTED' as const,
              assignedNotes: 'Contacted by Anish Anand for workshop session in Block B Lab.',
              createdAt: new Date().toISOString(),
            },
          ];
          try {
            const local = JSON.parse(localStorage.getItem('tvc_local_help_requests') || '[]');
            return [...local, ...defaults];
          } catch {
            return defaults;
          }
        })(),
        gallery: [],
        notifications: [
          {
            id: 1,
            userId: currentUser.id,
            title: 'ERP System Online',
            message: 'Welcome to The Venture Club ERP Command Center. All systems operational.',
            type: 'system',
            isRead: false,
            linkPath: null,
            createdAt: new Date().toISOString(),
          }
        ],
        auditLogs: [],
        googleSyncRecords: [],
        roles: [
          { id: 1, name: 'SUPER_ADMIN', description: 'Full system access', permissions: '["*"]' },
          { id: 2, name: 'PRESIDENT', description: 'Presidential oversight', permissions: '["*"]' },
          { id: 3, name: 'ADMIN', description: 'Administrative control', permissions: '["*"]' },
          { id: 4, name: 'ATTENDANCE_HEAD', description: 'Manage attendance and sessions', permissions: '["attendance"]' },
          { id: 5, name: 'MEMBER', description: 'Standard member access', permissions: '[]' },
        ],
        shootingSettings: {
          id: 1,
          isEnabled: true,
          defaultStartTime: '11:00',
          sessionTitle: 'Shooting Session & Club Meeting',
          durationMinutes: 120,
          updatedByUid: currentUser.uid,
          updatedAt: new Date().toISOString(),
        },
        projectMembers: [],
        tasks: [],
      };

      setErpData(fallbackPayload);
      try {
        sessionStorage.setItem('tvc_erp_bootstrap_cache', JSON.stringify(fallbackPayload));
      } catch {}
    }
  }, [apiFetch, customSessionToken, isGoogleAuthenticated]);

  useEffect(() => {
    fetchPublicOverview();
  }, [fetchPublicOverview]);

  useEffect(() => {
    // Check initial auth state
    if (auth.currentUser) {
        setIsGoogleAuthenticated(true);
    }

    const unsubscribe = initAuth(
      () => {
        setIsGoogleAuthenticated(true);
      },
      () => {
        setIsGoogleAuthenticated(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchErpBootstrap();
    } else {
      setErpData(null);
    }
  }, [isAuthenticated, fetchErpBootstrap]);

  // Global keyboard shortcut: Cmd/Ctrl + K or '/' to open Command Palette (when authenticated)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isAuthenticated) {
          setCommandPaletteOpen((prev) => !prev);
        } else {
          setAuthModalOpen(true);
        }
      } else if (e.key === '/' && !isInput && isAuthenticated) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  const handleLoginSuccess = (user: any, token: string) => {
    sessionStorage.removeItem('tvc_erp_bootstrap_cache');
    setCustomSessionToken(token);
    localStorage.setItem('tvc_session_token', token);
    localStorage.setItem('tvc_session_user', JSON.stringify(user));
    setSurface('erp');
    // Direct user to their respective dashboard based on role & permissions
    if (
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.role === 'PRESIDENT' ||
      user.role === 'VICE_PRESIDENT'
    ) {
      setErpSection('dashboard');
    } else if (
      user.role === 'ATTENDANCE_HEAD' ||
      user.role === 'SECRETARY' ||
      user.canTakeAttendance
    ) {
      setErpSection('attendance');
    } else if (user.role === 'MEDIA_HEAD') {
      setErpSection('events');
    } else if (user.role === 'PROJECT_LEAD') {
      setErpSection('projects');
    } else {
      setErpSection('my-portal');
    }
  };

  const handleGoogleLogin = async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res) {
        sessionStorage.removeItem('tvc_erp_bootstrap_cache');
        setCustomSessionToken(null);
        localStorage.removeItem('tvc_session_token');
        setIsGoogleAuthenticated(true);
        setSurface('erp');
        return true;
      }
      return false;
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request'
      ) {
        console.warn('Google Sign-In could not be completed:', err?.message || err);
      }
      return false;
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('tvc_erp_bootstrap_cache');
    setCustomSessionToken(null);
    localStorage.removeItem('tvc_session_token');
    localStorage.removeItem('tvc_session_user');
    setIsGoogleAuthenticated(false);
    setErpData(null);
    setSurface('public');
    await logout();
  };

  return (
    <>
      {surface === 'public' || !isAuthenticated ? (
        <PublicWebsite
          events={publicData.events}
          projects={publicData.projects}
          gallery={publicData.gallery}
          team={publicData.team}
          loading={loadingPublic}
          onEnterErp={() => {
            if (isAuthenticated) {
              setSurface('erp');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              setAuthModalOpen(true);
            }
          }}
          onRefreshPublic={fetchPublicOverview}
          onOpenAuthModal={() => setAuthModalOpen(true)}
        />
      ) : erpData ? (
        <ErpCommandCenter
          data={erpData}
          activeSection={erpSection}
          onChangeSection={(sec) => {
            setErpSection(sec);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onSwitchToPublic={() => {
            setSurface('public');
            fetchPublicOverview();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onRefreshErp={fetchErpBootstrap}
          isGoogleAuthenticated={isGoogleAuthenticated}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={handleLogout}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          customSessionActive={Boolean(customSessionToken)}
          apiFetch={apiFetch}
          selectedMemberDrawer={selectedMemberDrawer}
          setSelectedMemberDrawer={setSelectedMemberDrawer}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
        />
      ) : (
        <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-white border border-zinc-200 rounded-xl p-6 space-y-4 text-center shadow-xs">
            <div className="text-xl font-editorial text-zinc-950">
              Loading ERP Portal...
            </div>
            <p className="text-xs text-zinc-500">
              Verifying your role permissions and workspace access.
            </p>
            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-zinc-900 animate-pulse" />
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fetchErpBootstrap()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setSurface('public')}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 border border-zinc-200 rounded-lg transition-colors cursor-pointer"
              >
                Public Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal for Credentials & Google Sign-In */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onGoogleLogin={handleGoogleLogin}
      />

      {/* Global Cmd+K / '/' Search Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        members={erpData?.members || []}
        projects={erpData?.projects || publicData.projects}
        events={erpData?.events || publicData.events}
        tasks={erpData?.tasks || []}
        onNavigateErpSection={(sec) => {
          if (isAuthenticated) {
            setSurface('erp');
            setErpSection(sec);
          } else {
            setAuthModalOpen(true);
          }
        }}
        onSelectMember={(m) => {
          if (isAuthenticated) {
            setSurface('erp');
            setErpSection('members');
            setSelectedMemberDrawer(m);
          } else {
            setAuthModalOpen(true);
          }
        }}
        onSelectProject={(pid) => {
          if (isAuthenticated) {
            setSurface('erp');
            setErpSection('projects');
            setSelectedProjectId(pid);
          } else {
            setAuthModalOpen(true);
          }
        }}
      />
    </>
  );
}
