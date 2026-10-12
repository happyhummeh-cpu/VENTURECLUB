import React, { useState, useEffect, useCallback } from 'react';
import {
  initAuth,
  googleSignIn,
  logout,
  getIdToken,
  getAccessToken,
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
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore storage errors
    }
    return {
      events: [],
      projects: [],
      gallery: [],
      team: [],
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
      if (localStorage.getItem('tvc_session_token')) {
        const cached = sessionStorage.getItem('tvc_erp_bootstrap_cache');
        if (cached) return JSON.parse(cached);
      }
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

      const res = await fetch(url, {
        ...options,
        headers,
      });

      // Automatically clear expired custom session token in localStorage
      if ((res.status === 401 || res.status === 403) && customSessionToken) {
        localStorage.removeItem('tvc_session_token');
        localStorage.removeItem('tvc_session_user');
        sessionStorage.removeItem('tvc_erp_bootstrap_cache');
        setCustomSessionToken(null);
        setErpData(null);
        setSurface('public');
        setAuthModalOpen(true);
        throw new Error('Your session has expired. Please sign in again.');
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Request failed');
      }
      return json;
    },
    [customSessionToken]
  );

  const fetchPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      if (res.ok) {
        const json = await res.json();
        setPublicData(json);
        try {
          sessionStorage.setItem('tvc_public_overview_cache', JSON.stringify(json));
        } catch {
          // ignore storage quota errors
        }
      }
    } catch (err) {
      console.error('Error loading public overview:', err);
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const fetchErpBootstrap = useCallback(async () => {
    try {
      const payload = await apiFetch('/api/erp/bootstrap');
      setErpData(payload);
      try {
        sessionStorage.setItem('tvc_erp_bootstrap_cache', JSON.stringify(payload));
      } catch {
        // ignore storage quota errors
      }
    } catch (err) {
      console.error('Error loading ERP bootstrap:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchPublicOverview();
  }, [fetchPublicOverview]);

  useEffect(() => {
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
