# The Venture Club — System Architecture & Engineering Specification

**Domains**:
- **Public Portal**: `theventureclub.in` (Public Startup Studio, Venture Pods, Events, Gallery, Founder Help Desk)
- **Private Club ERP**: `erp.theventureclub.in` (Role-Based Command Center, Live Cryptographic Attendance, Project Kanban, Member Directory, Google Sheets Sync, Audit Trail)

---

## A. System Architecture
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 with dual-surface architecture (`PublicWebsite.tsx` and `ErpCommandCenter.tsx`) + Global Command Palette (`CommandPalette.tsx`).
- **Backend**: Express + Vite middleware (`server.ts`) enforcing Firebase Admin ID token verification, server-side RBAC, rate limiting, and Drizzle ORM transactions.
- **Database**: Cloud SQL PostgreSQL (`src/db/schema.ts`) with 14 normalized tables, B-Tree indexes, and composite unique constraints.
- **Integrations**: Google OAuth 2.0 + Google Sheets API v4 reporting layer with `SYNCED` / `PENDING` / `FAILED` queue and retry controls.
