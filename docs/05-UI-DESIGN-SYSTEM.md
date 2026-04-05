# Pantheon — UI Design System

## Design Philosophy

**"Obsidian Electric"** — a monochromatic near-black canvas with a single electric accent color. The design principle is that the brand color (electric lime) should not decorate the UI — it IS the signal. Everything else is dark and quiet.

- No competing colors
- No gradients (except strategic highlights)
- No shadows — use borders instead
- Typography hierarchy through SIZE, not decoration (no bold/underline abuse)
- The lime only appears when something important is happening or actionable

---

## Color Tokens (CSS Variables)

All defined in `src/app/globals.css` under `:root`. Tailwind maps these via `tailwind.config.ts`.

| Token | HSL Value | Hex Approx | Use |
|-------|-----------|------------|-----|
| `--background` | 0 0% 5% | #0D0D0D | Page background — true near-black |
| `--foreground` | 0 0% 96% | #F5F5F5 | Primary text |
| `--card` | 0 0% 8% | #141414 | Card surfaces |
| `--popover` | 0 0% 9% | #171717 | Dropdowns, popovers |
| `--primary` | 73 92% 56% | #CBF43A | Electric lime — THE accent color |
| `--primary-foreground` | 0 0% 5% | #0D0D0D | Dark text on lime buttons |
| `--secondary` | 0 0% 12% | #1F1F1F | Secondary backgrounds |
| `--secondary-foreground` | 0 0% 65% | #A6A6A6 | Secondary text |
| `--muted` | 0 0% 10% | #1A1A1A | Muted backgrounds |
| `--muted-foreground` | 0 0% 44% | #707070 | Muted/placeholder text |
| `--border` | 0 0% 13% | #212121 | All borders |
| `--destructive` | 0 70% 54% | #E03045 | Errors, delete actions |
| `--ring` | (same as primary) | | Focus rings |

**There is intentionally no dark mode toggle** — the entire app is dark-mode-only. Do not add light mode without discussion.

---

## Typography Classes

Defined in `globals.css`:

| Class | Use |
|-------|-----|
| `.text-hero` | clamp(2rem–3.5rem), 800 weight, -0.03em tracking |
| `.text-display` | 1.5rem, 700 weight, -0.025em tracking |
| `.text-title` | 1.125rem, 600 weight, -0.02em tracking |
| `.text-body` | 0.9375rem, 400 weight |
| `.text-small` | 0.8125rem |
| `.text-mono` | Geist Mono, 0.8125rem |
| `.text-2xs` | 0.6875rem (11px) |

**Font families** (from `tailwind.config.ts`):
- `font-sans`: Geist (variable weight)
- `font-mono`: Geist Mono

---

## Component Conventions

### Buttons

Defined in `src/components/ui/button.tsx`. Variants:

| Variant | Use |
|---------|-----|
| `default` | Primary CTA — lime background, dark text |
| `ghost` | Tertiary — transparent, dim text, hover shows background |
| `outline` | Secondary — border + transparent background |
| `destructive` | Danger actions |
| `link` | Text-only with underline on hover |

Sizes: `default`, `sm`, `lg`, `icon`

### Form Fields

The canonical form field class is `.input` (with `.input-field` as an alias). Defined in `globals.css`:
- Full width
- Background: `#111111`
- Border: `border-border`
- On focus: `border-primary/40` + `box-shadow: 0 0 0 3px hsl(73 92% 56% / 0.10)` (subtle lime glow)
- `select` elements get a custom SVG chevron (appearance stripped)

Always use one of these classes on `<input>`, `<select>`, `<textarea>` elements. Never style form fields inline.

### Cards / Panels

Pattern:
```tsx
<div className="p-5 rounded-2xl border border-border bg-[#0f0f0f]">
```
For active/highlighted state add `border-primary/20`.

### Section Separators

Use the `.sep` utility class for horizontal rules:
```tsx
<div className="sep mx-6 mb-0.5" />
```

### Status Indicators

Each project status has a CSS class pair:
- `.status-active` / `.dot-active` — lime green
- `.status-paused` / `.dot-paused` — gray
- `.status-completed` / `.dot-completed` — muted green
- `.status-failed` / `.dot-failed` — red
- `.status-reviewing` / `.dot-reviewing` — blue
- `.status-scoping` / `.dot-scoping` — yellow

The `.dot-*` class is used on a small circle element. Active dots use `animate-live-pulse`.

---

## Navigation

### Navbar (`src/components/layout/navbar.tsx`)

- Height: 52px
- Fixed to top, `z-50`
- Background: `bg-background` (no blur, no opacity — pure black)
- Bottom border: `border-b border-border`
- Logo: "PANTHEON" in Geist Mono with lime dot `●` prefix
- Links: Projects, Help, Settings — plain text, hover shows `text-foreground`
- Active link: `text-foreground` (white) vs inactive `text-muted-foreground`
- No sidebar. No drawer. Horizontal top nav only.

### Quick help (`src/components/help/help-assistant-bubble.tsx`)

Mounted only from `src/app/(dashboard)/layout.tsx` (not on `/login`). A **lower-right** pill label opens a **slide-up** panel over the page (Framer Motion). Styling stays within Obsidian Electric: panel uses `border-border`, dark surfaces, lime only for focus ring / primary actions (send, links). Transcript is **session-only** (`sessionStorage`); no topic chips — user types free-form questions. Matches are handled in `assistant-knowledge.ts` (keywords, no LLM).

### Project Header (`src/components/layout/project-header.tsx`)

- Rendered in `src/app/(dashboard)/projects/[id]/layout.tsx`
- Contains: breadcrumb, project name (`.text-display`), pause/resume button, tab navigation
- Tabs: Overview, Live Feed, Team, Files, Budget, Report, Settings
- Subscribes to Supabase Realtime for live project status updates
- The meta info row (status / tier / budget bar) is commented out but preserved in code for future use

### Alert dialogs (`src/components/ui/alert-dialog.tsx`)

Radix-based; Obsidian-style panel (`bg-[#161616]`, `border-[#2a2a2a]`, rounded-2xl, backdrop blur). Used for **destructive or high-impact confirms**:
- **Delete project** — `projects/page.tsx` (list row action)
- **Rerun project** — `projects/[id]/page.tsx` (overview); explains reset of tasks, usage, Files, report; Cancel vs primary **Rerun project**

---

## Page Layouts

### Projects List (`/projects`)

Three groups, rendered in order:
1. **In Process** (status: active, running, reviewing, paused) — green pulsing dot
2. **Future Projects** (status: scoping) — yellow dot
3. **Complete** (status: completed, failed) — red dot

Empty groups do not render their header. Each group header:
- `text-sm font-semibold tracking-widest uppercase text-foreground`
- Color-coded dot (w-2 h-2)
- Thin separator line below

Project rows: compact (`py-2.5`), custom `StatusIcon` per status, tier badge (hidden when complete), date, hover-reveal action buttons.

### New Project (`/projects/new`)

- **Guided brief** (default): cards for core idea, spark questions, constraints, stack toggles, product-scope checkboxes, team-behavior checkboxes, extra notes — composed into one spec via `buildProjectSpecFromBrief()`
- **Single text box** toggle for a paste-your-spec workflow
- Tier preview still driven by **compiled** spec word count / heuristics
- On submit: `CreationModal` overlay with phase steps + progress bar

### Project Overview (`/projects/[id]`)

- Max-width `max-w-4xl mx-auto`
- Run control box (left: status + run button; right: `RunTicker` when active)
- Sprint list
- Active agents strip
- `RunTicker`: non-blocking inline display showing current phase, sprint progress, recent log lines

---

## Animations

Defined in `tailwind.config.ts` and `globals.css`:

| Name | Effect |
|------|--------|
| `animate-fade-up` | Fade in + translate-up on mount |
| `animate-live-pulse` | Subtle opacity pulse (for active status dots) |
| `animate-shimmer` | Horizontal shine sweep (loading states) |

---

## Icons

Using `lucide-react`. Icon conventions:
- Use `size` prop directly (not CSS width/height)
- Typical sizes: 10–14px for inline, 16–20px for standalone
- `strokeWidth={2}` default, `strokeWidth={2.5}` for emphasis

Key icon → status mapping:
- Running: `Zap` (lime, animated ping behind it)
- Complete: `CheckCheck` (lime)
- Failed: `XCircle` (red/40)
- Paused: `Pause` (gray/50)
- Reviewing: `Eye` (blue)
- Scoping/Future: `Clock` (yellow/70)

---

## What Not To Do

- Do NOT use `@apply border-border` on the `*` selector — it caused a CSS parsing error. Use `border-color: hsl(var(--border))` directly.
- Do NOT add shadows — use borders
- Do NOT use colors outside the token system for UI chrome (data viz can use its own colors)
- Do NOT use `text-white` — use `text-foreground`
- Do NOT use `bg-white` anywhere
- Do NOT add a light mode without discussion — it would require significant rework
