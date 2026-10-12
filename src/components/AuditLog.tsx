import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  Search,
  Download,
  RefreshCw,
  Clock,
  User,
  KeyRound,
  QrCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  UserPlus,
  UserCheck,
  UserX,
  Edit,
  SlidersHorizontal,
  Eye,
  Activity,
  Layers,
} from 'lucide-react';
import type { AuditLogItem } from '../types.ts';

export interface AuditLogProps {
  logs?: AuditLogItem[];
  apiFetch?: (url: string, options?: RequestInit) => Promise<any>;
  onRefresh?: () => Promise<void>;
  className?: string;
}

// Action Category Mapping
type ActionCategory = 'ALL' | 'GOVERNANCE' | 'ATTENDANCE' | 'SECURITY' | 'SYNC' | 'PROJECTS';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  ADMIN: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PRESIDENT: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  VICE_PRESIDENT: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
  SECRETARY: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  MEDIA_HEAD: { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  ATTENDANCE_HEAD: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ATTENDANCE_COORDINATOR: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PROJECT_LEAD: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  MEMBER: { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-200' },
};

function getActionMeta(action: string) {
  switch (action) {
    case 'MEMBER_CREATED':
      return {
        label: 'Member Created',
        icon: UserPlus,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        category: 'GOVERNANCE',
      };
    case 'MEMBER_UPDATED':
      return {
        label: 'Member Updated',
        icon: Edit,
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        category: 'GOVERNANCE',
      };
    case 'MEMBER_DELETED':
    case 'MEMBER_DEACTIVATED':
      return {
        label: action === 'MEMBER_DELETED' ? 'Member Deleted' : 'Member Deactivated',
        icon: UserX,
        badgeClass: 'bg-red-50 text-red-800 border-red-200',
        category: 'GOVERNANCE',
      };
    case 'ATTENDANCE_ROLE_ASSIGNED':
      return {
        label: 'Attendance Role Assigned',
        icon: UserCheck,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        category: 'GOVERNANCE',
      };
    case 'ROLE_UPDATED':
    case 'RBAC_PERMISSION_UPDATED':
      return {
        label: 'Permissions Modified',
        icon: Shield,
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        category: 'GOVERNANCE',
      };
    case 'PASSWORD_RESET':
      return {
        label: 'Password Reset',
        icon: KeyRound,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        category: 'SECURITY',
      };
    case 'SESSION_CREATED':
    case 'ATTENDANCE_SESSION_STARTED':
      return {
        label: 'Attendance Session Live',
        icon: QrCode,
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
        category: 'ATTENDANCE',
      };
    case 'ROSTER_ATTENDANCE_BATCH_RECORDED':
      return {
        label: 'Roster Roll-Call Batch',
        icon: CheckCircle2,
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
        category: 'ATTENDANCE',
      };
    case 'ATTENDANCE_MARKED_CODE':
    case 'ATTENDANCE_RECORDED':
      return {
        label: 'Attendance Check-In',
        icon: CheckCircle2,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        category: 'ATTENDANCE',
      };
    case 'MANUAL_ATTENDANCE_OVERRIDE':
      return {
        label: 'Attendance Override',
        icon: AlertCircle,
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        category: 'ATTENDANCE',
      };
    case 'GOOGLE_SHEETS_SYNC_TRIGGERED':
    case 'GOOGLE_SHEETS_SYNC':
      return {
        label: 'Google Sheets Sync',
        icon: FileSpreadsheet,
        badgeClass: 'bg-green-50 text-green-800 border-green-200',
        category: 'SYNC',
      };
    case 'PROJECT_CREATED':
    case 'PROJECT_UPDATED':
    case 'PROJECT_MILESTONE_UPDATED':
    case 'TASK_CREATED':
      return {
        label: action.replace(/_/g, ' '),
        icon: FolderKanban,
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
        category: 'PROJECTS',
      };
    case 'HELP_REQUEST_TRIAGED':
      return {
        label: 'Help Request Triaged',
        icon: LifeBuoy,
        badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
        category: 'GOVERNANCE',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        icon: Activity,
        badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-200',
        category: 'SECURITY',
      };
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSecs < 60) return 'Just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function parseMetadata(raw: string): Record<string, any> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return { raw };
  }
}

export const AuditLog: React.FC<AuditLogProps> = ({
  logs: initialLogs = [],
  apiFetch,
  onRefresh,
  className = '',
}) => {
  // Live fetched data state
  const [dataLogs, setDataLogs] = useState<AuditLogItem[]>(initialLogs);
  const [serverTotalCount, setServerTotalCount] = useState<number>(initialLogs.length);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inspector Dialog State
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Synchronize when initialLogs update
  useEffect(() => {
    if (initialLogs && initialLogs.length > 0 && dataLogs.length === 0) {
      setDataLogs(initialLogs);
      setServerTotalCount(initialLogs.length);
      setServerTotalPages(Math.max(1, Math.ceil(initialLogs.length / pageSize)));
    }
  }, [initialLogs, pageSize, dataLogs.length]);

  // Main data fetching method using existing API service
  const fetchAuditLogs = useCallback(
    async (targetPage = currentPage, targetPageSize = pageSize) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('limit', String(targetPageSize));
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
        if (roleFilter !== 'ALL') params.set('role', roleFilter);
        if (entityFilter !== 'ALL') params.set('entityType', entityFilter);
        params.set('sort', sortOrder);

        const url = `/api/erp/audit-logs?${params.toString()}`;

        let result: any;
        if (apiFetch) {
          result = await apiFetch(url);
        } else {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to load audit logs: ${res.statusText}`);
          }
          result = await res.json();
        }

        if (result && Array.isArray(result.logs)) {
          setDataLogs(result.logs);
          setServerTotalCount(
            typeof result.total === 'number' ? result.total : result.logs.length
          );
          setServerTotalPages(
            result.totalPages || Math.max(1, Math.ceil((result.total || result.logs.length) / targetPageSize))
          );
        }
      } catch (err: any) {
        console.warn('Live audit logs fetch exception:', err);
        setFetchError(err.message || 'Failed to fetch live audit logs.');
        // Fallback to local filtering of initialLogs if available
        if (initialLogs.length > 0) {
          setDataLogs(initialLogs);
          setServerTotalCount(initialLogs.length);
          setServerTotalPages(Math.max(1, Math.ceil(initialLogs.length / targetPageSize)));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      apiFetch,
      currentPage,
      pageSize,
      searchQuery,
      categoryFilter,
      roleFilter,
      entityFilter,
      sortOrder,
      initialLogs,
    ]
  );

  // Trigger fetch on mount and parameter changes
  useEffect(() => {
    fetchAuditLogs(currentPage, pageSize);
  }, [fetchAuditLogs, currentPage, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const listToCount = dataLogs.length > 0 ? dataLogs : initialLogs;
    let governance = 0;
    let attendance = 0;
    let security = 0;
    let sync = 0;

    listToCount.forEach((log) => {
      const meta = getActionMeta(log.action);
      if (meta.category === 'GOVERNANCE') governance++;
      else if (meta.category === 'ATTENDANCE') attendance++;
      else if (meta.category === 'SYNC') sync++;
      else security++;
    });

    return {
      total: serverTotalCount || listToCount.length,
      governance,
      attendance,
      security,
      sync,
    };
  }, [dataLogs, initialLogs, serverTotalCount]);

  // Unique Entities for Dropdown
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    const pool = dataLogs.length > 0 ? dataLogs : initialLogs;
    pool.forEach((l) => {
      if (l.entityType) set.add(l.entityType);
    });
    return Array.from(set).sort();
  }, [dataLogs, initialLogs]);

  // Client-side fallback filtered logs if server returns entire set or on offline fallback
  const displayedLogs = useMemo(() => {
    // If the data is already paginated by the server (e.g. length matches pageSize or less than total)
    // we still apply category filtering if necessary
    return dataLogs.filter((log) => {
      if (categoryFilter !== 'ALL') {
        const meta = getActionMeta(log.action);
        if (meta.category !== categoryFilter) return false;
      }
      return true;
    });
  }, [dataLogs, categoryFilter]);

  const effectiveTotalPages = Math.max(1, serverTotalPages);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      await fetchAuditLogs(currentPage, pageSize);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleCopyJson = (log: AuditLogItem) => {
    const formatted = JSON.stringify(
      {
        id: log.id,
        timestamp: log.createdAt,
        actor: {
          name: log.actorName,
          role: log.actorRole,
          uid: log.actorUid,
        },
        action: log.action,
        entity: {
          type: log.entityType,
          id: log.entityId,
        },
        metadata: parseMetadata(log.metadata),
      },
      null,
      2
    );

    navigator.clipboard.writeText(formatted);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Actor Name',
      'Actor Role',
      'Actor UID',
      'Action Type',
      'Entity Type',
      'Entity ID',
      'Timestamp',
      'Metadata',
    ];
    const rows = displayedLogs.map((l) => [
      l.id,
      `"${l.actorName.replace(/"/g, '""')}"`,
      `"${l.actorRole}"`,
      `"${l.actorUid}"`,
      `"${l.action}"`,
      `"${l.entityType}"`,
      `"${l.entityId}"`,
      `"${l.createdAt}"`,
      `"${(l.metadata || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `the_venture_club_audit_log_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    entityFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setRoleFilter('ALL');
    setEntityFilter('ALL');
    setCurrentPage(1);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-zinc-950 text-white shadow-xs">
              <Shield className="w-5 h-5 text-blue-400" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-sans text-zinc-950 tracking-tight">
                System Audit Trail & Transparency Log
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                <span>Cryptographic ledger of system actions</span>
                <span>•</span>
                <span className="font-mono text-emerald-700 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active API Tracking
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
            title="Refresh Audit Logs via API"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing || isLoading ? 'animate-spin text-zinc-950' : 'text-zinc-500'
              }`}
            />
            <span>{isLoading ? 'Fetching...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={displayedLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Download full audit log as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* METRIC STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
            Total Audit Records
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tabular-nums mt-1">
            {metrics.total}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Full ledger transactions
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono text-blue-600 uppercase tracking-wider">
            Governance Actions
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700 tabular-nums mt-1">
            {metrics.governance}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Members & credentials
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono text-emerald-600 uppercase tracking-wider">
            Attendance Events
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums mt-1">
            {metrics.attendance}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            PIN codes & roll calls
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono text-amber-600 uppercase tracking-wider">
            Security & Sync
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 tabular-nums mt-1">
            {metrics.security + metrics.sync}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Sheets sync & resets
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by actor, action type, entity, or ID..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Category Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { id: 'ALL', label: 'All Actions' },
                { id: 'GOVERNANCE', label: 'Governance' },
                { id: 'ATTENDANCE', label: 'Attendance' },
                { id: 'SECURITY', label: 'Security' },
                { id: 'SYNC', label: 'Sheets Sync' },
                { id: 'PROJECTS', label: 'Projects' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryFilter(cat.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-950'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px]">
            <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
            <span>Filters:</span>
          </div>

          {/* Actor Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-md text-zinc-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="PRESIDENT">President</option>
            <option value="VICE_PRESIDENT">Vice President</option>
            <option value="SECRETARY">Secretary</option>
            <option value="MEDIA_HEAD">Media Head</option>
            <option value="ATTENDANCE_HEAD">Attendance Head</option>
            <option value="PROJECT_LEAD">Project Lead</option>
            <option value="MEMBER">Member</option>
          </select>

          {/* Entity Filter */}
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-md text-zinc-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Entities</option>
            {uniqueEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as 'desc' | 'asc');
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-md text-zinc-800 focus:outline-none cursor-pointer font-mono"
          >
            <option value="desc">Newest First ↓</option>
            <option value="asc">Oldest First ↑</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-red-600 hover:text-red-800 font-medium ml-auto cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ERROR BANNER IF ANY */}
      {fetchError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Live sync alert: {fetchError}. Showing cached local records.
            </span>
          </div>
          <button
            onClick={() => fetchAuditLogs(currentPage, pageSize)}
            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold rounded text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* PAGINATED AUDIT LOG TABLE */}
      {/* Required Columns: 'Actor', 'Action Type', 'Entity', 'Timestamp' */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold text-zinc-600 font-mono uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[200px]">Actor</th>
                <th className="py-3 px-4 min-w-[190px]">Action Type</th>
                <th className="py-3 px-4 min-w-[150px]">Entity</th>
                <th className="py-3 px-4 min-w-[160px]">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-sans">
              {isLoading && displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
                      <span className="text-xs font-mono">Loading audit transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedLogs.length > 0 ? (
                displayedLogs.map((log) => {
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;
                  const roleStyle = ROLE_COLORS[log.actorRole] || ROLE_COLORS.MEMBER;
                  const payloadObj = parseMetadata(log.metadata);
                  const payloadKeys = Object.keys(payloadObj);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/70 transition-colors group cursor-pointer"
                      onClick={() => setInspectItem(log)}
                    >
                      {/* Column 1: Actor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-zinc-950 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                            {log.actorName
                              ? log.actorName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()
                              : 'VC'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-950 truncate flex items-center gap-1.5">
                              <span>{log.actorName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                              >
                                {log.actorRole}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[100px]">
                                {log.actorUid}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Action Type */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border ${meta.badgeClass}`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{log.action}</span>
                          </span>
                          <div className="text-[10px] font-mono text-zinc-400 pl-0.5">
                            Category: {meta.category}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Entity */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                            {log.entityType}
                          </span>
                          <span className="text-zinc-600 font-bold">
                            #{log.entityId}
                          </span>
                        </div>
                        {payloadKeys.length > 0 && (
                          <div className="text-[10px] text-zinc-400 truncate max-w-[140px] mt-0.5 font-sans">
                            {payloadKeys.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Column 4: Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5" title={log.createdAt}>
                          <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="font-medium text-zinc-700">
                            {formatRelativeTime(log.createdAt)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[130px] mt-0.5">
                          {new Date(log.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Details / Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectItem(log);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors cursor-pointer group-hover:border-zinc-300"
                        >
                          <Eye className="w-3 h-3 text-zinc-400" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-semibold text-zinc-900">
                      No matching audit records found
                    </div>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      No system events matched the search query or active filters. Try broadening your criteria.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="px-4 sm:px-6 py-3 border-t border-zinc-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <span className="font-mono font-semibold text-zinc-950">
                {displayedLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-mono font-semibold text-zinc-950">
                {Math.min(currentPage * pageSize, serverTotalCount || displayedLogs.length)}
              </span>{' '}
              of{' '}
              <span className="font-mono font-semibold text-zinc-950">
                {serverTotalCount || displayedLogs.length}
              </span>{' '}
              actions
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-200">
              <span className="text-[11px] text-zinc-400">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 text-xs bg-zinc-50 border border-zinc-200 rounded font-mono text-zinc-800 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="font-mono text-xs px-2 py-1 text-zinc-700 tabular-nums">
              Page {currentPage} of {effectiveTotalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(effectiveTotalPages, p + 1))}
              disabled={currentPage >= effectiveTotalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* INSPECT METADATA MODAL */}
      {inspectItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs"
          onClick={() => setInspectItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-zinc-950 text-white">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </span>
                  <h3 className="text-base font-bold text-zinc-950 font-sans">
                    System Action #{inspectItem.id}
                  </h3>
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  Logged at {new Date(inspectItem.createdAt).toUTCString()}
                </div>
              </div>

              <button
                onClick={() => setInspectItem(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key Value Summary for Required Columns */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-150">
              <div>
                <span className="text-zinc-400 block font-mono text-[10px] uppercase">
                  Actor
                </span>
                <span className="font-semibold text-zinc-950">
                  {inspectItem.actorName}
                </span>
                <div className="text-[10px] font-mono text-zinc-500">
                  Role: {inspectItem.actorRole}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate">
                  UID: {inspectItem.actorUid}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block font-mono text-[10px] uppercase">
                  Action Type
                </span>
                <span className="font-mono font-bold text-zinc-950">
                  {inspectItem.action}
                </span>
                <div className="text-[10px] font-mono text-zinc-500">
                  Category: {getActionMeta(inspectItem.action).category}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block font-mono text-[10px] uppercase">
                  Entity
                </span>
                <span className="font-mono font-semibold text-zinc-900">
                  {inspectItem.entityType}
                </span>
                <div className="text-[10px] font-mono text-zinc-500">
                  Entity ID: #{inspectItem.entityId}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block font-mono text-[10px] uppercase">
                  Timestamp
                </span>
                <span className="font-mono text-zinc-900">
                  {new Date(inspectItem.createdAt).toISOString()}
                </span>
                <div className="text-[10px] text-zinc-500">
                  {formatRelativeTime(inspectItem.createdAt)}
                </div>
              </div>
            </div>

            {/* Raw JSON Payload */}
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-xs font-bold text-zinc-800 font-mono">
                  Payload Metadata (JSON)
                </span>
                <button
                  onClick={() => handleCopyJson(inspectItem)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 cursor-pointer"
                >
                  {copiedId === inspectItem.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 bg-zinc-900 text-zinc-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56">
                {JSON.stringify(
                  {
                    id: inspectItem.id,
                    timestamp: inspectItem.createdAt,
                    actor: {
                      name: inspectItem.actorName,
                      role: inspectItem.actorRole,
                      uid: inspectItem.actorUid,
                    },
                    action: inspectItem.action,
                    entity: {
                      type: inspectItem.entityType,
                      id: inspectItem.entityId,
                    },
                    metadata: parseMetadata(inspectItem.metadata),
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
