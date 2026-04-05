---
title: Projects and sprints
description: Creating projects, tiers, sprint flow, pause and resume, and the project tabs.
order: 20
---

## Creating a project

Go to **Projects → New** (or use **New** in the top bar). Paste your **spec**: anything from one sentence to a long document. Submitting triggers **analysis**: the system plans team size, sprints, and tasks based on how detailed your spec is.

After creation you land on the **project overview**. From there you can **start** or **continue** work, open **Chat**, **Team**, **Budget**, **Settings**, or **Report**.

## Tiers and complexity

Your spec receives a **score** (1–5). That maps to a **resource tier** (for example micro → enterprise). The tier influences **how large the team can be**, **how deep sub-teams may go**, and **how many sprints** are typical. You do not pick the tier manually; the analysis does, based on your spec.

**Tip:** Clear goals, explicit stack choices, and acceptance criteria usually produce a more accurate plan and smoother execution.

## Sprints and tasks

Work is grouped into **sprints**. Each sprint has a **goal** and a list of **tasks**. Tasks are assigned to **agents by role** (Coder, Architect, Reviewer, and so on).

When you **start** the project, the system runs the next pending sprint: tasks are executed **in sequence** (with budget and pause checks between steps). The UI may call the run endpoint multiple times until the current batch is done.

## Pause and resume

You can **pause** a running project from the project header (or from the project list when available). While paused, new agent work is blocked until you **resume**. This is useful when you need to change settings, read the chat, or stop spend.

## Project tabs (what each is for)

| Tab | Purpose |
|-----|---------|
| **Overview** | Status, start/continue, sprint list, quick view of activity |
| **Chat** | Live feed of agent messages, system events, budget warnings |
| **Team** | Agents, roles, models, status |
| **Budget** | Token and dollar usage and budget events |
| **Settings** (project) | Rename, budget caps, per-agent model overrides for this project |
| **Report** | Completion report when available |

Platform-wide preferences (including **Agent Roster**) live under **Settings** in the top navigation, not inside a single project.
