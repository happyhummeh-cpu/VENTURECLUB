import React, { useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { GoogleSyncRecordItem } from '../types.ts';

interface SyncStatusProps {
  syncRecords: GoogleSyncRecordItem[];
  hasGoogleToken: boolean;
  configuredSpreadsheetId?: string | null;
  onSyncSheet: (
    sheetType: 'MEMBERS' | 'ATTENDANCE' | 'PROJECTS' | 'EVENTS',
    customTitle?: string,
    existingSpreadsheetId?: string
  ) => Promise<void>;
  onConnectGoogle: () => Promise<void>;
  onSaveDefaultSpreadsheetId?: (spreadsheetId: string) => Promise<void>;
  canManageSync: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  syncRecords,
  hasGoogleToken,
  configuredSpreadsheetId,
  onSyncSheet,
  onConnectGoogle,
  canManageSync,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncedDone, setSyncedDone] = useState(false);

  if (!canManageSync) return null;

  const attendanceRecord = syncRecords.find((r) => r.syncType === 'ATTENDANCE');

  const handleSync = async () => {
    setSyncing(true);
    setSyncedDone(false);
    try {
      if (!hasGoogleToken) {
        await onConnectGoogle();
      } else {
        await onSyncSheet(
          'ATTENDANCE',
          'TVC ERP — Attendance Register',
          attendanceRecord?.spreadsheetId || configuredSpreadsheetId || undefined
        );
        setSyncedDone(true);
        setTimeout(() => setSyncedDone(false), 3000);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
    >
      {syncing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
      ) : syncedDone ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
      )}
      {syncing ? 'Syncing...' : syncedDone ? 'Synced' : 'Sync'}
    </button>
  );
};
