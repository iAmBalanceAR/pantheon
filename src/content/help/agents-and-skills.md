---
title: Agents and skills
description: The nine roles, what Skills are, and how your custom instructions are applied.
order: 30
---

## The nine roles

Each project team is made of **agents**. Every agent has a **role**. Pantheon defines nine roles; each has a fixed **purpose** in the pipeline:

| Role | In one sentence |
|------|------------------|
| **Controller** | Plans work, delegates, and keeps the project aligned with the spec. |
| **Coder** | Implements features and produces structured code output when asked. |
| **Architect** | Shapes structure, APIs, and technical direction. |
| **Reviewer** | Checks quality, risks, and fit to the task. |
| **Researcher** | Compares options and evidence before big commitments. |
| **Auditor** | Reviews sprint outcomes against the spec and can gate progress. |
| **Banker** | Tracks usage and enforces budget rules (warnings and hard stops). |
| **Mediator** | Helps resolve conflicts between agents when they arise. |
| **Custom** | A specialist role defined for that project by the Controller. |

Models vary by role and by your environment; governance-heavy roles often use fast, structured models suited to planning and review.

## What is a Skill?

In Pantheon, a **Skill** is the **structured instruction set** for a role: who the agent is, what it must do, what it must avoid, and how it should format output (for example code file blocks).

Skills are the **source of truth** for agent behavior. They keep behavior **consistent** and **documented** so the product can evolve without turning prompts into hidden one-off strings.

**You do not edit Skills from the UI** — they ship with the product. What **you** control is described below.

## Your custom context (Agent Roster)

Under **Settings → Agent Roster**, you can add **custom context per role**. Examples:

- Prefer TypeScript strict mode and functional style for all Coders.
- Flag HIPAA-sensitive patterns for Reviewers.
- Tell the Controller your default stack (for example Next.js 14 App Router).

That text is **not** a replacement for the Skill. It is injected into a dedicated **User context** section when an agent of that role runs, **for your account**, across **all your projects**.

If nothing is saved for a role, agents still run with the full Skill only.

## File-style output (Coder / Custom)

Coder and Custom agents are instructed to wrap file contents like this when delivering code:

```
<file path="relative/path/to/file.tsx">
… full file contents …
</file>
```

Pantheon **extracts** these blocks into the project **Files** tab after each task completes (same paths are updated if a later task overwrites them). Use **Download all (.zip)** there to pull the full tree. Requires the `project_files` database migration — see FAQ if Files shows a setup message.

## Sub-teams (advanced)

For larger tiers, the Controller may decide a **sub-team** helps quality or speed. That appears as structured output the runtime can use to add more agents and tasks. Behavior can be complex; if something unexpected happens, check [Troubleshooting](/help/troubleshooting).
