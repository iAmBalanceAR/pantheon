# Pantheon — Roadmap

Everything planned, speculated, or explicitly requested but not yet built. Ordered roughly by priority and dependency.

---

## Completed Since Last Review

### Agent Skill System ✅

Agent prompts have been converted from inline TypeScript strings to structured markdown Skill files (`src/lib/agents/skills/*.md`). The `skill-loader.ts` reads, caches, and serves them. User custom context now injects into a designated `## User Context` section within each skill rather than being appended as a raw string. The `role-prompts.ts` file is now a deprecated re-export shim. See `04-AGENT-SYSTEM.md` for full details.

### Help center & Quick help ✅

- **Help center**: `src/content/help/*.md` (frontmatter + markdown), loaded via `load-help.ts`, hub at `/help` and articles at `/help/[slug]` with `HelpMarkdown` (`react-markdown`).
- **Quick help**: `HelpAssistantBubble` + `assistant-knowledge.ts` — rule-based replies only (no API / no LLM), slide-up panel, `sessionStorage` transcript, duplicate consecutive-question guard, no choice chips. Shown only when logged in (dashboard layout).
- **Deploy**: `next.config.mjs` `experimental.outputFileTracingIncludes` lists `./src/lib/agents/skills/**/*.md` and `./src/content/help/**/*.md` so Vercel serverless bundles include those files.

### Guided new project & deliverables & rerun ✅

- **`/projects/new`**: guided brief (`brief-spec.ts`) + single-text toggle; same `POST /api/projects` contract
- **Files / zip**: `project_files` + migration **003**; executor persists `<file>` blocks; **Files** tab; `jszip` export
- **Rerun**: `POST /api/projects/[id]/rerun` + overview **`AlertDialog`** (not browser confirm)

---

## Priority 1 — Immediate / Unblocked

### Apply Migration 002

**Status**: Migration file written, not applied  
**File**: `supabase/migrations/002_agent_profiles_and_reports.sql`  
**Action**: Run in Supabase SQL Editor  
**Unblocks**: Report generation, Agent Roster custom prompts

---

## Priority 2 — High Value, Architecturally Designed

### File Output and Project Delivery

**Status**: **Shipped (DB-backed).** Apply migration `003_project_files.sql` in Supabase. Content is stored in Postgres (`project_files.content`), not Storage v1.

**Done**:
- `src/lib/engine/file-extractor.ts` + `persist-task-files.ts` — parse `<file>` tags; executor persists after each completed task
- `project_files` table + RLS (migration 003)
- **Files** tab + per-file download + **Download all (.zip)** (`jszip`)
- Help/FAQ updated

**Still open**:
- Supabase Storage offload for very large blobs; GitHub push; hosted web preview

**File tag format** (already in agent prompts):
```
<file path="src/components/Button.tsx">
import React from 'react'
// ... file contents ...
</file>
```

Multiple `<file>` blocks can appear in a single task result.

---

### Cross-Project Controller Memory

**Status**: Discussed, designed in concept, not built

**The idea** (inspired by Sapphire's memory system):
- The Controller Agent accumulates memories across projects owned by the same user
- Memories include: what stacks worked well, what approaches caused conflicts, which sprint structures were too ambitious, cost patterns per tier
- Memories are stored in a `controller_memories` table (similar structure to Sapphire's memory DB)
- When a new project is created, the Controller's system prompt is augmented with relevant past memories

**Why this matters**:
- Prevents the Controller from making the same mistakes twice
- Makes project planning progressively smarter per user
- Enables "the team knows what you like" UX

**Schema proposal**:
```sql
CREATE TABLE controller_memories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,  -- source project
  category    TEXT,  -- 'stack', 'approach', 'conflict', 'cost', 'sprint_structure'
  content     TEXT NOT NULL,
  relevance   INTEGER DEFAULT 5,  -- 1-10, used to prioritize which memories to include
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Integration point**: `analyzeSpec()` in `controller.ts` — fetch top N relevant memories for the user, prepend to the system prompt.

**Memory creation**: `reporter.ts` already collects sprint/agent/conflict/error data. The reporter could extract memory-worthy insights and insert them into `controller_memories` at project completion.

---

## Priority 3 — User Management / Account System

### User Account Settings

**Status**: Not built  
**Requested**: Yes (explicitly by user)

**What to build**:
1. `src/app/(dashboard)/account/page.tsx`
   - Display name
   - Email (read-only, from auth)
   - Change password
   - Danger zone: delete account
2. API routes for PATCH (update display_name) and DELETE (account deletion)
3. Add "Account" link to Navbar (user avatar icon → dropdown → Account, Logout)

**Auth note**: Supabase Auth handles email/password changes natively. Use `supabase.auth.updateUser()`.

---

### User Dashboard / Stats

**Status**: Not built  
**Requested**: Yes (explicitly, "a bit down the road")

**Proposed content**:
- Total projects (by status)
- Total LLM spend (all time)
- Most used models
- Average project completion time
- Success rate (completed vs failed)
- Recent activity feed
- Quick-launch "New Project" button

**Data source**: All existing tables (projects, budget_events, sprints, execution_log). No new schema needed.

**Route**: `src/app/(dashboard)/page.tsx` (currently redirects to `/projects`)

---

## Priority 4 — Agent System Enhancements

### Sub-Team Execution Validation

**Status**: Code written, not fully production-tested

**What to verify**:
1. When an agent emits `<spawn_team>` output, the executor correctly parses the JSON
2. New team, agents, and tasks are created in the DB with correct `parent_team_id` and `depth`
3. The sub-team's tasks are added to the execution queue
4. Sub-team tasks execute before the parent task is marked complete
5. Budget tracking correctly attributes sub-team costs

**Potential issue**: The current `/run` route executes tasks for a sprint linearly. Sub-team spawning would need to either recursively call the executor or queue sub-tasks into the same sprint for sequential processing. The recursion depth limit must be enforced here.

---

### Structured Code Output Enforcement

**Status**: Format defined in prompts, not enforced/parsed

**Enhancement**: Add validation in the executor that warns (logs, doesn't block) when a Coder or Custom agent task result does NOT contain any `<file>` blocks. This helps identify when agents aren't following the protocol, which can be fed back to improve prompts.

---

### Agent Meeting Protocol (Conflict Resolution)

**Status**: `conflict-detector.ts` exists, basic detection built

**What's not built**:
- Automatic invocation of the Mediator agent when conflict is detected
- Structured meeting flow (Mediator presents both sides, proposes resolution, Auditor approves)
- Resolution plan fed back to both conflicting agents' next tasks
- Conflict resolved → `conflicts.status = 'resolved'`

Currently conflicts are created in the DB but not automatically resolved. A manual workflow can see them in the Report tab.

---

### Banker Real-Time Budget Enforcement

**Status**: `shouldHardStop()` and `shouldWarn()` exist, called in executor

**Enhancement**: The Banker agent should also be called as an LLM agent (not just a function) to generate natural language budget summaries and recommendations. Currently it's purely functional (just DB reads). The full vision includes:
- Banker posting "budget warning" chat messages with specific context ("Agent 'Lead Coder' has consumed 34% of total project budget across 3 tasks — recommend switching to a lighter model for remaining sprint 2 tasks")
- Banker being able to recommend model downgrades to the Controller
- Banker's recommendations visible in the Budget tab

---

## Priority 5 — Future Capabilities

### GitHub Integration

**Idea**: Instead of Supabase Storage, agent-generated files go directly to a GitHub repo.

**User flow**: 
1. User connects GitHub in Settings (OAuth)
2. New project asks: "Create new repo?" or "Push to existing repo?"
3. At project completion, all `<file>` outputs are committed to the repo
4. Report includes a GitHub link

---

### Real Deliverable Preview

**Idea**: If the project is a web app, at completion the user gets a live preview URL.

**Approaches**:
- Deploy to Vercel via API on project completion
- Deploy to a sandboxed iframe environment
- Generate a CodeSandbox/StackBlitz link from the files

This was explicitly discussed and tabled (user said "table the procedures for creating the projects for now"). It's a significant undertaking — requires file parsing to be solid first.

---

### Multi-User Projects / Teams

**Idea**: Multiple Pantheon users collaborating on the same project. One user owns, others have viewer or editor access. Agents from multiple users' rosters can be combined.

**Complexity**: High. Requires a collaborators table, shared RLS policies, presence indicators.

---

### Agent Marketplace

**Long-term vision**: Users can publish custom agent configurations (role + base prompt + recommended model) for others to import into their projects.

---

### Webhook / CI Integration

**Idea**: Projects can be triggered and results received via webhook. Enables integration with existing CI/CD pipelines.

---

## Design Decisions Pending

### Dashboard as Root

Currently `/` redirects to `/projects`. The user wants a proper dashboard at `/`. This should be built when the stats/dashboard feature is ready — at that point `/projects` becomes a sub-section and `/` becomes the primary landing.

### Project Memory Scope

The cross-project memory question: should it be Controller-only (as discussed) or should all agents have memory? The current lean is Controller-only since it has the broadest context. Individual agent memories could lead to conflicting signals.

### Light Mode

The design is intentionally dark-mode only. If light mode is ever added, it should use a cream/warm-white palette rather than pure white — pure white would clash too harshly with the electric lime accent.

### Audit Gate Strictness

Currently the Auditor can hard-fail a sprint, which re-queues corrective tasks. This could create infinite loops if the Auditor is too strict. Consider:
1. Maximum retry count per sprint (2 or 3 rejections → auto-escalate to Controller)
2. Escalation path: Auditor rejects → Controller reviews → user sees escalation flag

---

## Dependencies / Build Order

For planning work sessions, here is the dependency chain:

```
Migration 002 (apply for reports + Agent Roster)
  ↓
Migration 003 (apply for project_files + Files tab + zip)
  ↓
Reports + deliverables zip working
  ↓
(Optional) Supabase Storage offload for very large blobs
  ↓
Project delivery: Git push / hosted preview (not built)

Sub-team validation (no schema deps)
  ↓
Conflict resolution automation

Controller memory schema
  ↓
Memory extraction in reporter.ts
  ↓
Memory injection in analyzeSpec()

Account settings (no deps)
Dashboard (needs account settings for user data)
```
