---
title: Budget and usage
description: Tokens, dollars, warnings, hard stops, and how to spend safely.
order: 40
---

## Two meters

Every project tracks:

- **Tokens** — rough volume of language-model input + output.
- **Dollars (cost)** — estimated spend against your configured **dollar budget**.

You set budgets in **project settings** (and may have defaults from your environment). The **Banker** role enforces rules based on these numbers.

## Warnings

As usage climbs, you may see **budget_warning** messages in **Chat**. These are informational: work may continue, but you should expect a **hard stop** if usage keeps rising.

Typical thresholds are communicated in-product (for example around **75%** and **90%** of dollar budget). Exact numbers depend on implementation and configuration.

## Hard stop

Near the top of the dollar budget (often around **95%**), the system may **block non-critical work** to prevent runaway cost. You will see a clear **Banker** message in chat when that happens.

**What to do:** Pause the project, raise the budget in **project settings** if appropriate, or simplify remaining work (fewer sprints / tasks) before resuming.

## Per-agent usage

The **Budget** tab shows how usage spreads across agents. If one role dominates cost, consider a **lighter model** for that role in **project settings**, or tighten the spec so fewer iterations are needed.

## Not financial advice

Displayed costs are **estimates** from internal pricing tables. Your actual bill depends on your provider accounts and any platform fees outside Pantheon.
