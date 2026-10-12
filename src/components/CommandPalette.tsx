import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Users,
  FolderKanban,
  Calendar,
  CheckSquare,
  ArrowRight,
  X,
  QrCode,
  Shield,
  ShieldCheck,
  LifeBuoy,
} from 'lucide-react';
import type {
  MemberDirectoryItem,
  VentureProject,
  ClubEvent,
  ProjectTask,
} from '../types.ts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberDirectoryItem[];
  projects: VentureProject[];
  events: ClubEvent[];
  tasks: ProjectTask[];
  onNavigateErpSection: (section: string) => void;
  onSelectMember: (member: MemberDirectoryItem) => void;
  onSelectProject: (projectId: number) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  members,
  projects,
  events,
  tasks,
  onNavigateErpSection,
  onSelectMember,
  onSelectProject,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const normalized = query.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!normalized) return members.slice(0, 3);
    return members
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(normalized) ||
          m.email.toLowerCase().includes(normalized) ||
          m.rollNumber?.toLowerCase().includes(normalized) ||
          m.clubPosition?.toLowerCase().includes(normalized)
      )
      .slice(0, 4);
  }, [members, normalized]);

  const filteredProjects = useMemo(() => {
    if (!normalized) return projects.slice(0, 3);
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(normalized) ||
          p.description.toLowerCase().includes(normalized) ||
          p.leadName.toLowerCase().includes(normalized)
      )
      .slice(0, 4);
  }, [projects, normalized]);

  const filteredEvents = useMemo(() => {
    if (!normalized) return events.slice(0, 2);
    return events
      .filter(
        (e) =>
          e.name.toLowerCase().includes(normalized) ||
          e.venue.toLowerCase().includes(normalized) ||
          e.type.toLowerCase().includes(normalized)
      )
      .slice(0, 3);
  }, [events, normalized]);

  const filteredTasks = useMemo(() => {
    if (!normalized) return tasks.slice(0, 3);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(normalized) ||
          (t.assigneeName || '').toLowerCase().includes(normalized)
      )
      .slice(0, 4);
  }, [tasks, normalized]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/60 backdrop-blur-xs pt-16 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Search"
    >
      <div
        className="w-full max-w-2xl bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-200 gap-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, venture pods, events, tasks, or jump to module..."
            className="w-full text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <span className="text-[11px] font-mono text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5 shrink-0">
            ESC
          </span>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md"
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto divide-y divide-zinc-100 p-2">
          {/* Quick Navigation */}
          <div className="py-2 px-2">
            <div className="text-[11px] font-medium text-zinc-400 px-2 pb-1.5">
              Quick Actions
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => {
                  onNavigateErpSection('attendance');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors text-left"
              >
                <QrCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Mark Attendance</span>
              </button>
              <button
                onClick={() => {
                  onNavigateErpSection('projects');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors text-left"
              >
                <FolderKanban className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Project Kanban</span>
              </button>
              <button
                onClick={() => {
                  onNavigateErpSection('help-requests');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors text-left"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Startup Help Desk</span>
              </button>
              <button
                onClick={() => {
                  onNavigateErpSection('admin');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors text-left"
              >
                <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">Admin & Sheets Sync</span>
              </button>
              <button
                onClick={() => {
                  onNavigateErpSection('audit-log');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors text-left"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">System Audit Trail</span>
              </button>
            </div>
          </div>

          {/* Members */}
          {filteredMembers.length > 0 && (
            <div className="py-2 px-2">
              <div className="text-[11px] font-medium text-zinc-400 px-2 pb-1">
                Members ({filteredMembers.length})
              </div>
              <div className="space-y-0.5">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      onNavigateErpSection('members');
                      onSelectMember(member);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg hover:bg-zinc-100 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-900 truncate">
                        {member.fullName}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs text-zinc-500 truncate">
                        {member.clubPosition}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-zinc-500">
                        {member.rollNumber}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-700" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Venture Projects */}
          {filteredProjects.length > 0 && (
            <div className="py-2 px-2">
              <div className="text-[11px] font-medium text-zinc-400 px-2 pb-1">
                Venture Pods ({filteredProjects.length})
              </div>
              <div className="space-y-0.5">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onNavigateErpSection('projects');
                      onSelectProject(project.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg hover:bg-zinc-100 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderKanban className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-900 truncate">
                        {project.name}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs text-zinc-500 truncate">
                        Lead: {project.leadName}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-zinc-600 tabular-nums shrink-0">
                      {project.progress}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {filteredEvents.length > 0 && (
            <div className="py-2 px-2">
              <div className="text-[11px] font-medium text-zinc-400 px-2 pb-1">
                Events ({filteredEvents.length})
              </div>
              <div className="space-y-0.5">
                {filteredEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      onNavigateErpSection('events');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-900 truncate">
                        {ev.name}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs text-zinc-500 truncate">
                        {ev.venue}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
                      {ev.date}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {filteredTasks.length > 0 && (
            <div className="py-2 px-2">
              <div className="text-[11px] font-medium text-zinc-400 px-2 pb-1">
                Tasks ({filteredTasks.length})
              </div>
              <div className="space-y-0.5">
                {filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      onNavigateErpSection('projects');
                      onSelectProject(task.projectId);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-900 truncate">
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      {task.status} · {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredMembers.length === 0 &&
            filteredProjects.length === 0 &&
            filteredEvents.length === 0 &&
            filteredTasks.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-zinc-800">
                  No matching records for "{query}"
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Try searching by member name, roll number (VC-2023-001), project title, or event venue.
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
