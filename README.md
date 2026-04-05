# Pantheon

**AI-orchestrated software development platform.**

You write a spec. Pantheon assembles a team of specialist AI agents — Controller, Architect, Coders, Reviewer, Auditor, Banker — and runs them against your project in coordinated sprints. Agents collaborate, spawn sub-teams when needed, negotiate conflicts, and get reviewed at every milestone. You watch it happen in real time.

> **v0.9.0-beta** — This is an early public release. Core execution works. Some advanced features (background jobs, Git integration, live preview) are on the roadmap.

---

## How it works

```
You write a spec
        ↓
Controller Agent scores it 1–5 and assigns a resource tier
        ↓
Controller plans sprints, tasks, and assembles the right team
        ↓
Agent team executes — Coders build, Reviewer inspects, Architect designs
        ↓
Banker Agent monitors every token and dollar in real time
        ↓
Conflict detected → Meeting Protocol → Auditor approval
        ↓
Sprint complete → Auditor reviews → gate opens or corrections required
        ↓
Deliverable files extracted into the Files tab → download as zip
```

### Resource tiers (spec quality unlocks team size)

| Tier       | Spec Score | Agents | Sprints | Default Budget |
|------------|-----------|--------|---------|---------------|
| micro      | 1/5        | 3      | 1       | $1            |
| small      | 2/5        | 8      | 3       | $5            |
| medium     | 3/5        | 20     | 8       | $25           |
| large      | 4/5        | 50     | 20      | $100          |
| enterprise | 5/5        | ∞      | ∞       | $250          |

Better spec → more powerful team. Write with precision.

---

## Prerequisites

- **Node.js** 18.17 or later
- **pnpm** (`npm install -g pnpm`)
- **Supabase account** — [free tier at supabase.com](https://supabase.com)
- **At minimum one LLM provider API key:**
  - [Google AI Studio](https://aistudio.google.com/apikey) (Gemini — free tier, used by Controller/Auditor)
  - [Fireworks AI](https://fireworks.ai) (Llama models — free tier, used by Coders/Banker)
  - [Anthropic](https://console.anthropic.com) (Claude — optional, not default in v0.9)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/iAmBalanceAR/pantheon.git
cd pantheon
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to provision (about 1 minute)
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Run the database schema

In your Supabase project, go to **SQL Editor → New query**.

Copy the entire contents of `supabase/schema.sql` and run it.

This creates all tables, RLS policies, indexes, and realtime subscriptions in a single pass. It is idempotent — safe to run again if anything goes wrong.

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```env
# Required — from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required — at least one LLM provider
GOOGLE_API_KEY=AIza...        # for Controller + Auditor agents
FIREWORKS_API_KEY=fw_...      # for Coder + Banker agents
```

See `.env.example` for the full list of options including model overrides.

### 6. Enable Supabase Auth

In your Supabase dashboard:

1. Go to **Authentication → Providers**
2. Ensure **Email** provider is enabled (it is by default)
3. Under **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/**`

### 7. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Create an account, write a spec, and run your first project.

---

## Writing a good spec

The Controller scores your spec 1–5 before assembling the team. Score directly determines team size and sprint count. Here is how to hit each tier:

**Score 1 (micro):** A single vague sentence with no stack or constraints.
> "Build me a todo app."

**Score 3 (medium):** Clear goal, implied stack, some acceptance criteria.
> "Build a React landing page for a SaaS product. Include a hero section, feature grid, pricing table with 3 tiers, and a contact form that posts to /api/contact. Use Tailwind CSS. Mobile-first layout."

**Score 5 (enterprise):** Formal spec with architecture, acceptance criteria, performance requirements, security considerations, and explicit stack.

**Tips for better specs:**
- Name your stack explicitly: `"Next.js 14, Supabase, Tailwind CSS"` beats `"a web app"`
- State acceptance criteria: `"Clicking Submit posts to /api/contact and shows a success toast"`
- Mention non-functional requirements: `"Must work without JavaScript"`, `"mobile-first layout"`
- Flag scope boundaries: `"Do not add authentication"`, `"this sprint only covers the landing page"`

---

## Agent roles

| Role        | Responsibility |
|-------------|---------------|
| Controller  | Scores the spec, plans sprints, assembles the team, orchestrates execution |
| Coder       | Implements tasks — writes code, markup, copy, data models |
| Architect   | High-level design, system structure, technical decisions (medium+ tiers) |
| Reviewer    | Code review, standards enforcement, output quality (medium+ tiers) |
| Auditor     | Sprint review and gate — approves or rejects before advancing |
| Banker      | Monitors token and dollar spend, enforces budget guardrails |
| Researcher  | Gathers context, investigates unknowns, informs other agents |
| Mediator    | Resolves inter-agent conflicts via the meeting protocol |
| Custom      | User-defined agents — assign any role from the Skills Library |

---

## Skills Library

The Agents page includes a built-in Skills Library with 14 specialist agent types across four categories:

- **Development:** Mobile Developer, DevOps Engineer, Security Engineer, Data Engineer, API Designer, Python Developer, Database Administrator
- **Creative:** Copywriter, Technical Writer, UX Writer
- **Analysis:** Data Analyst, Business Analyst
- **Process:** QA Engineer, Product Manager

Install a skill to make it available as a named agent type in your projects. Installed skills can be edited to inject your own domain context.

---

## Deliverable files

Agents emit deliverable files inside `<file path="...">` blocks in their task output. Pantheon extracts these automatically. Browse and download them as a zip from the **Files** tab on any project page.

For web projects:
- Agents output `index.html`, `styles.css`, `scripts.js` as separate `<file>` blocks
- Images use hotlinked URLs from free stock sources (Unsplash, Pexels, Shopify Burst) — no binary assets required

---

## Project structure

```
src/
  app/
    (auth)/
      login/              Auth pages
      signup/
    (dashboard)/
      projects/           Project list and new project wizard
      projects/[id]/      Project overview with real-time updates
      projects/[id]/chat  Live agent communication feed
      projects/[id]/files Deliverable files browser and zip download
      projects/[id]/team  Team visualization
      projects/[id]/budget Banker dashboard
      agents/             Skills library and agent roster customization
      settings/           Platform configuration
    api/
      projects/           Project CRUD + spec analysis
      projects/[id]/run   Sprint execution (chains all sprints server-side)
      agents/library/     Skills library browser API
      agents/skills/      User installed skills API
      settings/           Agent profiles and platform settings
  lib/
    supabase/             Client, server, and service role clients
    llm/                  Anthropic, Fireworks, Gemini provider wrappers
    agents/
      skills/             Core agent skill markdown files (immutable)
      skills-library/     Installable specialist skills (14 included)
      controller.ts       Spec analysis and team planning
    engine/
      executor.ts         Task execution loop
      persist-task-files.ts  Deliverable extraction
      deliverable-refs.ts    Multi-file consistency checker
  types/index.ts          Shared types and tier configuration
supabase/
  schema.sql              Complete database schema (run once to set up)
  migrations/             Individual migration files (historical reference)
docs/                     Architecture and development documentation
```

---

## Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `GOOGLE_API_KEY` | ✅* | Gemini API key — required for Controller/Auditor |
| `FIREWORKS_API_KEY` | ✅* | Fireworks API key — required for Coder/Banker |
| `ANTHROPIC_API_KEY` | Optional | Claude API key (not used by default in v0.9) |
| `CONTROLLER_PROVIDER` | Optional | Override Controller provider (`gemini`/`fireworks`) |
| `CONTROLLER_MODEL` | Optional | Override Controller model |
| `AUDITOR_PROVIDER` | Optional | Override Auditor provider |
| `AUDITOR_MODEL` | Optional | Override Auditor model |
| `CODER_PROVIDER` | Optional | Override default Coder provider |
| `CODER_MODEL` | Optional | Override default Coder model |
| `BANKER_PROVIDER` | Optional | Override Banker provider |
| `BANKER_MODEL` | Optional | Override Banker model |
| `NEXT_PUBLIC_APP_URL` | Optional | App base URL (default: `http://localhost:3000`) |

*You need at least one of Gemini or Fireworks, but both are recommended for the default agent configuration.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Auth + Database | Supabase (PostgreSQL + Auth + Realtime) |
| Styling | Tailwind CSS + Radix UI |
| LLM Providers | Google Gemini, Fireworks AI, Anthropic |
| Language | TypeScript |
| Package manager | pnpm |

---

## Deploying to Vercel

1. Push the repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example` to the Vercel project settings
4. In your Supabase project **Authentication → URL Configuration**, add your Vercel deployment URL to Redirect URLs

---

## Roadmap

- [ ] Background job runner (async agent execution — non-blocking API routes)
- [ ] Live preview for web deliverables
- [ ] Git integration (agents commit to branches, merge conflict detection)
- [ ] Model selection UI per project (override which model each role uses)
- [ ] Webhook notifications (Slack, Discord on sprint completion)
- [ ] Team templates (save and reuse proven team configurations)

---

## Contributing

Contributions are welcome. Please open an issue before submitting a large pull request so we can discuss the approach.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and ensure `pnpm build` passes
4. Open a pull request with a clear description of what changed and why

---

## License

MIT — see [LICENSE](LICENSE) for details.
