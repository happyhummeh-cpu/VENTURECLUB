import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  LogOut,
  XCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AttendanceRecordItem, MemberDirectoryItem } from '../types.ts';

export interface AttendanceAnalyticsProps {
  attendanceRecords: AttendanceRecordItem[];
  members: MemberDirectoryItem[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

interface DailyDataPoint {
  date: string;
  label: string;
  shortLabel: string;
  present: number;
  late: number;
  exit: number;
  absent: number;
  totalTracked: number;
  attendanceRate: number; // (present + late) / total * 100
  punctualityRate: number; // present / total * 100
}

type TimeRange = '7d' | '14d' | '30d' | 'all';
type SessionFilter = 'ALL' | 'MEETING' | 'SHOOTING';
type ChartMode = 'percentage' | 'counts';

/**
 * Generates a smooth monotone-like cubic bezier SVG path through a list of {x, y} coordinates.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
    const cpy1 = p0.y;
    const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
    const cpy2 = p1.y;
    path += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}

function buildAreaPath(
  points: { x: number; y: number }[],
  baselineY: number
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${(p.x - 10).toFixed(1)} ${baselineY.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 10).toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }
  const linePath = buildSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

function formatDateLabel(dateStr: string): { label: string; shortLabel: string } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return { label: dateStr, shortLabel: dateStr };
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return {
    label: d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    shortLabel: d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  };
}

export const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({
  attendanceRecords,
  members,
  selectedDate,
  onSelectDate,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('ALL');
  const [chartMode, setChartMode] = useState<ChartMode>('percentage');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Series visibility toggles for 'counts' mode
  const [visibleSeries, setVisibleSeries] = useState<{
    present: boolean;
    late: boolean;
    exit: boolean;
    absent: boolean;
  }>({
    present: true,
    late: true,
    exit: true,
    absent: true,
  });

  const activeMemberCount = useMemo(() => {
    const active = members.filter((m) => m.isActive);
    return Math.max(active.length, 1);
  }, [members]);

  // Aggregate daily attendance data over time
  const dailySeries = useMemo<DailyDataPoint[]>(() => {
    const filteredRecords = attendanceRecords.filter((r) => {
      if (sessionFilter === 'ALL') return true;
      return (r.sessionType || 'MEETING') === sessionFilter;
    });

    // Group by date
    const byDate = new Map<string, Map<number, string>>();

    for (const rec of filteredRecords) {
      const dateStr =
        rec.attendanceDate ||
        (rec.markedAt ? rec.markedAt.slice(0, 10) : '2026-10-09');
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, new Map<number, string>());
      }
      const userMap = byDate.get(dateStr)!;
      // Latest status for the user on that date wins
      userMap.set(rec.userId, rec.status);
    }

    const sortedDates = Array.from(byDate.keys()).sort();

    const rangeLimit =
      timeRange === '7d'
        ? 7
        : timeRange === '14d'
        ? 14
        : timeRange === '30d'
        ? 30
        : sortedDates.length;

    const slicedDates = sortedDates.slice(-rangeLimit);

    return slicedDates.map((dateStr) => {
      const userMap = byDate.get(dateStr)!;
      let present = 0;
      let late = 0;
      let exit = 0;
      let absent = 0;

      userMap.forEach((status) => {
        if (status === 'PRESENT') present++;
        else if (status === 'LATE') late++;
        else if (status === 'EXIT') exit++;
        else if (status === 'ABSENT') absent++;
      });

      const recordedUsers = present + late + exit + absent;
      const denominator = Math.max(activeMemberCount, recordedUsers, 1);
      // Unrecorded active members on a tracked day count toward absent if roster was partially marked
      const effectiveAbsent =
        recordedUsers < activeMemberCount
          ? absent + (activeMemberCount - recordedUsers)
          : absent;

      const attendanceRate = Math.round(((present + late) / denominator) * 100);
      const punctualityRate = Math.round((present / denominator) * 100);
      const { label, shortLabel } = formatDateLabel(dateStr);

      return {
        date: dateStr,
        label,
        shortLabel,
        present,
        late,
        exit,
        absent: effectiveAbsent,
        totalTracked: denominator,
        attendanceRate,
        punctualityRate,
      };
    });
  }, [attendanceRecords, sessionFilter, timeRange, activeMemberCount]);

  // Summary KPIs
  const summaryStats = useMemo(() => {
    if (dailySeries.length === 0) {
      return {
        avgRate: 0,
        trendDelta: 0,
        peakDay: null as DailyDataPoint | null,
        avgPunctuality: 0,
        totalPresent: 0,
        totalLate: 0,
        totalExit: 0,
        totalAbsent: 0,
      };
    }

    const totalRate = dailySeries.reduce((acc, d) => acc + d.attendanceRate, 0);
    const avgRate = Math.round(totalRate / dailySeries.length);

    const totalPunctuality = dailySeries.reduce(
      (acc, d) => acc + d.punctualityRate,
      0
    );
    const avgPunctuality = Math.round(totalPunctuality / dailySeries.length);

    // Trend comparison: second half vs first half of period
    let trendDelta = 0;
    if (dailySeries.length >= 2) {
      const mid = Math.floor(dailySeries.length / 2);
      const firstHalf = dailySeries.slice(0, mid);
      const secondHalf = dailySeries.slice(mid);
      const firstAvg =
        firstHalf.reduce((a, b) => a + b.attendanceRate, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, b) => a + b.attendanceRate, 0) /
        secondHalf.length;
      trendDelta = Math.round(secondAvg - firstAvg);
    }

    const peakDay = dailySeries.reduce(
      (best, cur) => (cur.attendanceRate >= best.attendanceRate ? cur : best),
      dailySeries[0]
    );

    const totalPresent = dailySeries.reduce((acc, d) => acc + d.present, 0);
    const totalLate = dailySeries.reduce((acc, d) => acc + d.late, 0);
    const totalExit = dailySeries.reduce((acc, d) => acc + d.exit, 0);
    const totalAbsent = dailySeries.reduce((acc, d) => acc + d.absent, 0);

    return {
      avgRate,
      trendDelta,
      peakDay,
      avgPunctuality,
      totalPresent,
      totalLate,
      totalExit,
      totalAbsent,
    };
  }, [dailySeries]);

  // SVG Chart Geometry
  const svgWidth = 860;
  const svgHeight = 300;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  const maxYValue = useMemo(() => {
    if (chartMode === 'percentage') return 100;
    const maxCount = dailySeries.reduce(
      (max, d) =>
        Math.max(max, d.present, d.late, d.exit, d.absent, activeMemberCount),
      activeMemberCount
    );
    return Math.max(Math.ceil(maxCount / 2) * 2, 4);
  }, [chartMode, dailySeries, activeMemberCount]);

  const getX = (index: number): number => {
    if (dailySeries.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (dailySeries.length - 1)) * plotWidth;
  };

  const getY = (val: number): number => {
    const clamped = Math.max(0, Math.min(val, maxYValue));
    return padTop + plotHeight - (clamped / maxYValue) * plotHeight;
  };

  // Precompute coordinate arrays
  const chartLines = useMemo(() => {
    const attendanceRatePts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.attendanceRate),
    }));
    const punctualityRatePts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.punctualityRate),
    }));
    const presentPts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.present),
    }));
    const latePts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.late),
    }));
    const exitPts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.exit),
    }));
    const absentPts = dailySeries.map((d, i) => ({
      x: getX(i),
      y: getY(d.absent),
    }));

    return {
      attendanceRatePts,
      punctualityRatePts,
      presentPts,
      latePts,
      exitPts,
      absentPts,
    };
  }, [dailySeries, maxYValue]);

  const activePointIndex =
    hoveredIndex !== null && hoveredIndex < dailySeries.length
      ? hoveredIndex
      : dailySeries.length > 0
      ? dailySeries.length - 1
      : null;

  const activePoint =
    activePointIndex !== null ? dailySeries[activePointIndex] : null;

  const yTicks = useMemo(() => {
    if (chartMode === 'percentage') {
      return [0, 25, 50, 75, 100];
    }
    const step = Math.max(1, Math.round(maxYValue / 4));
    return [0, step, step * 2, step * 3, maxYValue];
  }, [chartMode, maxYValue]);

  const handleDownloadAnalyticsCsv = () => {
    const headers = [
      'Date',
      'Formatted Date',
      'Session Filter',
      'Present Count',
      'Late Count',
      'Exit Count',
      'Absent Count',
      'Total Active Roster',
      'Turnout Rate (%)',
      'On-Time Punctuality (%)',
    ];

    const rows = dailySeries.map((d) => [
      d.date,
      d.label,
      sessionFilter === 'ALL'
        ? 'All Sessions'
        : sessionFilter === 'SHOOTING'
        ? 'Shooting Attendance'
        : 'Shooting & Club Meetings',
      d.present,
      d.late,
      d.exit,
      d.absent,
      d.totalTracked,
      `${d.attendanceRate}%`,
      `${d.punctualityRate}%`,
    ]);

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
    link.setAttribute(
      'download',
      `tvc_attendance_analytics_${sessionFilter.toLowerCase()}_${timeRange}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-2xs">
      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-700" />
            </div>
            <h2 className="text-base font-bold text-zinc-950 font-sans">
              Attendance Analytics
            </h2>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md font-semibold">
              Time-Series Trend
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Visualizing daily attendance rates, punctuality, and status distribution across{' '}
            <strong>Shooting & Club Meetings</strong>.
          </p>
        </div>

        {/* FILTER CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            <button
              type="button"
              onClick={() => setChartMode('percentage')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartMode === 'percentage'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Turnout %
            </button>
            <button
              type="button"
              onClick={() => setChartMode('counts')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartMode === 'counts'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Member Counts
            </button>
          </div>

          {/* Session Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'MEETING', label: 'Meetings' },
                { id: 'SHOOTING', label: 'Shooting' },
              ] as { id: SessionFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSessionFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  sessionFilter === tab.id
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Time Window Filter */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg font-mono">
            {(
              [
                { id: '7d', label: '7D' },
                { id: '14d', label: '14D' },
                { id: '30d', label: '30D' },
                { id: 'all', label: 'ALL' },
              ] as { id: TimeRange; label: string }[]
            ).map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => setTimeRange(range.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  timeRange === range.id
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadAnalyticsCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-zinc-200 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer shadow-2xs"
            title="Download current analytics view as CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" />
            <span>Download Attendance Report</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Average Turnout Rate</span>
            {summaryStats.trendDelta >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold text-emerald-700">
                <TrendingUp className="w-3 h-3" />
                +{summaryStats.trendDelta}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold text-amber-700">
                <TrendingDown className="w-3 h-3" />
                {summaryStats.trendDelta}%
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tabular-nums">
            {summaryStats.avgRate}%
          </div>
          <div className="text-[11px] text-zinc-400">
            Across {dailySeries.length} recorded day{dailySeries.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>On-Time Punctuality</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {summaryStats.avgPunctuality}%
          </div>
          <div className="text-[11px] text-zinc-400">
            {summaryStats.totalPresent} Present · {summaryStats.totalLate} Late entries
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Peak Attendance Day</span>
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tabular-nums">
            {summaryStats.peakDay ? `${summaryStats.peakDay.attendanceRate}%` : '—'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {summaryStats.peakDay ? summaryStats.peakDay.label : 'No sessions recorded'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Early Exit & Absent</span>
            <Users className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-950 tabular-nums">
            {summaryStats.totalExit} <span className="text-xs font-normal text-zinc-400">Exit</span> ·{' '}
            {summaryStats.totalAbsent} <span className="text-xs font-normal text-zinc-400">Abs</span>
          </div>
          <div className="text-[11px] text-zinc-400">
            Cumulative over selected period
          </div>
        </div>
      </div>

      {/* MAIN INTERACTIVE LINE CHART CONTAINER */}
      {dailySeries.length === 0 ? (
        <div className="py-12 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 space-y-2">
          <Activity className="w-6 h-6 text-zinc-400 mx-auto" />
          <div className="text-sm font-bold text-zinc-900">
            No Attendance Data for Selected Filter
          </div>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Mark daily attendance in the roll-call list below to populate time-series analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Interactive Legend & Active Point Inspector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            {chartMode === 'percentage' ? (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-emerald-600 rounded-full inline-block ring-2 ring-emerald-600/30" />
                  <span className="font-semibold text-zinc-800">
                    Total Turnout % (Present + Late)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-amber-500 rounded-full inline-block" />
                  <span className="font-medium text-zinc-600">
                    On-Time Present %
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 border-b border-dashed border-zinc-400 inline-block" />
                  <span className="text-zinc-400 font-mono text-[11px]">
                    75% Club Target
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleSeries((s) => ({ ...s, present: !s.present }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
                    visibleSeries.present
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Present</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleSeries((s) => ({ ...s, late: !s.late }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
                    visibleSeries.late
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Late</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleSeries((s) => ({ ...s, exit: !s.exit }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
                    visibleSeries.exit
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Exit</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleSeries((s) => ({ ...s, absent: !s.absent }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
                    visibleSeries.absent
                      ? 'bg-zinc-200/80 border-zinc-300 text-zinc-800'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span>Absent</span>
                </button>
              </div>
            )}

            {/* Active / Hovered Day Readout Pill */}
            {activePoint && (
              <div className="flex items-center gap-3 text-xs font-mono bg-zinc-950 text-white px-3.5 py-1.5 rounded-lg">
                <span className="text-zinc-400">{activePoint.shortLabel}:</span>
                <span className="text-emerald-400 font-bold">
                  {activePoint.attendanceRate}% Turnout
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-emerald-300">{activePoint.present}P</span>
                <span className="text-amber-300">{activePoint.late}L</span>
                <span className="text-blue-300">{activePoint.exit}E</span>
                <span className="text-zinc-400">{activePoint.absent}A</span>
              </div>
            )}
          </div>

          {/* SVG Line Chart */}
          <div className="relative w-full bg-zinc-50/50 border border-zinc-200/70 rounded-xl p-3 overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-64 sm:h-72 overflow-visible select-none"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient
                  id="turnoutAreaGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.24" />
                  <stop offset="85%" stopColor="#059669" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient
                  id="punctualityAreaGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#e4e4e7"
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] fill-zinc-400 font-mono"
                    >
                      {chartMode === 'percentage' ? `${tick}%` : tick}
                    </text>
                  </g>
                );
              })}

              {/* 75% Benchmark Threshold Line in Percentage Mode */}
              {chartMode === 'percentage' && (
                <g>
                  <line
                    x1={padLeft}
                    y1={getY(75)}
                    x2={svgWidth - padRight}
                    y2={getY(75)}
                    stroke="#10b981"
                    strokeDasharray="6 4"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                  />
                </g>
              )}

              {/* Hover Vertical Crosshair Line */}
              {activePointIndex !== null && (
                <line
                  x1={getX(activePointIndex)}
                  y1={padTop}
                  x2={getX(activePointIndex)}
                  y2={baselineY}
                  stroke="#18181b"
                  strokeOpacity="0.2"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* MODE 1: PERCENTAGE LINES */}
              {chartMode === 'percentage' && (
                <g>
                  {/* Area under Turnout % */}
                  <path
                    d={buildAreaPath(chartLines.attendanceRatePts, baselineY)}
                    fill="url(#turnoutAreaGrad)"
                  />
                  {/* Area under Punctuality % */}
                  <path
                    d={buildAreaPath(chartLines.punctualityRatePts, baselineY)}
                    fill="url(#punctualityAreaGrad)"
                  />

                  {/* On-Time Punctuality Line */}
                  <path
                    d={buildSmoothPath(chartLines.punctualityRatePts)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Total Turnout % Line */}
                  <path
                    d={buildSmoothPath(chartLines.attendanceRatePts)}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Data Nodes */}
                  {dailySeries.map((d, i) => {
                    const cx = getX(i);
                    const cyTurnout = getY(d.attendanceRate);
                    const cyPunctual = getY(d.punctualityRate);
                    const isSelected = selectedDate === d.date;
                    const isHovered = activePointIndex === i;

                    return (
                      <g key={d.date}>
                        <circle
                          cx={cx}
                          cy={cyPunctual}
                          r={isHovered ? 4.5 : 3}
                          fill="#ffffff"
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                        <circle
                          cx={cx}
                          cy={cyTurnout}
                          r={isHovered || isSelected ? 6 : 4}
                          fill={isSelected ? '#059669' : '#ffffff'}
                          stroke="#059669"
                          strokeWidth={isHovered || isSelected ? '3' : '2.5'}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* MODE 2: MEMBER HEADCOUNT LINES */}
              {chartMode === 'counts' && (
                <g>
                  {visibleSeries.present && (
                    <>
                      <path
                        d={buildAreaPath(chartLines.presentPts, baselineY)}
                        fill="url(#turnoutAreaGrad)"
                      />
                      <path
                        d={buildSmoothPath(chartLines.presentPts)}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {visibleSeries.late && (
                    <path
                      d={buildSmoothPath(chartLines.latePts)}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                    />
                  )}
                  {visibleSeries.exit && (
                    <path
                      d={buildSmoothPath(chartLines.exitPts)}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                    />
                  )}
                  {visibleSeries.absent && (
                    <path
                      d={buildSmoothPath(chartLines.absentPts)}
                      fill="none"
                      stroke="#71717a"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Data Nodes for Visible Count Series */}
                  {dailySeries.map((d, i) => {
                    const cx = getX(i);
                    const isHovered = activePointIndex === i;
                    return (
                      <g key={d.date}>
                        {visibleSeries.absent && (
                          <circle
                            cx={cx}
                            cy={getY(d.absent)}
                            r={isHovered ? 4.5 : 3}
                            fill="#ffffff"
                            stroke="#71717a"
                            strokeWidth="2"
                          />
                        )}
                        {visibleSeries.exit && (
                          <circle
                            cx={cx}
                            cy={getY(d.exit)}
                            r={isHovered ? 4.5 : 3}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth="2"
                          />
                        )}
                        {visibleSeries.late && (
                          <circle
                            cx={cx}
                            cy={getY(d.late)}
                            r={isHovered ? 4.5 : 3}
                            fill="#ffffff"
                            stroke="#d97706"
                            strokeWidth="2"
                          />
                        )}
                        {visibleSeries.present && (
                          <circle
                            cx={cx}
                            cy={getY(d.present)}
                            r={isHovered ? 5.5 : 3.5}
                            fill="#ffffff"
                            stroke="#059669"
                            strokeWidth="2.5"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* X-Axis Date Labels & Interactive Hit Columns */}
              {dailySeries.map((d, i) => {
                const cx = getX(i);
                const isSelected = selectedDate === d.date;
                const isHovered = activePointIndex === i;
                // Avoid crowding X-axis labels when > 12 points
                const showLabel =
                  dailySeries.length <= 10 ||
                  i === 0 ||
                  i === dailySeries.length - 1 ||
                  i % Math.ceil(dailySeries.length / 8) === 0 ||
                  isHovered;

                const colWidth =
                  dailySeries.length > 1
                    ? plotWidth / (dailySeries.length - 1)
                    : plotWidth;

                return (
                  <g key={`axis-${d.date}`}>
                    {showLabel && (
                      <text
                        x={cx}
                        y={baselineY + 22}
                        textAnchor="middle"
                        className={`text-[11px] font-mono transition-colors ${
                          isHovered || isSelected
                            ? 'fill-zinc-950 font-bold'
                            : 'fill-zinc-400'
                        }`}
                      >
                        {d.shortLabel}
                      </text>
                    )}

                    {/* Invisible interactive column for smooth hover & click-to-inspect date */}
                    <rect
                      x={cx - colWidth / 2}
                      y={padTop}
                      width={colWidth}
                      height={plotHeight + padBottom}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onClick={() => {
                        if (onSelectDate) {
                          onSelectDate(d.date);
                        }
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Footer Hint */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-200/60 px-2">
              <span>
                Hover over any point to inspect daily breakdown
                {onSelectDate ? ' · Click a point to load that date in Roll-Call' : ''}
              </span>
              <span className="font-mono">
                Active Roster: {activeMemberCount} Members
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
