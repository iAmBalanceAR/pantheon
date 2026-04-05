# Pantheon — Known Bugs and Fixes

A log of bugs encountered, root causes, and how they were resolved. New agents should read this before making changes to the areas listed.

---

## Bug 1: Webpack Module Error After File Deletions

**Error**: `TypeError: __webpack_modules__[moduleId] is not a function`

**When it appeared**: After deleting/renaming the old sidebar and topbar components.

**Root cause**: Next.js build cache (`.next` directory) had stale module references to deleted files.

**Fix**:
1. Kill all Node processes
2. Delete `.next` directory entirely
3. Restart dev server with `pnpm dev`

**Prevention**: Any time you delete or rename files that were previously imported, clear the `.next` cache before testing.

---

## Bug 2: Anthropic API Credits Exhausted

**Error**: `"Your credit balance is too low to access the Anthropic API."`

**When it appeared**: During sprint execution whenever an agent was assigned `provider: 'anthropic'`.

**Root cause**: The Controller Agent's `SPEC_SCORING_PROMPT` was recommending Anthropic models (claude-*) for some agent roles. No Anthropic credits are available.

**Fix (layered)**:
1. Updated `SPEC_SCORING_PROMPT` in `controller.ts` to explicitly say "DO NOT use anthropic" and only recommend `fireworks` and `gemini` models
2. Removed `anthropic` from `VALID_PROVIDERS` in `POST /api/projects`
3. Removed `anthropic` from the providers list in `/projects/[id]/settings` UI
4. **Created `src/lib/agents/model-sanitizer.ts`**: Hard remaps any `anthropic` provider → `gemini`, `gemini-2.5-flash` at runtime in the executor

The model sanitizer is the final safety net. Even if the DB somehow has `provider: 'anthropic'`, the sanitizer catches it before the LLM call.

**Current state**: Anthropic code exists (`src/lib/llm/anthropic.ts`) but is never reached. Do not remove it — credits may be restored.

---

## Bug 3: Fireworks "Model Not Found" Errors

**Error**: `"404 Model not found, inaccessible, and/or not deployed"`

**When it appeared**: Agents assigned `llama-v3p1-70b-instruct`, `llama-v3p1-8b-instruct`, or other deprecated Fireworks models.

**Root cause**: The Controller was recommending deprecated Fireworks model strings in its JSON output.

**Fix**:
1. Updated `SPEC_SCORING_PROMPT` to only recommend `accounts/fireworks/models/llama-v3p3-70b-instruct`
2. `model-sanitizer.ts` remaps all known deprecated Fireworks models to `llama-v3p3-70b-instruct`

---

## Bug 4: Gemini "First content should be with role 'user', got model"

**Error**: `[GoogleGenerativeAI Error]: First content should be with role 'user', got model`

**When it appeared**: Intermittently during sprint execution, particularly on tasks where chat history had been accumulating.

**Root cause**: Gemini's chat API has strict requirements:
- History must START with a `user` turn
- Turns must STRICTLY ALTERNATE user → model → user → …
- The final message goes via `sendMessage()`, not in history

When `chat_messages` from the DB contained leading assistant messages or consecutive same-role messages, Gemini rejected the history.

**Fix** (in `src/lib/llm/gemini.ts`):
1. **Drop leading model turns**: After mapping assistant → model, strip any leading `model` turns from history
2. **Merge consecutive same-role turns**: If two `user` turns are adjacent, concatenate their content with `\n`
3. **Handle trailing user turns in history**: If history ends with a `user` turn (which would cause user→user), pop it from history and prepend it to the `sendMessage` content

This preprocessing runs on every Gemini call. Never bypass it.

---

## Bug 5: Budget Bar Stuck at 9%

**Symptom**: The budget progress bar in the project header showed a fixed percentage and never updated during agent execution.

**Root cause**: The `ProjectHeader` component was initialized with server-fetched project data and had no live subscription. `cost_used` and `budget_dollars` were static from page load.

**Fix**: Added a Supabase Realtime subscription in `project-header.tsx` that listens for `UPDATE` events on the project's row and calls `setProject(p => ({ ...p, ...payload.new }))`.

**Secondary issue**: The `isRunning` check was `project.status === 'running'` but the DB uses `'active'` for running projects.

**Fix**: `isRunning = project.status === 'active' || project.status === 'running'`

**Note**: The meta row (status/tier/budget bar) was subsequently commented out at the user's request — it became redundant with the inline RunTicker. The Realtime subscription and the `isRunning` fix are still live and correct.

---

## Bug 6: Completed Projects Not Showing in List

**Symptom**: Projects with `status: 'completed'` were not appearing in any section of the project list.

**Root cause**: In `src/app/(dashboard)/projects/page.tsx`, the `PROJECT_GROUPS` definition used the string `'complete'` (without the 'd') but the DB uses `'completed'`.

**Fix**: Corrected to `'completed'`. Always verify status strings against the DB `CHECK` constraint in `001_initial.sql`.

**DB constraint**: `status IN ('scoping','active','paused','reviewing','completed','failed')` — note there is no `'running'` status in the constraint, though code checks for it. `'active'` is the DB value for a running project.

---

## Bug 7: CSS Parsing Error with `@apply border-border`

**Symptom**: CSS compilation errors, some styles not applying.

**Root cause**: Using `@apply border-border` inside the `*` selector in `globals.css` caused PostCSS parsing issues in certain versions.

**Fix**: Replaced with direct property:
```css
* {
  border-color: hsl(var(--border));
}
```

Do not use `@apply` on the universal selector.

---

## Bug 8: `supabase` not awaited in Server Component

**Symptom**: TypeScript error and runtime failure in `src/app/(dashboard)/projects/[id]/layout.tsx`

**Root cause**: `createClient()` from `server.ts` returns a Promise but the layout was calling it without `await`.

**Fix**: Changed to `const supabase = await createClient()` in all server-side layouts and API routes.

---

## Bug 9: Auditor Agent Defaulting to Anthropic Provider

**Symptom**: Every sprint audit silently routed through the model sanitizer, which remapped the request to Gemini. No visible error, but the intent was wrong and the sanitizer log noise was misleading.

**Root cause**: `src/lib/agents/auditor.ts` had:
```typescript
const AUDITOR_PROVIDER = (process.env.AUDITOR_PROVIDER ?? 'anthropic') as LLMProvider
const AUDITOR_MODEL    = process.env.AUDITOR_MODEL ?? 'claude-haiku-4-5'
```
The default was `anthropic` — a provider with no credits and no valid models in the current environment.

**Fix**: Changed defaults to match the rest of the system:
```typescript
const AUDITOR_PROVIDER = (process.env.AUDITOR_PROVIDER ?? 'gemini') as LLMProvider
const AUDITOR_MODEL    = process.env.AUDITOR_MODEL ?? 'gemini-2.5-flash'
```

**Why it wasn't breaking**: The model sanitizer in `executor.ts` catches `anthropic` provider and remaps it to Gemini before the LLM call. The auditor calls `callLLM` directly (not through the executor), so the sanitizer was NOT in the path — this would have thrown a credit error on any deployment with live Anthropic credits. It was only safe because there are no credits.

---

## Bug 10: Skill File USER_CONTEXT_PLACEHOLDER Injection

**Watch out for**: If a skill file in `src/lib/agents/skills/` is edited and the `<!-- USER_CONTEXT_PLACEHOLDER -->` comment is removed or renamed, `injectUserContext()` in `skill-loader.ts` will silently skip injection. The user's custom context will not appear in the system prompt and no error will be thrown.

**Mitigation**: The `injectUserContext` function falls back gracefully (no crash), but the behavior is wrong. If a user reports "my custom instructions aren't working," check that the placeholder is present in the relevant skill file.

---

## Ongoing Risks / Watch Points

### Gemini thinkingBudget
`thinkingBudget: 0` is set to disable Gemini 2.5 Flash's extended thinking mode. This significantly reduces cost and latency. If thinking is accidentally enabled, costs will spike. This is set in `src/lib/llm/gemini.ts` `generationConfig`.

### maxDuration
API routes that run agents have `export const maxDuration = 300`. This is the Vercel serverless limit (5 minutes). For very large projects (many sprints, many tasks), a single `/run` call may not complete all tasks. The frontend re-calls `/run` on each response until `done: true` is returned. Do not increase maxDuration above 300 — Vercel doesn't allow it without Pro plan changes.

### Supabase Realtime Channels
Each component that subscribes to Realtime creates a named channel. Names must be unique per subscription. Current naming patterns:
- `header-project-${project.id}` (project-header.tsx)
- `projects-list-${user.id}` (projects/page.tsx)
- `project-${project.id}-agents` (team page)
- `project-${project.id}-chat` (chat page)

If a component mounts multiple times without cleanup, duplicate channels can cause stale state. Always call `supabase.removeChannel(channel)` in the `useEffect` cleanup.

### JSON Extraction Fragility
The Controller Agent must return valid JSON. The three-tier extraction (jsonMode → fence → greedy) handles most cases but can still fail if the LLM produces heavily annotated output. If `analyzeSpec()` throws "Controller returned malformed JSON," check the raw LLM response in the server logs — it will be printed before the error.
