# Pantheon — Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | TailwindCSS + custom CSS variables |
| Components | shadcn/ui (Radix UI primitives) + custom |
| Database | Supabase (PostgreSQL + Realtime + Auth + RLS) |
| Package manager | pnpm |
| In-app motion (Quick help panel) | Framer Motion |
| Help article rendering | react-markdown |
| LLM: Controller/Auditor/Architect/Reviewer | Google Gemini 2.5 Flash |
| LLM: Coder/Banker/Researcher | Fireworks AI (llama-v3p3-70b-instruct) |

## Folder Structure

```
pantheon/
├── docs/                          ← you are here
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx     ← login/signup
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         ← Navbar + HelpAssistantBubble (logged-in only)
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx       ← project list (3 groups: Future/In Process/Complete)
│   │   │   │   ├── new/page.tsx   ← guided brief + optional single-box spec; CreationModal on submit
│   │   │   │   └── [id]/
│   │   │   │       ├── layout.tsx    ← fetches project, renders ProjectHeader + child
│   │   │   │       ├── page.tsx      ← overview: run ticker, rerun (AlertDialog), start/continue
│   │   │   │       ├── chat/page.tsx ← real-time agent chat feed
│   │   │   │       ├── team/page.tsx ← agent list
│   │   │   │       ├── files/page.tsx ← deliverables list + zip (project_files)
│   │   │   │       ├── budget/page.tsx ← budget/token usage
│   │   │   │       ├── report/page.tsx ← completion report UI
│   │   │   │       ├── settings/page.tsx ← project settings (name, budget, model overrides)
│   │   │   │       └── error.tsx     ← project-scoped error boundary
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx       ← platform settings (API keys, default models)
│   │   │   │   ├── agents/page.tsx ← Agent Roster — view skill content, add custom context
│   │   │   │   └── profiles/page.tsx ← Controller Profiles
│   │   │   ├── help/
│   │   │   │   ├── page.tsx        ← Help hub — lists user guides
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx    ← Single guide (markdown from src/content/help/)
│   │   │   │       └── not-found.tsx
│   │   │   └── error.tsx          ← dashboard error boundary
│   │   ├── api/
│   │   │   ├── projects/
│   │   │   │   ├── route.ts       ← GET list, POST create (runs controller analysis)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts   ← GET, PATCH, DELETE single project
│   │   │   │       ├── run/route.ts ← POST — executes next sprint (the orchestrator)
│   │   │   │       ├── rerun/route.ts ← POST — reset sprints/tasks/usage/files; rerun from start
│   │   │   │       ├── report/route.ts ← POST — manually regenerate completion report
│   │   │   │       └── files/       ← route.ts (list), zip/route.ts, by-id/[fileId]/route.ts
│   │   │   ├── agents/[id]/execute/route.ts ← direct agent execution (not sprint-based)
│   │   │   ├── auditor/route.ts   ← auditor sprint review
│   │   │   └── settings/
│   │   │       ├── roles/route.ts  ← GET skill definitions (server reads .md, sends to client)
│   │   │       ├── agents/route.ts ← GET/POST user_agent_profiles
│   │   │       └── profiles/[id]/route.ts ← controller profile CRUD
│   │   ├── error.tsx              ← global error boundary
│   │   ├── not-found.tsx          ← 404 page
│   │   └── layout.tsx             ← root layout
│   ├── components/
│   │   ├── help/
│   │   │   ├── help-markdown.tsx  ← client: react-markdown + Obsidian Electric styles
│   │   │   └── help-assistant-bubble.tsx ← Quick help: pill + slide-up panel, sessionStorage, duplicate guard
│   │   ├── layout/
│   │   │   ├── navbar.tsx         ← top navigation bar (52px, lime logo, Projects / Help / Settings)
│   │   │   └── project-header.tsx ← project page header (name, tabs, pause/resume button)
│   │   └── ui/
│   │       ├── button.tsx         ← shadcn button
│   │       ├── dropdown-menu.tsx  ← shadcn dropdown
│   │       └── alert-dialog.tsx   ← shadcn alert dialog
│   ├── content/
│   │   └── help/                  ← User-facing help articles (.md + YAML frontmatter)
│   ├── lib/
│   │   ├── help/
│   │   │   ├── load-help.ts       ← listHelpArticles(), getHelpArticle(slug)
│   │   │   └── assistant-knowledge.ts ← curated keywords + matchAssistantMessage() (no LLM)
│   │   ├── agents/
│   │   │   ├── skills/            ← Agent Skill files — one .md per role (source of truth)
│   │   │   │   ├── controller.md
│   │   │   │   ├── coder.md
│   │   │   │   ├── architect.md
│   │   │   │   ├── reviewer.md
│   │   │   │   ├── researcher.md
│   │   │   │   ├── auditor.md
│   │   │   │   ├── banker.md
│   │   │   │   ├── mediator.md
│   │   │   │   └── custom.md
│   │   │   ├── skill-loader.ts    ← reads/caches skill files, injects user context
│   │   │   ├── role-prompts.ts    ← deprecated shim — re-exports from skill-loader.ts
│   │   │   ├── controller.ts      ← Controller Agent: analyzeSpec(), SPEC_SCORING_PROMPT
│   │   │   ├── auditor.ts         ← Auditor Agent logic
│   │   │   ├── banker.ts          ← budget tracking, shouldHardStop(), shouldWarn()
│   │   │   ├── reporter.ts        ← generates ProjectReport on completion
│   │   │   └── model-sanitizer.ts ← sanitizeModel(): remaps Anthropic/deprecated models
│   │   ├── projects/
│   │   │   └── brief-spec.ts      ← guided new-project options + buildProjectSpecFromBrief()
│   │   ├── engine/
│   │   │   ├── executor.ts        ← executeAgentTask(): core agent call + persistTaskOutputFiles()
│   │   │   ├── file-extractor.ts  ← parse <file path="…"> blocks from task output
│   │   │   ├── persist-task-files.ts ← upsert project_files after each task
│   │   │   └── conflict-detector.ts ← detects agent task overlaps
│   │   ├── llm/
│   │   │   ├── client.ts          ← callLLM() unified interface, MODEL_COSTS, estimateCost()
│   │   │   ├── gemini.ts          ← callGemini() with history normalization, timeout, json mode
│   │   │   ├── fireworks.ts       ← callFireworks()
│   │   │   └── anthropic.ts       ← callAnthropic() (present but NOT USED — no credits)
│   │   ├── supabase/
│   │   │   ├── client.ts          ← browser Supabase client
│   │   │   └── server.ts          ← server Supabase client (SSR + service role)
│   │   └── utils.ts               ← cn() classname utility
│   ├── types/index.ts             ← Database type definitions, all table row types
│   └── middleware.ts              ← Supabase auth session refresh + route protection
├── supabase/migrations/
│   ├── 001_initial.sql            ← full schema (run ✅)
│   ├── 002_agent_profiles_and_reports.sql ← reports + user_agent_profiles (apply in Supabase)
│   └── 003_project_files.sql     ← deliverables table + RLS + schema reload notify (apply in Supabase)
└── .env.local                     ← API keys and model configuration
```

## Data Flow: Project Creation

```
User submits spec
  → POST /api/projects
    → analyzeSpec() calls Controller Agent (Gemini 2.5 Flash, jsonMode:true)
    → returns structured JSON: { score, tier, team[], sprints[], tasks[] }
    → INSERT projects row
    → INSERT teams row
    → INSERT agents rows (sanitized through model-sanitizer)
    → INSERT sprints rows
    → INSERT tasks rows (with agent_id assigned by role matching)
    → returns { id: project.id }
  → frontend redirects to /projects/[id]
```

## Data Flow: Sprint Execution

```
User clicks "Start project"
  → frontend loop: POST /api/projects/[id]/run (repeats until done/paused)
    → find next pending sprint
    → activate project + sprint
    → load tasks ordered by priority
    → for each task:
        → check pause status
        → check banker hard-stop
        → find assigned agent (by agent_id, fallback role, fallback coder)
        → sanitizeModel(agent.llm_provider, agent.llm_model)
        → loadSkill(agent.role) from skill-loader (cached, no I/O)
        → fetch user custom context from user_agent_profiles
        → injectUserContext(skill, customCtx) → structured slot injection
        → build final system prompt = skill + project context
        → callLLM() → callGemini() or callFireworks()
        → save result to tasks.result
        → extract `<file>` blocks → upsert project_files (same path = overwrite)
        → save to execution_log
        → post to chat_messages
        → recordUsage() via Banker
    → mark sprint completed/review
    → if no more sprints: mark project completed, call generateCompletionReport()
    → returns { done, sprint_number, tasks_run, any_failed }
```

## Project rerun (reset)

When status is **completed**, **failed**, **paused**, or **reviewing** (and not actively `active` / `running`), the overview can call **POST `/api/projects/[id]/rerun`**. That resets all sprints/tasks to pending, clears agent and project spend counters, clears `report`, deletes `project_files` plus execution/budget/conflict rows for the project, preserves **chat_messages**, sets status to **scoping**, and posts a system line. Confirmation uses the shared **`AlertDialog`** pattern (same component family as project delete on the list page).

## Real-time Updates

All project pages subscribe to Supabase Realtime channels:
- `projects` table — status, cost_used, tokens_used (drives the header and run ticker)
- `agents` table — status per agent
- `sprints` table — status per sprint
- `chat_messages` table — new messages in the feed

## Key Constraints

- `maxDuration = 300` on the run route (5 minutes) — Vercel serverless limit
- Gemini requires strictly alternating user/model turns — handled in `gemini.ts`
- `thinkingBudget: 0` set for gemini-2.5-flash to disable slow reasoning mode
- Anthropic provider exists in code but has no credits — model-sanitizer remaps anything Anthropic → Gemini
- `VALID_PROVIDERS` in the create route is `['fireworks', 'gemini']` only
