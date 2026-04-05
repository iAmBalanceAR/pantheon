# Pantheon — Documentation Index

This folder contains everything a new agent needs to understand, continue, and extend the Pantheon project. Read these files in order before touching any code.

## Files

| File | What it covers |
|------|---------------|
| `01-PROJECT-OVERVIEW.md` | What Pantheon is, the vision, the core idea |
| `02-ARCHITECTURE.md` | Tech stack, folder structure, data flow |
| `03-DATABASE-SCHEMA.md` | Full Supabase schema, RLS, all tables, migrations 001–005, `schema.sql` |
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

## Database setup (Supabase)

**Fast path (new project):** run the entire `supabase/schema.sql` file once in the Supabase SQL Editor. It is idempotent and includes all tables, RLS, indexes, and Realtime publication entries through **005**.

**Incremental path:** apply numbered files in order under `supabase/migrations/` (`001` … `005`). See `03-DATABASE-SCHEMA.md` for table details.

| Migration | Purpose |
|-----------|---------|
| **001** | Core schema: projects, teams, agents, sprints, tasks, chat, conflicts, budget_events, execution_log + RLS |
| **002** | `projects.report`, `user_agent_profiles` |
| **003** | `project_files` (deliverables / Files tab / zip) |
| **004** | Adds `public.projects` to `supabase_realtime` (live overview updates) |
| **005** | `user_installed_skills` (Skills Library installs) |

**Deliverables & rerun:** agent output → `project_files` via `persist-task-files.ts` + `deliverable-refs.ts` consistency checks; **Rerun project** calls `POST /api/projects/[id]/rerun`. See `06-COMPLETED-WORK.md`.

## Agent skill files (bundled)

**Core roles** — `src/lib/agents/skills/*.md` (nine files). The skill loader reads and caches them at server startup. Do not delete or rename these files. Restart the dev server after edits in development.

**Skills Library** — `src/lib/agents/skills-library/*.md` (specialist templates) + `_index.ts` (catalog metadata). Shipped with the app; no external registry. Users **install** copies into `user_installed_skills` via `/agents`. See `04-AGENT-SYSTEM.md`.
