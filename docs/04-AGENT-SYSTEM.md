# Pantheon — Agent System

## The Nine Roles

Every agent's identity, responsibilities, constraints, and output format are defined in a **Skill file** — a structured markdown document in `src/lib/agents/skills/`. One file per role. The skill loader (`src/lib/agents/skill-loader.ts`) reads and caches these files at server startup.

Users can append custom context via their agent profile (stored in `user_agent_profiles` DB table). The custom context is injected into the skill's designated `## User Context` section at runtime — not tacked onto the end. The base skill content is immutable; only the User Context section is user-writable.

| Role | Icon | Provider | Primary Responsibility |
|------|------|----------|----------------------|
| controller | ⚡ | gemini-2.5-flash | Orchestrates everything. Plans teams. Makes strategic decisions. |
| coder | 💻 | fireworks llama-v3p3-70b | Writes production-ready implementation code |
| architect | 🏗️ | gemini-2.5-flash | Designs system structure, APIs, schemas |
| reviewer | 🔍 | gemini-2.5-flash | Reviews code for quality, security, correctness |
| researcher | 🔬 | fireworks llama-v3p3-70b | Investigates approaches, compares libraries |
| auditor | ✅ | gemini-2.5-flash | Reviews completed sprints, gates progress |
| banker | 💰 | fireworks llama-v3p3-70b | Monitors budget, enforces guardrails |
| mediator | 🤝 | gemini-2.5-flash | Resolves conflicts between agents |
| custom | 🎯 | (assigned by controller) | Specialist role defined per-project |

---

## The Controller Agent

**File**: `src/lib/agents/controller.ts`

### analyzeSpec(spec, installedSkills?)

The most important function in the system. Called once per project creation from `POST /api/projects`.

Optional second argument: `InstalledSkillRef[]` — each `{ library_id, display_name, description }` for skills the user has installed from the Skills Library. When non-empty, the Controller prompt’s **VALID ROLES** list is extended with those `library_id` strings and a short catalog section is appended so the model can assign tasks to specialists (e.g. `mobile-developer`, `copywriter`).

1. Sends the user's spec to Gemini with `jsonMode: true`
2. Returns a structured `SpecAnalysis` object:
   ```typescript
   {
     score: 1-5,
     tier: 'micro' | 'small' | 'medium' | 'large' | 'enterprise',
     summary: string,
     gaps: string[],
     suggested_name: string,
     stack: { frontend, backend, database, other[] },
     sprints: [{ number, name, goal, tasks: [{ title, description, role }] }],
     team: [{ role, display_name, provider, model, purpose }]
   }
   ```
3. Validates tier against score (overrides whatever the LLM said)
4. Ensures controller + banker + auditor are always in the team (`ensureGovernanceAgents`)
5. Three-tier JSON extraction (jsonMode → markdown fence → greedy match) to handle any LLM formatting

### decomposeTask(projectSpec, sprintGoal, agentRole)

Asks the Controller to produce a detailed implementation plan for a specific agent role on a specific sprint goal. Plain text output. Used to enrich task descriptions before sending to the worker agent.

### shouldSpawnSubTeam(taskDescription, currentDepth, maxDepth)

Returns `{ spawn: boolean, reason: string, teamPurpose?: string }`. Called before spinning up a sub-team to avoid unnecessary recursion. Hard-blocked if `currentDepth >= maxDepth` (depth limit from tier config).

---

## The Executor

**File**: `src/lib/engine/executor.ts`

The `executeAgentTask` function is called for every task in every sprint. This is the hot path.

### What it does per task:

1. **Sanitize model**: `sanitizeModel(agent.llm_provider, agent.llm_model)` — remaps anything invalid
2. **Build system prompt**:
   - **If `agent.system_prompt` is set** (installed library skill on a `custom` row), that string is the skill body; otherwise `loadSkill(agent.role)` from `skills/*.md`.
   - Fetches `custom_context` from `user_agent_profiles` for `(user_id, agent.role)`. Installed library agents are stored with **`role = 'custom'`**, so they share the same optional `custom` profile row as any other custom agent.
   - Calls `injectUserContext(skillBody, customCtx)` — slots custom context into the `## User Context` section (or removes the section cleanly if empty).
   - Appends project context block: name, stack JSON, spec.
   - Task user message includes `buildTaskPrompt()` global guidance: relative `href`/`src` must match `<file>` blocks; prefer hotlinked `https://` stock images for raster photos.
3. **Build message history**:
   - Previous messages from `chat_messages` for this project (last N messages)
   - The task description as the final user message
4. **Call the LLM**: `callLLM(provider, model, messages, options)`
5. **Save results**:
   - Update `tasks.result` and `tasks.status`
   - Insert into `execution_log` (full prompt + response + tokens + cost)
   - Insert into `chat_messages` as the agent's output
   - Update `agents.tokens_used` and `agents.cost`
   - Call `recordUsage()` on the Banker

### File output parsing and deliverable checks

The Coder, Custom, and library skill prompts instruct agents to use:
```
<file path="relative/path/to/file.ext">
...complete file contents...
</file>
```

After each successful task, **`persistTaskOutputFiles()`** parses these blocks and **upserts `project_files`** (migration **003**). It then runs **`analyzeDeliverableConsistency()`** (`deliverable-refs.ts`) on the extracted set: flags HTML that references missing sibling files or CSS/JS files that nothing links to. Issues are surfaced as **system** chat messages so the user can re-run if needed.

Full output remains in `tasks.result` and `execution_log`; the **Files** tab and zip export expose deliverables.

---

## The Banker Agent

**File**: `src/lib/agents/banker.ts`

Two key exported functions:

### recordUsage(projectId, agentId, tokens, cost)
Called after every LLM call. Updates `projects.tokens_used`, `projects.cost_used`, `agents.tokens_used`, `agents.cost`, and inserts a `budget_events` row.

### shouldHardStop(projectId) → boolean
Checks if `cost_used / budget_dollars >= 0.95` (95% threshold). If true, the executor will refuse to run non-critical tasks.

### shouldWarn(projectId) → { warn: boolean, pct: number }
Returns a warning at 75% and 90% thresholds, which the executor posts to chat as a `budget_warning` message.

---

## The Auditor Agent

**File**: `src/lib/agents/auditor.ts`

Called at the end of each sprint (before marking it `completed`). Reviews the sprint's tasks and results against the sprint goal. Returns a structured `AuditResult`:
```typescript
{
  approved: boolean,
  score: number,           // 0-100
  summary: string,
  issues: AuditIssue[],    // severity: critical | major | minor | suggestion
  corrections: string[],
  recommendation: 'approve' | 'revise' | 'reject' | 'escalate'
}
```
If `approved: false`, the sprint is marked `rejected` and corrective tasks are added to the next sprint.

**Provider**: Gemini 2.5 Flash (default). Was previously defaulting to `anthropic` — fixed. The model sanitizer was catching this silently but the default is now correct.

---

## The Reporter

**File**: `src/lib/agents/reporter.ts`

Called once when a project reaches `completed` status. Generates a `ProjectReport` object and saves it to `projects.report` (JSONB column — requires Migration 002).

```typescript
interface ProjectReport {
  generated_at: string
  project: { id, name, tier, spec_score, stack }
  timing: { started_at, completed_at, duration_hours }
  budget: { tokens_used, tokens_budget, cost_used, budget_dollars, pct_used }
  sprints: SprintSummary[]
  agents: AgentSummary[]
  errors: ErrorEntry[]
  conflicts: ConflictSummary[]
  narrative: string  // AI-generated plain-English summary
}
```

The `narrative` field is generated by calling the Controller Agent with a structured summary of all the above data.

---

## The Skill System

**Files**: `src/lib/agents/skills/*.md` + `src/lib/agents/skill-loader.ts`

Agent identities are stored as structured markdown files — one per role — rather than inline TypeScript strings. This is the single source of truth for what each agent is, what it owns, and how it behaves.

### Skill File Format

```markdown
---
role: coder
display_name: Coder
description: One-sentence description shown in the UI.
icon: 💻
---

# Coder — Pantheon Agent Skill

## Identity
Who this agent is and its place in the team (1-2 paragraphs).

## Responsibilities
- Bulleted list of what this agent owns

## Behavioral Constraints
- Hard rules — what this agent must always or never do

## Output Format
How this agent structures its responses.

## User Context
<!-- USER_CONTEXT_PLACEHOLDER -->
```

### skill-loader.ts

Server-side module (uses `fs`). All 9 skill files are read and cached at module load — zero per-request I/O on the hot path.

- `loadSkill(role)` — returns the skill markdown body (placeholder intact)
- `injectUserContext(body, ctx)` — replaces `<!-- USER_CONTEXT_PLACEHOLDER -->` with the user's custom text, or removes the `## User Context` section cleanly if empty
- `getSkillDefinitions()` — full `RoleDefinition[]` including parsed frontmatter and body
- `ROLE_PROMPT_MAP`, `ROLE_DEFINITIONS`, `getRoleDefinition()` — backward-compatible exports

### Why skill files

- **Prompts are content, not code.** Editing a skill file doesn't require touching TypeScript or triggering a build.
- **Structured context injection.** User customizations slot into a designated section rather than being appended as a raw string.
- **Version control clarity.** A git diff on `coder.md` is immediately readable.

### Skills Library (installable specialists)

**Paths:** `src/lib/agents/skills-library/*.md` + `_index.ts` (metadata).

These are **bundled** markdown skills (14 roles across development / creative / analysis / process). They are **not** loaded as core `VALID_ROLES` in `skill-loader.ts`. Instead:

- `GET /api/agents/library` — catalog JSON
- `GET /api/agents/library/[id]` — full body for preview/install
- `GET/POST/DELETE /api/agents/skills` — persists installs in **`user_installed_skills`** (migration **005**)

On **`POST /api/projects`**, installed skills are passed into `analyzeSpec()`. Team members whose `role` matches a `library_id` are inserted as DB `agents` with `role = 'custom'` and `system_prompt` set to the stored `skill_content`. Task `role` in sprints can still reference the `library_id` for assignment; the create route maps those roles to the correct agent row.

### Editing skills

To change an agent's behavior, edit the corresponding `.md` file in `src/lib/agents/skills/`. The skill loader caches on module load, so in development a server restart picks up changes. On Vercel, each deployment bundles the current skill files (via `outputFileTracingIncludes` in `next.config.mjs`).

Do not remove the `<!-- USER_CONTEXT_PLACEHOLDER -->` line from any skill file — it is required for the `injectUserContext` function to work. If a skill file is missing this placeholder, user custom context will silently not inject.

---

## Model Sanitizer

**File**: `src/lib/agents/model-sanitizer.ts`

Critical runtime safety net. Called before every LLM call in the executor.

```typescript
sanitizeModel(provider: string, model: string): { provider: string; model: string }
```

Rules (in order):
1. `anthropic` provider → `gemini`, `gemini-2.5-flash`
2. Deprecated Fireworks models → `accounts/fireworks/models/llama-v3p3-70b-instruct`
3. Unknown provider (not fireworks/gemini) → `gemini`, `gemini-2.5-flash`
4. Otherwise: pass through unchanged

This means even if the DB has bad model data (from old project creation), agents will still run correctly.

---

## Sub-Team Spawning Protocol

The system supports recursive teams. When an agent decides a task needs a sub-team, it emits a `<spawn_team>` JSON block in its response:

```xml
<spawn_team>
{
  "name": "API Integration Sub-Team",
  "purpose": "Handle all third-party API integrations",
  "agents": [
    { "role": "coder", "display_name": "API Coder", "provider": "fireworks", "model": "...", "purpose": "..." },
    { "role": "reviewer", "display_name": "API Reviewer", ... }
  ],
  "tasks": [
    { "title": "...", "description": "...", "role": "coder" }
  ]
}
</spawn_team>
```

The executor parses this, creates the team/agents/tasks in the DB, and queues the sub-team's tasks. Sub-teams are depth-limited per tier:

| Tier | Max Depth |
|------|-----------|
| micro | 0 (no sub-teams) |
| small | 1 |
| medium | 2 |
| large | 3 |
| enterprise | unlimited |

**Current status**: The `<spawn_team>` parse logic is present in the executor. The sub-team creation DB flow is built. Sub-team execution (queuing and running sub-team tasks) needs validation in production — it has been implemented but not fully tested end-to-end.

---

## Agent Conflict Detection

**File**: `src/lib/engine/conflict-detector.ts`

Detects when two agents are working on overlapping tasks (same files, same functionality, same sprint scope). When detected:
1. Creates a `conflicts` row
2. Posts a `conflict` type message to `chat_messages`
3. If a Mediator agent exists in the team, routes the conflict to it
4. The Mediator produces a resolution plan, submitted to Auditor for approval
5. Resolution is posted to chat and the tasks are re-scoped

The conflict detection logic uses keyword matching on task titles/descriptions. A more sophisticated approach (semantic similarity, file path analysis) is on the roadmap.

---

## User-customizable agent prompts and roster UI

**Core roster (nine roles)**  
1. User opens **Agents** in the main nav (`/agents`) — `settings/agents` redirects here.
2. `GET /api/settings/roles` returns all nine skill definitions from `skills/*.md`.
3. Collapsible base skill (read-only) + textarea for `custom_context` → `POST /api/settings/agents` → `user_agent_profiles`.

**Skills Library (same page)**  
Browse/install/edit/remove specialist skills; data lives in `user_installed_skills`. Accordion sections collapse long-form guidance so roster stays visible.

4. At runtime: `executor.ts` loads `custom_context` for `agent.role` and calls `injectUserContext()` so text replaces `<!-- USER_CONTEXT_PLACEHOLDER -->` in the skill body.

Custom context **does not replace** the base skill file — it only fills the User Context section (or the same placeholder inside an installed library skill). Example use cases:
- "For the Coder agent: always use TypeScript strict mode and prefer functional patterns"
- "For the Reviewer agent: we are HIPAA-compliant — flag any PHI handling"
- "For the Controller agent: our team prefers Next.js 14 with App Router"
