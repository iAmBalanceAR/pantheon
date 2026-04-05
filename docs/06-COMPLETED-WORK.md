# Pantheon — Completed Work

A complete inventory of what has been built, file by file.

---

## Infrastructure

### `src/middleware.ts`
- Supabase server-side auth session refresh
- Route protection: unauthenticated users redirected to `/login`
- Handles `cookiesToSet` correctly for the SSR cookie pattern

### `src/lib/supabase/client.ts`
- Browser-side Supabase client factory (`createBrowserClient`)
- Used in all `'use client'` components

### `src/lib/supabase/server.ts`
- Server-side Supabase client factory (SSR, reads cookies)
- Used in Server Components, API routes, and layouts

### `src/lib/utils.ts`
- `cn()` — Tailwind class merge utility (clsx + tailwind-merge)

### `src/types/index.ts`
- All TypeScript types: `Project`, `Agent`, `Sprint`, `Task`, `ChatMessage`, `Conflict`, `BudgetEvent`, `ExecutionLog`
- `SpecAnalysis` — the output type of `analyzeSpec()`
- `AgentRole`, `ResourceTier`, `LLMProvider` — union type literals
- `TIER_CONFIGS` — maps tier names to max agent count, recursion depth, sprint count

---

## Design System

### `src/app/globals.css`
- "Obsidian Electric" color token system (HSL CSS variables)
- Typography scale: `.text-hero`, `.text-display`, `.text-title`, `.text-body`, `.text-small`, `.text-mono`, `.text-2xs`
- `.input` / `.input-field` canonical form field classes
- `select.input` / `select.input-field` with custom SVG chevron
- `.sep` separator utility
- `.btn-*` base button classes (augmented by button.tsx)
- `.status-*` / `.dot-*` status indicator pairs
- `animate-fade-up`, `animate-live-pulse`, `animate-shimmer`
- `.lime-glow` effect for primary CTA buttons

### `tailwind.config.ts`
- Maps CSS tokens to Tailwind color names
- Custom `borderRadius`, `fontFamily`, `fontSize`
- Custom animations (`fade-up`, `live-pulse`, `shimmer`)

### `src/components/ui/button.tsx`
- shadcn-style Button with variants: `default`, `ghost`, `outline`, `destructive`, `link`
- Sizes: `default`, `sm`, `lg`, `icon`

### `src/components/ui/dropdown-menu.tsx`
- Radix-based dropdown with dark theme
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`

### `src/components/ui/alert-dialog.tsx`
- Radix-based alert dialog for destructive confirmations

---

## Layout

### `src/components/layout/navbar.tsx`
- 52px horizontal top navigation bar
- "PANTHEON" logo with lime dot
- Links: Projects, Help, Settings
- Active state detection via `usePathname()`
- No sidebar — replaced the entire previous sidebar navigation

### `src/components/layout/project-header.tsx`
- Project name as `.text-display`
- Pause / Resume toggle button with `toggling` spinner state
- Tab navigation: Overview, Live Feed, Team, Files, Budget, Report, Settings
- Supabase Realtime subscription for live project status updates
- Meta info row (status/tier/budget bar) is commented out but preserved

### `src/app/layout.tsx`
- Root layout: sets `<html>` `<body>` with font classes, renders children

### `src/app/(auth)/layout.tsx`
- Auth layout: centered card for login/signup

### `src/app/(dashboard)/layout.tsx`
- Dashboard layout: renders `<Navbar />` above `{children}` and mounts `<HelpAssistantBubble />` (Quick help) for all authenticated dashboard routes

### `src/app/(dashboard)/projects/[id]/layout.tsx`
- Fetches project by ID (server side)
- Passes project to `<ProjectHeader />`
- Renders tab content below

---

## Error Handling

### `src/app/error.tsx`
- Global Next.js error boundary
- "Something went wrong" with retry button

### `src/app/(dashboard)/error.tsx`
- Dashboard-scoped error boundary

### `src/app/(dashboard)/projects/[id]/error.tsx`
- Project-scoped error boundary

### `src/app/not-found.tsx`
- Custom 404 page with Pantheon branding

---

## Help & learning (in-app)

### `src/content/help/*.md`
- User-facing guides: overview, projects-and-sprints, agents-and-skills, budget-and-usage, using-the-app, troubleshooting, faq
- YAML frontmatter: `title`, `description`, `order` (sort key for hub listing)

### `src/lib/help/load-help.ts`
- `listHelpArticles()`, `getHelpArticle(slug)`, `getAllHelpSlugs()` — server-side `fs` (bundle via `next.config` `outputFileTracingIncludes`)

### `src/app/(dashboard)/help/page.tsx`
- Hub: lists all guides as cards linking to `/help/[slug]`

### `src/app/(dashboard)/help/[slug]/page.tsx`
- Renders one guide; `generateStaticParams` from slugs; `HelpMarkdown` for body

### `src/app/(dashboard)/help/[slug]/not-found.tsx`
- Branded 404 when a guide slug does not exist

### `src/components/help/help-markdown.tsx`
- `react-markdown` with Tailwind-styled elements (internal links use Next `Link`)

### `src/lib/help/assistant-knowledge.ts`
- Curated Q&A keywords + `matchAssistantMessage()` — no API, no LLM (free)

### `src/components/help/help-assistant-bubble.tsx`
- Floating **Quick help** on all dashboard routes: lower-right pill, slide-up panel (framer-motion), session-persisted transcript, duplicate-question guard, no choice chips — type-only, links into `/help`
- Mounted from `(dashboard)/layout.tsx`

---

## Pages

### `src/app/(auth)/login/page.tsx`
- Login and signup forms in one page
- Email + password
- Matches "Obsidian Electric" aesthetic
- Links to /signup and back

### `src/app/(dashboard)/projects/page.tsx`
- Project list with three groups: Future Projects, In Process, Complete
- Each group only shows its header if it has projects
- `ProjectRow` component: compact, `StatusIcon`, tier badge, date, hover-reveal actions
- `StatusIcon` component: per-status icons (Zap/ping for running, CheckCheck for complete, etc.)
- `GroupSection` component: section header with colored dot, separator, rows
- Realtime subscription for project list updates
- Pause/resume from list via hover actions
- Delete with confirm dialog

### `src/app/(dashboard)/projects/new/page.tsx`
- **Guided brief** + **Single text box** mode toggle; brief uses `buildProjectSpecFromBrief()` from `@/lib/projects/brief-spec`
- Cards: core idea, spark questions, constraints, stack pills (`aria-pressed`), product & team-behavior checkboxes (`accent-primary`)
- Tier legend preview from effective spec string
- `CreationModal` overlay on submit: phase steps + progress bar; then redirect

### `src/app/(dashboard)/projects/[id]/page.tsx` (Project Overview)
- Client component with Supabase Realtime for live data
- Run control section: status, sprint count, Start/Continue button
- `RunTicker` inline component (appears when running): phase, sprint progress, scrolling log lines
- **Rerun project**: `AlertDialog` confirmation → `POST /api/projects/[id]/rerun` when status is completed / failed / paused / reviewing
- Sprint list with status badges and goal text
- Active agents section
- Handles all project statuses including complete/failed states

### `src/app/(dashboard)/projects/[id]/chat/page.tsx`
- Real-time chat feed
- Left-aligned messages with agent name + role badge
- Message type styling (decision, conflict, budget_warning, system all look different)
- Auto-scrolls to bottom on new messages
- User can post messages to the feed

### `src/app/(dashboard)/projects/[id]/team/page.tsx`
- Agent cards with role, model, status, token usage
- Shows which agents are currently running

### `src/app/(dashboard)/projects/[id]/budget/page.tsx`
- Token and dollar usage breakdown per agent
- Budget events log
- Progress bars for token and dollar budget

### `src/app/(dashboard)/projects/[id]/settings/page.tsx`
- Edit project name, budget
- Per-agent model/provider override
- Provider list: only `fireworks` and `gemini` (Anthropic removed)
- Model assignments saved to DB

### `src/app/(dashboard)/projects/[id]/report/page.tsx`
- Displays `ProjectReport` from `projects.report` JSONB column
- Sections: summary stats, narrative, stack info, budget summary, sprint breakdown, agent performance, errors, conflicts
- "Generate Report" button → POST `/api/projects/[id]/report`
- Shows placeholder if report not yet generated

### `src/app/(dashboard)/projects/[id]/files/page.tsx`
- Lists rows from `project_files` (path, updated time)
- Per-file download via `/api/projects/[id]/files/by-id/[fileId]`
- **Download all (.zip)** → `/api/projects/[id]/files/zip` (requires migration `003_project_files.sql`)

### `src/app/(dashboard)/settings/page.tsx`
- Platform settings
- API key management
- Default model/provider assignments
- Prominent link/button to Agent Roster

### `src/app/(dashboard)/settings/agents/page.tsx` (Agent Roster)
- Fetches role definitions from `GET /api/settings/roles` on mount (server reads skill files, sends JSON to client)
- Fetches user profiles from `GET /api/settings/agents` in parallel on mount
- Skeleton loaders shown while fetching
- Role cards: icon, display name, description
- Collapsible "Base Skill" section (read-only, shows full skill markdown)
- Textarea for `custom_context` — injected into the skill's `## User Context` section at runtime
- Saves via `POST /api/settings/agents`

---

## API Routes

### `POST /api/projects`
- Accepts: `{ spec: string, budget?: number }`
- Calls `analyzeSpec(spec)` via Controller Agent
- Creates: project, team, agents (sanitized), sprints, tasks
- Returns: `{ id: project.id }`
- `maxDuration = 300` (5-minute serverless timeout)

### `GET /api/projects/[id]`
- Returns project by ID with auth check

### `PATCH /api/projects/[id]`
- Updates project fields (name, budget, status)

### `DELETE /api/projects/[id]`
- Deletes project and all related data (cascades in DB)

### `POST /api/projects/[id]/run`
- Finds next pending sprint
- Executes all tasks sequentially via `executeAgentTask()`
- Banker checks (warn + hard stop)
- On last sprint complete: calls `generateCompletionReport()`
- Returns: `{ done: boolean, sprint_number, tasks_run, any_failed }`
- `maxDuration = 300`

### `POST /api/projects/[id]/report`
- Manually triggers `generateCompletionReport()`
- Returns the generated report

### `GET /api/projects/[id]/files`
- Lists deliverable files (metadata) for the project owner

### `GET /api/projects/[id]/files/zip`
- Returns `application/zip` of all `project_files` bodies

### `GET /api/projects/[id]/files/by-id/[fileId]`
- Downloads one file by row id

### `POST /api/projects/[id]/rerun`
- Owner-only. Resets all sprints to `pending`, all tasks to `pending` (clears results), agents to `idle` with usage zeroed, project `tokens_used` / `cost_used` / `report` cleared, deletes `project_files`, `execution_log`, `budget_events`, `conflicts` for the project
- Allowed when status is `completed`, `failed`, `paused`, or `reviewing` — not when `active` / `running` (pause first)
- Inserts a system chat message; preserves **chat_messages** history
- UI: overview uses **`AlertDialog`** (`alert-dialog.tsx`) for copy + Cancel / confirm — not `window.confirm`

### `GET /api/settings/roles`
- Returns all 9 `RoleDefinition` objects (parsed from skill files) including full `base_prompt` markdown
- Used by the Agent Roster settings page (client cannot use `fs` directly)

### `GET /api/settings/agents`
- Returns all `user_agent_profiles` for authenticated user

### `POST /api/settings/agents`
- Upserts (create or update) a user's custom context for a role
- Body: `{ role: string, custom_context: string }`

### `POST /api/auditor`
- Runs the Auditor agent on a completed sprint
- Returns audit result

---

## Agent System

### `src/lib/agents/controller.ts`
- `analyzeSpec()` — full project planning
- `decomposeTask()` — per-task implementation instructions
- `shouldSpawnSubTeam()` — spawn decision
- Robust JSON extraction (jsonMode → fence → greedy)
- `ensureGovernanceAgents()` — always includes controller/banker/auditor

### `src/lib/agents/auditor.ts`
- Sprint review against spec
- Produces pass/conditional/fail result with corrective tasks

### `src/lib/agents/banker.ts`
- `recordUsage()` — update DB after every LLM call
- `shouldHardStop()` — 95% threshold check
- `shouldWarn()` — 75%/90% threshold warnings

### `src/lib/agents/reporter.ts`
- `generateCompletionReport()` — builds full ProjectReport
- `generateNarrative()` — Controller generates plain-English summary
- Saves to `projects.report`

### `src/lib/agents/skills/*.md` (9 files)
- One skill file per agent role: `controller`, `coder`, `architect`, `reviewer`, `researcher`, `auditor`, `banker`, `mediator`, `custom`
- YAML frontmatter: `role`, `display_name`, `description`, `icon`
- Sections: Identity, Responsibilities, Behavioral Constraints, Output Format, User Context
- `<!-- USER_CONTEXT_PLACEHOLDER -->` marks the structured injection point for user custom context

### `src/lib/agents/skill-loader.ts`
- Server-side only — uses `fs.readFileSync`
- Eagerly warms cache on module load (all 9 files read once, zero per-request I/O)
- `loadSkill(role)` — returns skill body for a role (with placeholder intact)
- `injectUserContext(body, context)` — slots user context into the `## User Context` section or removes it cleanly
- `getSkillDefinitions()` — returns full `RoleDefinition[]` array for API use
- `ROLE_DEFINITIONS`, `ROLE_PROMPT_MAP`, `getRoleDefinition()` — backward-compatible exports

### `src/lib/agents/role-prompts.ts`
- Deprecated shim — re-exports everything from `skill-loader.ts`
- Kept so existing imports continue to compile without changes

### `src/lib/agents/model-sanitizer.ts`
- `sanitizeModel(provider, model)` — runtime model safety net
- Remaps Anthropic → Gemini, deprecated Fireworks → current

### `src/lib/projects/brief-spec.ts`
- Stack / product / team-behavior option constants
- `buildProjectSpecFromBrief()`, `emptyBrief()` — guided **New project** spec composition (single string POSTed as `spec`)

### `src/lib/engine/executor.ts`
- `executeAgentTask()` — the hot path for every task
- Sanitizes model via `sanitizeModel()`
- Builds system prompt: `loadSkill(role)` → `injectUserContext(body, customCtx)` → append project context block
- Loads last 10 chat messages as history, calls LLM
- Saves to tasks, execution_log, chat_messages
- After each successful task: `persistTaskOutputFiles()` — parses `<file path="…">` blocks into `project_files` (upsert by project + path)
- Calls Banker record and check

### `src/lib/engine/file-extractor.ts`
- `extractFileBlocksFromOutput()` / `normalizeDeliverablePath()` — safe relative paths, no `..` escape

### `src/lib/engine/persist-task-files.ts`
- `persistTaskOutputFiles()` — upserts extracted files for a task

### `src/lib/engine/conflict-detector.ts`
- Detects task overlap between agents
- Creates conflicts records and triggers Mediator

---

## LLM Clients

### `src/lib/llm/client.ts`
- `callLLM(provider, model, messages, options)` — unified interface
- `MODEL_COSTS` — token pricing for all supported models
- `estimateCost(provider, model, tokens)` — cost calculation

### `src/lib/llm/gemini.ts`
- `callGemini()` with:
  - 45-second timeout wrapper
  - JSON mode via `responseMimeType: 'application/json'`
  - `thinkingBudget: 0` (disables Gemini thinking tokens)
  - History normalization: drops leading model turns, merges consecutive same-role turns, handles trailing user turns
  - Maps assistant → model for Gemini's terminology

### `src/lib/llm/fireworks.ts`
- `callFireworks()` — OpenAI-compatible API call
- Model: `accounts/fireworks/models/llama-v3p3-70b-instruct` (primary)

### `src/lib/llm/anthropic.ts`
- Present but effectively disabled
- `sanitizeModel` remaps everything Anthropic → Gemini before it gets called
- DO NOT remove — future credits may restore Anthropic access

---

## Database Migrations

### `supabase/migrations/001_initial.sql`
- ✅ Applied
- All core tables: projects, teams, agents, sprints, tasks, chat_messages, conflicts, budget_events, execution_log
- RLS policies for all user-facing tables
- `update_updated_at()` trigger function

### `supabase/migrations/002_agent_profiles_and_reports.sql`
- ⚠️ PENDING — must be applied manually in Supabase SQL Editor
- Adds `report JSONB` column to `projects`
- Creates `user_agent_profiles` table with RLS
