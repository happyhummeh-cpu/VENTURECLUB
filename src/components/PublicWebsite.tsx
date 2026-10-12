import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Calendar,
  MapPin,
  CheckCircle2,
  X,
  Lock,
  Sparkles,
  ChevronRight,
  LogIn,
  Menu,
  Clock,
  Layers,
  Camera,
  Users,
} from 'lucide-react';
import { TvcLogo } from './TvcLogo.tsx';
import {
  ROLE_LABELS,
  FIRST_PAGE_CORE_ROLES,
  ROLE_SEQUENCE_NUMBER,
  type UserRole,
  type ClubEvent,
  type VentureProject,
  type GalleryItem,
} from '../types.ts';

const heroVentureHubImg = '/images/hero_venture_hub_1791471940134.jpg';
const eventPitchSummitImg = '/images/event_pitch_summit_1791471952972.jpg';
const eventHackathonBuildImg = '/images/event_hackathon_build_1791471966777.jpg';
const galleryDemoShowcaseImg = '/images/gallery_demo_showcase_1791471990740.jpg';
const galleryFounderRoundtableImg = '/images/gallery_founder_roundtable_1791471978738.jpg';

interface PublicTeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  clubPosition: string;
  branch: string;
  year: number;
  skills: string;
  bio: string | null;
  status: string;
  linkedinUrl: string | null;
  githubUrl: string | null;
}

interface PublicWebsiteProps {
  events: ClubEvent[];
  projects: VentureProject[];
  gallery: GalleryItem[];
  team: PublicTeamMember[];
  loading: boolean;
  onEnterErp: () => void;
  onRefreshPublic: () => void;
  onOpenAuthModal?: () => void;
}

const HELP_CATEGORIES = [
  'Idea Validation',
  'Product',
  'Technology',
  'Marketing',
  'Business Model',
  'Funding',
  'Pitch Deck',
  'Team',
  'Mentorship',
  'Other',
];

const PLACEHOLDER_EVENTS = [
  {
    id: 'ev-placeholder-1',
    category: 'Club Orientation',
    title: 'Inaugural Club Orientation & Vision Assembly',
    description:
      'Upcoming orientation session introducing The Venture Club vision, student leadership structure, and upcoming cohort initiatives. Official schedule and registration details coming soon.',
    image: eventPitchSummitImg,
  },
  {
    id: 'ev-placeholder-2',
    category: 'Technical Workshop',
    title: 'Founder & Engineering Workshop Series',
    description:
      'Hands-on product engineering, rapid prototyping, and startup building sessions for student innovators. Session dates, venue, and agenda coming soon.',
    image: eventHackathonBuildImg,
  },
  {
    id: 'ev-placeholder-3',
    category: 'Pitch Roundtable',
    title: 'Ideation & Venture Pitch Forum',
    description:
      'Collaborative startup ideation and problem-solving forum for campus builders. Official announcement and participation details coming soon.',
    image: galleryFounderRoundtableImg,
  },
];

const UPCOMING_PROJECT_TRACKS = [
  {
    id: 'track-01',
    code: 'TRACK 01',
    title: 'AI & Software Systems Pods',
    summary:
      'Student engineering squads building applied AI workflows, developer tools, and full-stack platforms. Official project roster coming soon.',
  },
  {
    id: 'track-02',
    code: 'TRACK 02',
    title: 'Hardware & Deep-Tech Prototyping',
    summary:
      'Embedded systems, robotics automation, and IoT instrumentation prototypes developed inside the club lab. Project details coming soon.',
  },
  {
    id: 'track-03',
    code: 'TRACK 03',
    title: 'Campus & FinTech Ventures',
    summary:
      'Zero-to-one student startup initiatives solving real campus and enterprise operational bottlenecks. First cohort projects coming soon.',
  },
];

const TEAM_FRAME_SLOTS = [
  {
    id: 'frame-1',
    roleTitle: 'President & Executive Lead',
    caption: 'Executive Leadership Frame · Official Portrait Coming Soon',
    image: heroVentureHubImg,
    spanClass: 'md:col-span-2 md:row-span-2 aspect-16/10 md:aspect-auto',
  },
  {
    id: 'frame-2',
    roleTitle: 'Vice President & Secretary',
    caption: 'Core Governance Frame · Coming Soon',
    image: eventPitchSummitImg,
    spanClass: 'aspect-4/3',
  },
  {
    id: 'frame-3',
    roleTitle: 'Project Lead & Technical Heads',
    caption: 'Engineering Leadership Frame · Coming Soon',
    image: eventHackathonBuildImg,
    spanClass: 'aspect-4/3',
  },
  {
    id: 'frame-4',
    roleTitle: 'Attendance Head & Operations',
    caption: 'Operations & Coordination Frame · Coming Soon',
    image: galleryDemoShowcaseImg,
    spanClass: 'aspect-4/3',
  },
  {
    id: 'frame-5',
    roleTitle: 'Media Head & Core Members',
    caption: 'Creative & Cohort Frame · Coming Soon',
    image: galleryFounderRoundtableImg,
    spanClass: 'aspect-4/3',
  },
];

const DEFAULT_FALLBACK_TEAM = [
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

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  gallery,
  team,
  loading,
  onEnterErp,
  onRefreshPublic,
  onOpenAuthModal,
}) => {
  const activeTeam = team && team.length > 0 ? team : DEFAULT_FALLBACK_TEAM;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<{
    title: string;
    category: string;
    caption: string;
    mediaUrl: string;
  } | null>(null);

  // Startup Help Form State
  const [founderName, setFounderName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [startupName, setStartupName] = useState('');
  const [category, setCategory] = useState('Product');
  const [problemDescription, setProblemDescription] = useState('');
  const [websiteOrLinkedin, setWebsiteOrLinkedin] = useState('');
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleHelpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingHelp(true);
    setHelpFeedback(null);
    try {
      const res = await fetch('/api/public/help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderName,
          email,
          phone,
          startupName,
          category,
          problemDescription,
          websiteOrLinkedin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit request.');
      }
      setHelpFeedback({
        type: 'success',
        text:
          data.message ||
          'Request logged in PostgreSQL and queued for Google Sheets synchronization.',
      });
      setFounderName('');
      setEmail('');
      setPhone('');
      setStartupName('');
      setProblemDescription('');
      setWebsiteOrLinkedin('');
      onRefreshPublic();
    } catch (err: any) {
      setHelpFeedback({
        type: 'error',
        text: err.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmittingHelp(false);
    }
  };

  const safeParseList = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const resolveMediaUrl = (url: string): string => {
    if (!url) return heroVentureHubImg;
    if (url.startsWith('/src/assets/images/')) {
      return url.replace('/src/assets/images/', '/images/');
    }
    return url;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950 selection:bg-zinc-900 selection:text-white overflow-x-hidden">
      {/* Sticky Top Bar with Full Mobile & Desktop Optimization */}
      <header className="sticky top-0 z-40 h-16 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-zinc-200/90 px-4 sm:px-6 lg:px-12 flex items-center justify-between">
        {/* Zone 1: Brand wordmark with TVC Logo */}
        <a
          href="#top"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setMobileMenuOpen(false)}
        >
          <TvcLogo size="sm" showText={true} />
        </a>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600">
          {[
            { href: '#about', label: 'About' },
            { href: '#projects', label: 'Projects' },
            { href: '#events', label: 'Events' },
            { href: '#team', label: 'Team' },
            { href: '#gallery', label: 'Gallery' },
          ].map((navItem) => (
            <a
              key={navItem.href}
              href={navItem.href}
              className="hover:text-zinc-950 transition-colors whitespace-nowrap relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-zinc-950 hover:after:w-full after:transition-all after:duration-300"
            >
              {navItem.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Actions + Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenAuthModal || onEnterErp}
            className="tvc-btn-press inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden sm:inline">Sign In</span>
          </button>

          <button
            type="button"
            onClick={onEnterErp}
            className="tvc-btn-press inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Launch ERP</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 overflow-hidden shadow-lg tvc-fade-up">
          <div className="px-4 py-4 space-y-1.5">
            {[
              { href: '#about', label: 'About The Club' },
              { href: '#projects', label: 'Projects (Coming Soon)' },
              { href: '#events', label: 'Events (Coming Soon)' },
              { href: '#team', label: 'Leadership & Team' },
              { href: '#gallery', label: 'Team Gallery & Frames' },
              { href: '#startup-help', label: 'Get Startup Help' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-800 hover:bg-zinc-100 transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </a>
            ))}
            <div className="pt-2 border-t border-zinc-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenAuthModal) onOpenAuthModal();
                  else onEnterErp();
                }}
                className="w-full py-2.5 px-3 text-xs font-semibold text-zinc-900 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Member Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterErp();
                }}
                className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Open ERP Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section
        id="top"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-28"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="tvc-fade-up inline-flex items-center gap-2.5 px-3 py-1 bg-white border border-zinc-200 rounded-full shadow-2xs">
              <TvcLogo size="xs" />
              <span className="text-[11px] sm:text-xs font-medium text-zinc-700">
                The Venture Club · Ideate · Innovate · Impact
              </span>
            </div>

            <h1
              className="tvc-fade-up tvc-delay-1 text-4xl sm:text-6xl lg:text-7xl font-editorial tracking-tight text-zinc-950 leading-[1.05]"
              style={{ textWrap: 'balance' }}
            >
              Where student engineers and operators build venture-scale ideas.
            </h1>

            <p className="tvc-fade-up tvc-delay-2 text-sm sm:text-lg text-zinc-600 max-w-2xl leading-relaxed">
              The Venture Club is a student-led product incubator, technical innovation collective, and founder network dedicated to turning ambitious engineering theses into impactful ventures.
            </p>

            <div className="tvc-fade-up tvc-delay-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <a
                href="#team"
                className="tvc-btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors whitespace-nowrap shadow-sm"
              >
                <span>Meet The Leadership</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#startup-help"
                className="tvc-btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-zinc-900 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-100 transition-colors whitespace-nowrap"
              >
                <span>Get Startup Help</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Institutional Status Block */}
          <div className="tvc-fade-up tvc-delay-2 lg:col-span-5 border-t lg:border-t-0 lg:border-l border-zinc-200 pt-8 lg:pt-0 lg:pl-10">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="tvc-card-hover p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-editorial text-zinc-950 tabular-nums">
                  9 Roles
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Structured executive & departmental club hierarchy
                </p>
              </div>
              <div className="tvc-card-hover p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-editorial text-zinc-950 tabular-nums">
                  2026 Cohort
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Student engineers, designers, and operators
                </p>
              </div>
              <div className="tvc-card-hover p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-mono font-bold text-amber-700">
                  Coming Soon
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Inaugural Venture Pods & project portfolio
                </p>
              </div>
              <div className="tvc-card-hover p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-mono font-bold text-blue-700">
                  Coming Soon
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Upcoming campus events, sprints & roundtables
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Visual Frame */}
        <div className="tvc-scale-in tvc-delay-3 mt-10 sm:mt-14 relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-16/10 sm:aspect-16/9 shadow-lg group">
          <img
            src={heroVentureHubImg}
            alt="The Venture Club incubator studio and collaborative workspace"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-5 sm:p-10">
            <div className="max-w-xl text-white">
              <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-mono text-zinc-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>The Venture Club · Student Innovation Collective</span>
              </div>
              <p className="text-base sm:text-xl font-editorial leading-snug">
                Collaborative engineering, startup ideation, and leadership sessions inside The Venture Club.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT & WHAT WE DO */}
      <section
        id="about"
        className="border-t border-zinc-200 bg-white py-16 sm:py-20 lg:py-28"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="tvc-fade-up max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Operating Architecture · What We Do
            </div>
            <h2
              className="text-3xl sm:text-5xl font-editorial text-zinc-950 mt-2"
              style={{ textWrap: 'balance' }}
            >
              An engineering-first environment built for shipping real ideas and cultivating student founders.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-10 sm:mt-14">
            {[
              {
                num: '01',
                title: 'Venture Pod Incubation',
                desc: 'Cross-functional student squads pair project leads with engineering, design, and operations members to take concepts from ideation to working prototypes.',
                meta: 'Structured Milestones · Peer Technical Reviews',
              },
              {
                num: '02',
                title: 'Technical & Product Workshops',
                desc: 'Focused sessions covering AI engineering, full-stack architecture, embedded systems, and startup fundamentals led by club leads and guest mentors.',
                meta: 'Hands-On Learning · Collaborative Build Culture',
              },
              {
                num: '03',
                title: 'Founder Network & Advisory',
                desc: 'Connecting student builders with domain mentors, pitch feedback roundtables, and structured problem-solving clinics across campus.',
                meta: 'Direct Mentorship · Founder Clinic Pipeline',
              },
            ].map((item, idx) => (
              <div
                key={item.num}
                className={`tvc-card-hover tvc-fade-up tvc-delay-${idx + 1} p-6 rounded-2xl bg-[#FAFAFA] border border-zinc-200/90 hover:border-zinc-400 flex flex-col justify-between shadow-2xs`}
              >
                <div>
                  <div className="text-xs font-mono font-bold text-zinc-400">
                    {item.num}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-950 mt-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-200/70 text-xs font-mono text-zinc-500">
                  {item.meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS SECTION — COMING SOON */}
      <section
        id="projects"
        className="border-t border-zinc-200 py-16 sm:py-20 lg:py-28 bg-[#FAFAFA]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="tvc-fade-up flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500">
                <Layers className="w-3.5 h-3.5 text-zinc-700" />
                <span>Venture Pods & Student Builds</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-editorial text-zinc-950 mt-2">
                Projects Coming Soon
              </h2>
              <p className="text-sm text-zinc-600 mt-2 max-w-2xl">
                Our inaugural student venture pods and technical build tracks are currently in preparation. Official project showcases will be published here once unveiled.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-950 text-white text-xs font-mono font-semibold self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Coming Soon</span>
            </span>
          </div>

          {/* Main Coming Soon Feature Banner */}
          <div className="tvc-card-hover tvc-fade-up tvc-delay-1 mt-10 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 shadow-2xs relative overflow-hidden">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>INAUGURAL COHORT PORTFOLIO · COMING SOON</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-editorial text-zinc-950">
                New student projects and venture pods are being incubated.
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                No projects have been published yet. As our engineering and startup teams finalize their prototypes, verified repositories, technical documentation, and live demos will be showcased in this section.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#startup-help"
                  className="tvc-btn-press inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <span>Submit a Project Idea or Problem Brief</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* 3 Clean Upcoming Project Track Placeholders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {UPCOMING_PROJECT_TRACKS.map((track, idx) => (
              <article
                key={track.id}
                className={`tvc-card-hover tvc-fade-up tvc-delay-${idx + 1} bg-white border border-dashed border-zinc-300 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-500 shadow-2xs`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-zinc-500">
                      {track.code}
                    </span>
                    <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                      Coming Soon
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-950 mt-4">
                    {track.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed">
                    {track.summary}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-mono text-zinc-500">
                  <span>Status</span>
                  <span className="text-zinc-900 font-semibold">Coming Soon</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS SECTION — EVENTS COMING SOON */}
      <section
        id="events"
        className="border-t border-zinc-200 bg-white py-16 sm:py-20 lg:py-28"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="tvc-fade-up flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500">
                <Calendar className="w-3.5 h-3.5 text-zinc-700" />
                <span>Summits, Build Sprints & Roundtables</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-editorial text-zinc-950 mt-2">
                Events Coming Soon
              </h2>
              <p className="text-sm text-zinc-600 mt-2 max-w-2xl">
                Official dates, venues, speakers, and registration links for upcoming Venture Club sessions will be announced soon.
              </p>
            </div>
            <button
              type="button"
              onClick={onEnterErp}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-900 hover:underline self-start sm:self-auto cursor-pointer"
            >
              <span>Have an attendance code? Enter in ERP</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-10 sm:mt-12">
            {PLACEHOLDER_EVENTS.map((ev, idx) => (
              <div
                key={ev.id}
                className={`tvc-card-hover tvc-fade-up tvc-delay-${idx + 1} group border border-zinc-200 rounded-2xl overflow-hidden bg-[#FAFAFA] hover:border-zinc-400 flex flex-col shadow-2xs`}
              >
                <div className="aspect-16/10 bg-zinc-900 relative overflow-hidden">
                  <img
                    src={ev.image}
                    alt={ev.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-xs text-[11px] font-mono text-zinc-200 border border-white/15">
                      {ev.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-mono font-bold uppercase tracking-wider shadow-xs">
                      Coming Soon
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-md">
                      <Clock className="w-3 h-3" />
                      <span>Coming Soon</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-zinc-950 mt-3 leading-snug">
                      {ev.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-200/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Schedule TBA</span>
                    </span>
                    <span className="font-semibold text-zinc-900">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM DIRECTORY — ORDERED 1-9, NO GREEN "POSITION FILLED" BADGE */}
      <section
        id="team"
        className="border-t border-zinc-200 py-16 sm:py-20 lg:py-28 bg-[#FAFAFA]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="tvc-fade-up max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500">
              <Users className="w-3.5 h-3.5 text-zinc-700" />
              <span>Leadership & Venture Fellows</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-editorial text-zinc-950 mt-2">
              Operators running the collective
            </h2>
            <p className="text-sm text-zinc-600 mt-2">
              Executive leadership and department heads are listed in official club sequence, followed by Venture Club members.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mt-10 sm:mt-12">
              {(() => {
                // Sequence: 1. President, 2. Vice President, 3. Secretary, 4. Super Admin, 5. Admin, 6. Project Lead, 7. Attendance Head, 8. Media Head, 9. Member
                const displayItems: Array<
                  | {
                      type: 'FILLED';
                      role: UserRole;
                      seq: number;
                      member: PublicTeamMember;
                    }
                  | {
                      type: 'VACANT';
                      role: UserRole;
                      seq: number;
                      label: string;
                    }
                > = [];

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
                  const holders = activeTeam.filter((m) => m.role === roleKey);
                  if (holders.length > 0) {
                    for (const h of holders) {
                      displayItems.push({
                        type: 'FILLED',
                        role: roleKey,
                        seq,
                        member: h,
                      });
                    }
                  } else if (FIRST_PAGE_CORE_ROLES.includes(roleKey)) {
                    displayItems.push({
                      type: 'VACANT',
                      role: roleKey,
                      seq,
                      label: ROLE_LABELS[roleKey] || roleKey,
                    });
                  }
                }

                // Always list Members last (#9)
                const memberHolders = activeTeam.filter(
                  (m) =>
                    m.role === 'MEMBER' ||
                    !leadershipOrder.includes(m.role as UserRole)
                );
                for (const m of memberHolders) {
                  displayItems.push({
                    type: 'FILLED',
                    role: 'MEMBER',
                    seq: 9,
                    member: m,
                  });
                }

                return displayItems.map((item) => {
                  if (item.type === 'VACANT') {
                    return (
                      <div
                        key={`vacant-${item.role}`}
                        className="tvc-card-hover bg-zinc-50/90 border border-dashed border-zinc-300 rounded-2xl p-6 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[11px] font-mono font-semibold text-zinc-500">
                              #{item.seq} · {item.label}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Vacant
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                              —
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-zinc-700 truncate">
                                Position Vacant
                              </h3>
                              <p className="text-xs text-zinc-500 truncate">
                                {item.label}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                            This {item.label} role is currently open for official assignment in the Admin Panel.
                          </p>
                        </div>
                        <div className="mt-5 pt-4 border-t border-zinc-200/70">
                          <div className="text-[11px] font-mono text-amber-700">
                            Status: Open Position
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const { member, role, seq } = item;
                  const skills = safeParseList(member.skills);
                  const roleLabel = ROLE_LABELS[role] || member.role;
                  const isExecutive = seq <= 8;

                  return (
                    <div
                      key={member.id}
                      className="tvc-card-hover bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-400 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded ${
                              role === 'PRESIDENT'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : isExecutive
                                ? 'bg-zinc-900 text-white'
                                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                            }`}
                          >
                            #{seq} · {roleLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                            {member.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-950 truncate">
                              {member.fullName}
                            </h3>
                            <p className="text-xs text-zinc-500 truncate">
                              {roleLabel}
                              {member.clubPosition &&
                              member.clubPosition.toLowerCase() !==
                                roleLabel.toLowerCase()
                                ? ` · ${member.clubPosition}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-zinc-500 mt-4">
                          {member.branch} · Year {member.year}
                        </div>

                        {member.bio && (
                          <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                            {member.bio}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-zinc-100">
                        <div className="text-[11px] text-zinc-500 truncate">
                          {skills.slice(0, 3).join(' · ')}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
        </div>
      </section>

      {/* GALLERY SECTION — LARGE 5-PHOTO TEAM MEMBER SHOWCASE FRAME & COMING SOON */}
      <section
        id="gallery"
        className="border-t border-zinc-200 bg-white py-16 sm:py-20 lg:py-28"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="tvc-fade-up flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500">
                <Camera className="w-3.5 h-3.5 text-zinc-700" />
                <span>Team Member Portraits & Visual Archive</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-editorial text-zinc-950 mt-2">
                Team Gallery & Photo Frame
              </h2>
              <p className="text-sm text-zinc-600 mt-2 max-w-2xl">
                Dedicated multi-frame showcase reserved for official Venture Club team member portraits and cohort moments. Official team photography coming soon.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 text-xs font-mono font-semibold self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Team Photos Coming Soon</span>
            </span>
          </div>

          {/* LARGE 5-PHOTO ARCHITECTURAL TEAM FRAME */}
          <div className="tvc-scale-in mt-10 p-4 sm:p-6 lg:p-8 rounded-3xl bg-zinc-950 text-white border border-zinc-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-5">
              <div>
                <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                  Featured 5-Panel Team Frame · Cohort 2026
                </div>
                <h3 className="text-xl sm:text-2xl font-editorial text-white mt-1">
                  Executive & Core Team Portrait Showcase
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-300 self-start sm:self-auto">
                Official Team Portraits Coming Soon
              </span>
            </div>

            {/* 5-Photo Bento Frame Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {TEAM_FRAME_SLOTS.map((slot, index) => (
                <div
                  key={slot.id}
                  onClick={() =>
                    setLightboxItem({
                      title: slot.roleTitle,
                      category: 'Team Portrait Frame',
                      caption: slot.caption,
                      mediaUrl: slot.image,
                    })
                  }
                  className={`group cursor-pointer relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-500 transition-all ${slot.spanClass}`}
                >
                  <img
                    src={slot.image}
                    alt={slot.roleTitle}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-95 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-black/65 backdrop-blur-xs border border-white/15 text-[10px] font-mono text-zinc-200">
                        FRAME 0{index + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400/95 text-zinc-950 text-[10px] font-mono font-bold uppercase">
                        Coming Soon
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold text-white">
                        {slot.roleTitle}
                      </h4>
                      <p className="text-[11px] text-zinc-300 mt-0.5">
                        {slot.caption}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Gallery Preview Cards if present */}
          {gallery.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
              {gallery.slice(0, 4).map((item) => {
                const resolvedImg = resolveMediaUrl(item.mediaUrl);
                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setLightboxItem({
                        title: item.title,
                        category: item.category,
                        caption: item.caption,
                        mediaUrl: resolvedImg,
                      })
                    }
                    className="tvc-card-hover group cursor-pointer border border-zinc-200 rounded-2xl overflow-hidden bg-[#FAFAFA] hover:border-zinc-400 shadow-2xs"
                  >
                    <div className="aspect-4/3 bg-zinc-900 overflow-hidden relative">
                      <img
                        src={resolvedImg}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                        Preview
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {item.category} · Coming Soon
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-950 mt-1 truncate">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* GET STARTUP HELP PIPELINE */}
      <section
        id="startup-help"
        className="border-t border-zinc-200 bg-zinc-950 text-white py-16 sm:py-20 lg:py-28"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="tvc-fade-up lg:col-span-5 space-y-6">
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Founder Advisory & Engineering Clinic
              </div>
              <h2
                className="text-3xl sm:text-5xl font-editorial text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Building something? Tell us your problem. The Venture Club may be able to help.
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Whether you need architecture review on a prototype, business model validation, or feedback on your pitch deck, our club leads review every submission directly.
              </p>

              <div className="border-t border-zinc-800 pt-6 space-y-4 text-xs text-zinc-400">
                <div>
                  <span className="font-semibold text-white">01. Direct Triage:</span>{' '}
                  Submissions route directly to our ERP Help Request pipeline and synchronize with our Google Sheet.
                </div>
                <div>
                  <span className="font-semibold text-white">02. Domain Matching:</span>{' '}
                  Matched with a Project Lead or Executive Officer in Hardware, AI, or Product Strategy.
                </div>
                <div>
                  <span className="font-semibold text-white">03. Open to All Builders:</span>{' '}
                  Available to student founders, researchers, and early-stage campus innovators.
                </div>
              </div>
            </div>

            <div className="tvc-fade-up tvc-delay-1 lg:col-span-7">
              <form
                onSubmit={handleHelpSubmit}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-5 shadow-xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={founderName}
                      onChange={(e) => setFounderName(e.target.value)}
                      placeholder="e.g. Anish Anand"
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="founder@startup.io"
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Startup / Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={startupName}
                      onChange={(e) => setStartupName(e.target.value)}
                      placeholder="e.g. CampusFlow AI"
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                    >
                      {HELP_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98201 XXXXX"
                      className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    What bottleneck or problem are you solving right now? *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    placeholder="Describe your technical challenge, product hypothesis, or startup question in detail..."
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Website, Deck, or LinkedIn URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={websiteOrLinkedin}
                    onChange={(e) => setWebsiteOrLinkedin(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                {helpFeedback && (
                  <div
                    className={`p-3.5 rounded-lg text-xs flex items-center gap-2 ${
                      helpFeedback.type === 'success'
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                        : 'bg-red-950/80 border border-red-700 text-red-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{helpFeedback.text}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <span className="text-xs text-zinc-400">
                    Synced with PostgreSQL & Google Sheets pipeline
                  </span>
                  <button
                    type="submit"
                    disabled={submittingHelp}
                    className="tvc-btn-press w-full sm:w-auto px-6 py-3 text-xs font-semibold bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {submittingHelp
                      ? 'Submitting Brief...'
                      : 'Submit Problem Brief'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="border-t border-zinc-200 bg-white py-10 sm:py-12 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <TvcLogo size="md" showText={true} />
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-zinc-600">
            <a href="#about" className="hover:text-zinc-950">
              About
            </a>
            <a href="#projects" className="hover:text-zinc-950">
              Projects
            </a>
            <a href="#events" className="hover:text-zinc-950">
              Events
            </a>
            <a href="#team" className="hover:text-zinc-950">
              Team
            </a>
            <a href="#gallery" className="hover:text-zinc-950">
              Gallery
            </a>
            <button
              type="button"
              onClick={onOpenAuthModal || onEnterErp}
              className="font-semibold text-zinc-950 hover:underline cursor-pointer"
            >
              Sign In to ERP (erp.theventureclub.in) →
            </button>
          </div>
        </div>
      </footer>

      {/* GALLERY LIGHTBOX MODAL */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="tvc-scale-in max-w-4xl w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-16/9 bg-black relative">
              <img
                src={lightboxItem.mediaUrl}
                alt={lightboxItem.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-white flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-amber-400">
                  {lightboxItem.category} · Coming Soon
                </div>
                <h3 className="text-lg font-semibold mt-1">
                  {lightboxItem.title}
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  {lightboxItem.caption}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
