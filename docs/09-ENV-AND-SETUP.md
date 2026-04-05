# Pantheon — Environment and Setup

## Prerequisites

- Node.js 18+ 
- pnpm (not npm, not yarn)
- A Supabase project (cloud)
- Google AI Studio API key (for Gemini)
- Fireworks AI API key

`pnpm install` pulls **`jszip`** (used by `/api/projects/[id]/files/zip`). Apply migration **`003_project_files.sql`** in Supabase for that route and the **Files** tab to work.

---

## Environment Variables

File: `.env.local` (in project root — never commit this)

```bash
# Supabase — cloud project
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...    # Present but UNUSED — no credits
FIREWORKS_API_KEY=fw_...
GOOGLE_API_KEY=AIza...

# Agent model assignments
CONTROLLER_MODEL=gemini-2.5-flash
CONTROLLER_PROVIDER=gemini

AUDITOR_MODEL=gemini-2.5-flash
AUDITOR_PROVIDER=gemini

CODER_MODEL=accounts/fireworks/models/llama-v3p3-70b-instruct
CODER_PROVIDER=fireworks

BANKER_MODEL=accounts/fireworks/models/llama-v3p3-70b-instruct
BANKER_PROVIDER=fireworks

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Key notes:
- `NEXT_PUBLIC_*` variables are exposed to the browser. Never put secrets in NEXT_PUBLIC vars.
- `SUPABASE_SERVICE_ROLE_KEY` is for server-only use (API routes). Never expose it client-side.
- `ANTHROPIC_API_KEY` is present but the model sanitizer and controller prompt ensure it's never called. Keep it in case credits are restored.
- The `CONTROLLER_MODEL` and `CONTROLLER_PROVIDER` env vars are the defaults; the DB values for each agent can override them per-project.

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production check
pnpm build

# Start production server
pnpm start
```

Dev server runs at `http://localhost:3000`.

---

## Database Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com), create a new project. Copy the URL, anon key, and service role key into `.env.local`.

### 2. Apply Migration 001

In the Supabase Dashboard → SQL Editor, run the contents of:
```
supabase/migrations/001_initial.sql
```

This creates all tables, RLS policies, and triggers.

### 3. Apply Migration 002 (REQUIRED for reports + agent customization)

In the Supabase Dashboard → SQL Editor, run the contents of:
```
supabase/migrations/002_agent_profiles_and_reports.sql
```

This adds:
- `report JSONB` column to `projects`
- `user_agent_profiles` table with RLS

### 4. Enable Realtime

In Supabase Dashboard → Database → Replication:
- Enable replication for: `projects`, `agents`, `sprints`, `tasks`, `chat_messages`

Without this, the real-time subscriptions in the UI will not receive updates.

---

## Supabase Auth Setup

1. In Supabase Dashboard → Authentication → Providers
2. Ensure "Email" provider is enabled
3. Optionally disable "Confirm email" for easier local testing (Authentication → Settings)
4. The login page at `/login` handles both sign-in and sign-up

---

## Clearing the Build Cache

If you see module-not-found errors or webpack errors after file changes:

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .next
pnpm dev
```

This is required after:
- Deleting or renaming source files
- Changing the `src` directory structure
- Major dependency updates

---

## LLM API Keys

### Google AI Studio (Gemini)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Create API key
3. Set as `GOOGLE_API_KEY`

Model used: `gemini-2.5-flash`  
Note: `thinkingBudget: 0` is set in `src/lib/llm/gemini.ts` to disable extended thinking and keep costs/latency low.

### Fireworks AI
1. Go to [fireworks.ai](https://fireworks.ai)
2. Create API key
3. Set as `FIREWORKS_API_KEY`

Model used: `accounts/fireworks/models/llama-v3p3-70b-instruct`  
**Important**: Only use `llama-v3p3-70b-instruct`. The v3p1 and v3p3-8b variants are deprecated on Fireworks' current tier.

### Anthropic (Disabled)
The key is present in `.env.local` but the system never uses it. `model-sanitizer.ts` intercepts any Anthropic calls and remaps to Gemini. Do not attempt to re-enable Anthropic without first verifying API credits.

---

## Project Structure for New Features

When adding a new page:
- Place under `src/app/(dashboard)/` for authenticated pages
- Place under `src/app/(auth)/` for public pages
- Always add an `error.tsx` sibling for error boundary coverage
- For new DB queries, use `createClient()` from `@/lib/supabase/server` in server components and `createClient()` from `@/lib/supabase/client` in client components

When adding a new API route:
- Place under `src/app/api/`
- Add `export const maxDuration = 300` if it calls LLM agents
- Always verify auth at the top: `const { data: { user } } = await supabase.auth.getUser()`
- Use service role for cross-user operations: `createServiceClient()` from server.ts
- Return consistent error shape: `{ error: string, detail?: string }`

When adding a new agent function:
- Place in `src/lib/agents/`
- Always call `sanitizeModel()` before calling `callLLM()`
- Always use `ROLE_PROMPT_MAP[role]` as the base system prompt
- Test with a micro-tier project first (1 agent, 1 sprint, 1 task)

---

## Vercel Deployment

When deploying to Vercel:
1. Set all `.env.local` variables as Vercel environment variables
2. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL
3. `maxDuration = 300` is respected on Vercel Pro; on Hobby plan the limit is 60s
4. Ensure Supabase allows the Vercel deployment domain in CORS settings
5. Skill and Help markdown are read with Node `fs` at runtime — `next.config.mjs` already sets `experimental.outputFileTracingIncludes` for `./src/lib/agents/skills/**/*.md` and `./src/content/help/**/*.md` so those paths are traced into the serverless bundle. If you add another content directory read the same way, extend that list.

---

## Common pnpm Commands

```bash
pnpm add [package]          # Add dependency
pnpm add -D [package]       # Add dev dependency
pnpm remove [package]       # Remove dependency
pnpm type-check             # Run TypeScript compiler check (no emit)
pnpm lint                   # Run ESLint
```
