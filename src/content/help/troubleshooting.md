---
title: Troubleshooting
description: Common issues — runs stuck, chat quiet, reports missing, budget blocks, and UI oddities.
order: 60
---

Work through these in order. Most issues are **configuration**, **budget**, or **expectations** about how batch execution works.

## The project will not start or stops immediately

1. **Paused?** Resume from the project header.
2. **Budget hard stop?** Open **Chat** for a Banker message. Check **Budget** and raise caps or pause until you adjust the plan.
3. **Browser session?** Sign out and back in if API calls return unauthorized errors.

## Chat is empty but the project says active

- Execution might be between **run** batches. Wait a few seconds and check **Overview** for sprint progress.
- If it stays empty for a long time, check **Budget** and **Team** for failed agents. Your host logs (if you self-host) will show LLM or database errors.

## "Running" forever / no progress

- A single **run** request has a **time limit** on hosted deployments. The app is designed to **call run again** until work completes. If the loop stops (closed tab, network error), open the project and press **Continue** / **Start** again.
- Very large projects may need multiple cycles; watch token and dollar usage.

## Report tab is empty or errors

- Completion **reports** require your database to include the **report** field and related migrations. If your administrator has not run migrations, report generation may fail silently or show placeholders. Ask them to verify schema and server logs.
- You can try any **regenerate report** action your UI exposes after the project is **completed**.

## Custom instructions seem ignored

1. Confirm you **saved** **Settings → Agent Roster** for that **role**.
2. Custom context applies to **tasks executed after** saving; it does not rewrite past messages.
3. Skills define hard behavior; your text only augments the **User context** section. If instructions conflict with the Skill, the Skill still wins on safety and output shape.

## Models or providers errors

- Pantheon may be configured for specific providers (for example **Gemini** and **Fireworks** only). Invalid provider names coming from old data can be **sanitized** at runtime, but you should set **fireworks** or **gemini** in project agent settings.
- Check **Settings** and **Project → Settings** for API keys if calls fail with authentication errors.

## Real-time feels stale

- Rarely, a subscription may miss an update. **Refresh** the page.
- If stale state persists, your Supabase project must have **realtime** enabled on the relevant tables (`projects`, `agents`, `chat_messages`, etc. per your deployment guide).

## Still stuck?

Gather: **project id**, what you clicked, **screenshot of Chat** (last messages), and **Budget** totals. If you self-host, include the **server error** line from the run that failed. Then contact your administrator or support channel.
