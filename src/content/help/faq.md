---
title: FAQ
description: Short answers to the questions people ask first.
order: 70
---

## Is Pantheon a chatbot?

**No.** You can chat in the project feed, but the product is built around **projects**, **sprints**, **tasks**, and **agents with roles**. The value is structured execution, not a single thread with a model.

## Who decides how big my team is?

The **Controller** analyzes your spec and proposes a **tier** and **team**. You can adjust some execution parameters (like models per agent on a project), but the core plan comes from that analysis.

## Can I change an agent's personality?

You add **custom context** per role under **Settings → Agent Roster**. You cannot delete or replace the built-in **Skill** for a role; you only add your preferences and constraints in the user section.

## Why multiple AI models?

Different steps need different strengths: fast structured planning vs. heavier coding workloads. Pantheon assigns **providers and models per role** to balance quality, speed, and cost.

## What happens if I hit my budget?

You usually get **warnings** first, then a **hard stop** that blocks further non-critical work. See [Budget and usage](/help/budget-and-usage).

## Can agents access my GitHub or my laptop?

**Not by default.** Pantheon runs against **your spec** and **messages** you see in the product. Integrations such as GitHub or local file writes are **not** assumed in the base product; treat outputs as text until your deployment adds tooling.

## Is my data private?

Your data lives in **your** Supabase project and app deployment when you self-host or use a dedicated environment. Review your org's privacy policy and hosting setup for retention and access.

## How do I get a zip of all generated files?

Open the project's **Files** tab → **Download all (.zip)**. Files appear when agents complete tasks using structured `<file path="…">` blocks (the Coder is trained for this). Your workspace needs database migration **003** (`project_files` table); if the tab shows a setup error, apply `supabase/migrations/003_project_files.sql` in Supabase. You can still copy raw output from **Live Feed** if needed.

## What is "Quick help" (the chat bubble)?

It is a **simple topic matcher**, not a large language model. Type a question in your own words; it compares text to a small fixed list of topics. Your **conversation is kept for this browser tab** until you close the tab. There is **no extra API cost** — it runs in the browser. There are **no multiple-choice buttons**; if you repeat the exact same question right after asking it, it will point you back to the previous answer instead of spinning loops.

## Where is the developer documentation?

Internal engineering docs live in the repository **`docs/`** folder for builders, not in this Help center. This Help center is for **people using Pantheon day to day**.
