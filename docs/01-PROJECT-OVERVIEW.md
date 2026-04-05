# Pantheon — Project Overview

## What Is Pantheon?

Pantheon is an AI-driven software development platform. Users describe what they want to build, and a team of specialized AI agents plans, executes, and delivers the project autonomously.

It is NOT a chatbot. It is NOT a code assistant. It is a full project orchestration engine where agents have roles, budgets, sprints, and accountability.

## The Core Loop

1. **User creates a project** via a **guided brief** (questions, stack chips, scope checkboxes, team-behavior toggles) composed into one spec — or a **single text box** for a full write-up (`/projects/new`)
2. **Controller Agent analyzes the spec**, scores it 1–5, determines the tier, and produces a structured JSON plan: team composition, sprint breakdown, task list
3. **A team is assembled** — agents are created in the DB with assigned roles and LLM models
4. **User clicks "Start project"** — the sprint executor runs tasks sequentially, each handled by the appropriate agent
5. **Agents communicate** via a shared chat feed (observable in real time)
6. **On completion**, the Controller Agent generates a structured report: timing, costs, errors, conflicts, narrative summary
7. **Deliverables** — when agents emit `<file path="…">` blocks, rows are saved to **`project_files`**; users browse and **download a zip** from the **Files** tab (migration **003**)
8. **Rerun** — completed / failed / paused / reviewing projects can be **reset from the overview** (confirmation via `AlertDialog`), then started again from sprint 1 with the same spec and team

## The Tier System

The spec score determines the project tier, which controls team size and sprint depth:

| Score | Tier | Agents | Max Depth | Sprints |
|-------|------|--------|-----------|---------|
| 1 | micro | 3 | 0 | 1 |
| 2 | small | 8 | 1 | 3 |
| 3 | medium | 20 | 2 | 8 |
| 4 | large | 50 | 3 | 20 |
| 5 | enterprise | unlimited | unlimited | unlimited |

## The Agent Roster

Nine defined roles. Each role's behavior is defined by a **Skill** (markdown in `src/lib/agents/skills/*.md`) loaded at runtime. Users can add **custom context** per role under Settings → Agent Roster (`user_agent_profiles` after Migration 002); it injects into the Skill's User Context section, it does not replace the Skill.

- **Controller** — orchestrates everything, plans teams, makes strategic decisions
- **Coder** — writes production-ready implementation code
- **Architect** — designs system structure, APIs, data schemas
- **Reviewer** — reviews code for quality, security, correctness
- **Researcher** — investigates approaches, compares libraries, recommends solutions
- **Auditor** — reviews completed sprints against spec, gates progress
- **Banker** — monitors token and dollar budget, enforces guardrails
- **Mediator** — resolves conflicts between agents
- **Custom** — specialist agent with role defined per-project

## User onboarding & support (in-app)

- **Help** in the top nav links to a **Help & learning** hub and article pages (`/help`, `/help/[slug]`), backed by `src/content/help/*.md`.
- **Quick help** is a small **chat-style assistant** (lower-right, logged-in only): keyword matching only, no LLM. See `00-INDEX.md` for a concise behavior table.

## What Makes This Different

1. **Recursive teams** — any agent can spawn a sub-team if it determines that improves quality or efficiency
2. **Budget guardrails** — the Banker agent monitors spend in real time and can hard-stop non-essential work
3. **Conflict detection** — if two agents collide on the same task, a meeting protocol triggers
4. **Observable chat** — users watch agents communicate in real time
5. **User-customizable prompts** — users can append custom context to any agent role (Agent Roster), scoped to their account; Skills remain the immutable core per role
6. **Cross-project memory** (planned) — the Controller remembers outcomes from past projects and improves over time

## The Name

Pantheon. A place where powerful entities dwell and work. The user is the architect of the pantheon — they decide what gets built, the agents do the building.

## Current State (as of April 2026)

The platform is functional end-to-end:
- **Guided new project** — `/projects/new` composes a structured spec from cards + optional **single text box** mode; `src/lib/projects/brief-spec.ts` ✅
- Project creation → Controller analysis → team/sprint/task generation ✅
- Sprint execution with real Gemini + Fireworks agents ✅
- Real-time chat feed ✅
- Budget tracking ✅
- **Agent Skills** — prompts live in `src/lib/agents/skills/*.md`; `skill-loader.ts` + optional user context injection ✅
- **Help & learning** — `/help` guides from `src/content/help/` ✅
- **Quick help** — logged-in-only, rule-based assistant bubble; session transcript; no chips ✅
- **Deliverables** — `file-extractor.ts` + `persist-task-files.ts`; **Files** tab + per-file + zip (`jszip`); requires DB migration **003** ✅
- **Rerun project** — overview + `AlertDialog` confirm → `POST /api/projects/[id]/rerun` ✅
- Completion report generation ✅ (needs DB migration **002** for `projects.report`)
- Agent Roster with custom prompts ✅ (needs migration **002** for `user_agent_profiles`)
- User account system ❌ (not built)
- Dashboard with stats ❌ (not built)
- Memory system ❌ (designed, not built)
- Hosted previews / Git push / Storage offload for huge artifacts ❌ (future)
