# Pantheon — Documentation Index

This folder contains everything a new agent needs to understand, continue, and extend the Pantheon project. Read these files in order before touching any code.

## Files

| File | What it covers |
|------|---------------|
| `01-PROJECT-OVERVIEW.md` | What Pantheon is, the vision, the core idea |
| `02-ARCHITECTURE.md` | Tech stack, folder structure, data flow |
| `03-DATABASE-SCHEMA.md` | Full Supabase schema, RLS, all tables, pending migrations |
| `04-AGENT-SYSTEM.md` | How the agent pipeline works end-to-end |
| `05-UI-DESIGN-SYSTEM.md` | Design language, color tokens, component conventions |
| `06-COMPLETED-WORK.md` | Everything built so far, file by file |
| `07-KNOWN-BUGS-AND-FIXES.md` | Bugs encountered, root causes, fixes applied |
| `08-ROADMAP.md` | What's planned, speculated, and not yet built |
| `09-ENV-AND-SETUP.md` | Environment variables, running locally, Supabase config |

## In-app Help & Quick help (end users)

These features are **only mounted when logged in** (inside `src/app/(dashboard)/layout.tsx`). They do not appear on `/login`.

| Surface | Route / UI | Purpose |
|--------|------------|---------|
| **Help** (nav link) | `/help`, `/help/[slug]` | Long-form guides from `src/content/help/*.md` (YAML frontmatter, rendered with `react-markdown`) |
| **Quick help** | Lower-right pill on every dashboard page | Rule-based topic matcher: user types a question; `assistant-knowledge.ts` matches keywords; no LLM, no API. Panel **slides up** (Framer Motion). Transcript persisted in **`sessionStorage`** for the tab; duplicate consecutive questions get a short non-repeating reply. No multiple-choice chips. |

**Developer vs user docs:** This **`docs/`** directory is the product/engineering bible. **`src/content/help/`** is copy for people *using* Pantheon in the browser. Keep them aligned when behavior changes.

See also: `06-COMPLETED-WORK.md` (file inventory), `05-UI-DESIGN-SYSTEM.md` (nav + Quick help UX), `08-ROADMAP.md` (completed Help work called out).

## Critical: Pending Database Migrations

Apply SQL from `03-DATABASE-SCHEMA.md` in the Supabase SQL **Editor** as needed:

| Migration | Unblocks |
|-----------|----------|
| **002** (`002_agent_profiles_and_reports.sql`) | Completion reports (`projects.report`), Agent Roster (`user_agent_profiles`) |
| **003** (`003_project_files.sql`) | **Files** tab, `<file>` extraction into `project_files`, zip download. Ends with `NOTIFY pgrst, 'reload schema';` |

**Deliverables & rerun** (no extra migration): agent output → `project_files`; **Rerun project** on overview resets work and calls `POST /api/projects/[id]/rerun`. See `06-COMPLETED-WORK.md`.

## Agent Skill Files

Agent identities live in `src/lib/agents/skills/*.md` — one file per role. **Do not delete or rename these files.** The skill loader reads them at startup and the executor depends on them for every task. If you edit a skill file, restart the dev server to pick up changes. See `04-AGENT-SYSTEM.md` for the full skill system architecture.
