/**
 * Guided project brief → single `spec` string for POST /api/projects.
 * Keeps the API and agent pipeline unchanged; only the creation UX varies.
 */

export interface StackOption {
  id: string
  label: string
}

export interface LabeledToggle {
  id: string
  label: string
  hint?: string
}

export const STACK_OPTIONS: StackOption[] = [
  { id: 'react', label: 'React' },
  { id: 'next', label: 'Next.js' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'postgres', label: 'Postgres' },
  { id: 'supabase', label: 'Supabase' },
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'mobile', label: 'Mobile app' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'no-preference', label: 'No preference yet' },
]

/** Product / scope toggles — keywords help tier estimation. */
export const PRODUCT_OPTIONS: LabeledToggle[] = [
  { id: 'auth', label: 'Accounts & sign-in', hint: 'Login, sessions, roles' },
  { id: 'realtime', label: 'Real-time / live updates', hint: 'Websockets, presence, sync' },
  { id: 'payments', label: 'Payments or billing', hint: 'Checkout, subscriptions' },
  { id: 'admin', label: 'Admin or internal tools', hint: 'Back-office, moderation' },
  { id: 'api', label: 'Public or partner API', hint: 'REST/GraphQL consumers' },
  { id: 'analytics', label: 'Analytics & reporting', hint: 'Dashboards, exports' },
  { id: 'integrations', label: 'Third-party integrations', hint: 'Webhooks, OAuth apps' },
  { id: 'offline', label: 'Offline-capable', hint: 'PWAs, spotty connectivity' },
]

/** Passed through as explicit team instructions in the spec. */
export const TEAM_BEHAVIOR_OPTIONS: LabeledToggle[] = [
  { id: 'review-thorough', label: 'Favor thorough review over raw speed', hint: 'Extra scrutiny on changes' },
  { id: 'ask-architecture', label: 'Flag major architecture decisions for review', hint: 'Before big restructures' },
  { id: 'explain-chat', label: 'Prefer clear explanations in team chat', hint: 'Readable reasoning' },
  { id: 'cut-scope', label: 'It's OK to trim scope to ship a solid v1', hint: 'MVP mindset' },
  { id: 'document', label: 'Bias toward documentation in-repo', hint: 'README, ADRs where useful' },
  { id: 'test-heavy', label: 'Emphasize tests for critical paths', hint: 'When in doubt, add coverage' },
]

export interface ProjectBriefFields {
  coreIdea: string
  audience: string
  problem: string
  success: string
  constraints: string
  stackIds: string[]
  productIds: string[]
  teamBehaviorIds: string[]
  extraNotes: string
}

const labelById = (options: { id: string; label: string }[], ids: string[]): string[] => {
  const map = new Map(options.map(o => [o.id, o.label]))
  return ids.map(id => map.get(id)).filter((s): s is string => Boolean(s))
}

export function buildProjectSpecFromBrief(f: ProjectBriefFields): string {
  const lines: string[] = []
  const core = f.coreIdea.trim()
  if (!core) return ''

  lines.push('## What we\'re building', '', core, '')

  if (f.audience.trim()) {
    lines.push('## Who it\'s for', '', f.audience.trim(), '')
  }
  if (f.problem.trim()) {
    lines.push('## Problem / motivation', '', f.problem.trim(), '')
  }
  if (f.success.trim()) {
    lines.push('## Definition of success', '', f.success.trim(), '')
  }
  if (f.constraints.trim()) {
    lines.push('## Constraints & non-goals', '', f.constraints.trim(), '')
  }

  const stackLabels = labelById(STACK_OPTIONS, f.stackIds)
  if (stackLabels.length > 0) {
    lines.push('## Stack & platform preferences', '', ...stackLabels.map(s => `- ${s}`), '')
  }

  const productLabels = labelById(PRODUCT_OPTIONS, f.productIds)
  if (productLabels.length > 0) {
    lines.push('## Product scope (selected)', '', ...productLabels.map(s => `- ${s}`), '')
  }

  const teamLabels = labelById(TEAM_BEHAVIOR_OPTIONS, f.teamBehaviorIds)
  if (teamLabels.length > 0) {
    lines.push('## How the agent team should behave', '', ...teamLabels.map(s => `- ${s}`), '')
  }

  if (f.extraNotes.trim()) {
    lines.push('## Additional notes', '', f.extraNotes.trim(), '')
  }

  return lines.join('\n').trim()
}

export function emptyBrief(): ProjectBriefFields {
  return {
    coreIdea: '',
    audience: '',
    problem: '',
    success: '',
    constraints: '',
    stackIds: [],
    productIds: [],
    teamBehaviorIds: [],
    extraNotes: '',
  }
}
