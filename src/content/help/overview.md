---
title: What is Pantheon?
description: How the platform works at a glance — not a chatbot, but a full project engine.
order: 10
---

Pantheon is an **AI-driven software development platform**. You describe what you want to build; a team of specialized AI agents plans the work, runs it in **sprints**, and tracks **budget**, **progress**, and **quality** — all in one place. Code and other file-shaped work lands in the **Files** tab; download everything as a **zip** when you're ready to run or edit it locally.

This is **not** a general-purpose chat assistant. It is built for **end-to-end project execution**: structured plans, assigned roles, observable teamwork, and clear completion.

## What you can do

- **Create a project** from a short idea or a detailed specification.
- **Start execution** and watch agents work through **sprints** and **tasks**.
- **Follow the chat** to see decisions, warnings, and results in real time.
- **Open Files** to browse agent-delivered paths and grab a **zip** of the current tree (after your database includes deliverables support — see FAQ).
- **Review budget** (tokens and dollars) and adjust limits where your project allows it.
- **Tune agent behavior** with optional custom instructions in **Settings → Agent Roster** (per role, across all your projects).

## The core loop (simple)

1. You submit a **spec** when creating a project.
2. The **Controller** analyzes it, scores complexity, picks a **tier**, and proposes a **team**, **sprints**, and **tasks**.
3. You **start** the project; agents run tasks in order, posting to a shared **chat**.
4. When work finishes, open **Files** for deliverables (zip) and the **Report** tab for a structured summary (reports need the migration that adds `projects.report`; deliverables need `project_files` — see FAQ).

## Where to go next

- [Projects and sprints](/help/projects-and-sprints) — tiers, start/pause, what "running" means.
- [Agents and skills](/help/agents-and-skills) — who does what and how your custom instructions fit in.
- [Budget and usage](/help/budget-and-usage) — warnings, hard stops, and what the numbers mean.
- [Troubleshooting](/help/troubleshooting) and [FAQ](/help/faq) — when something looks wrong.
