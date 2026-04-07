'use client'

import { useState, useRef, useCallback, useMemo, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Zap, LayoutTemplate, AlignLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildProjectSpecFromBrief,
  emptyBrief,
  PRODUCT_OPTIONS,
  STACK_OPTIONS,
  TEAM_BEHAVIOR_OPTIONS,
  type ProjectBriefFields,
} from '@/lib/projects/brief-spec'

const TIERS = [
  { id: 'micro',      label: 'Micro',      agents: 3,  sprints: 1,  description: 'A single focused thought' },
  { id: 'small',      label: 'Small',      agents: 8,  sprints: 3,  description: 'A paragraph with direction' },
  { id: 'medium',     label: 'Medium',     agents: 20, sprints: 8,  description: 'Clear goal and stack' },
  { id: 'large',      label: 'Large',      agents: 50, sprints: 20, description: 'Well-defined with requirements' },
  { id: 'enterprise', label: 'Enterprise', agents: -1, sprints: -1, description: 'Formal spec with architecture' },
]

const estimateTier = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const hasStack    = /\b(next\.?js|react|node|python|postgres|mysql|supabase|typescript|api|frontend|backend)\b/i.test(text)
  const hasCriteria = /\b(should|must|require|need|accept|support|allow|prevent)\b/i.test(text)
  const hasArch     = /\b(architecture|schema|auth|deploy|scale|performance|security|endpoint|webhook)\b/i.test(text)
  const hasFormal   = /\b(acceptance criteria|non-functional|sla|throughput|latency)\b/i.test(text)

  if (hasFormal || words > 200)     return 5
  if (hasArch && hasStack && words > 100) return 4
  if (hasStack && hasCriteria)      return 3
  if (words > 30 && hasStack)       return 2
  return 1
}

const CREATION_PHASES = [
  { label: 'Reading your spec',     sub: 'Parsing goals, stack, and constraints…'     },
  { label: 'Scoring complexity',    sub: 'Determining team size and sprint count…'     },
  { label: 'Selecting the team',    sub: 'Assigning roles and choosing models…'        },
  { label: 'Mapping the sprints',   sub: 'Breaking work into focused milestones…'      },
  { label: 'Assembling agents',     sub: 'Creating agent profiles and task queues…'    },
  { label: 'Launching the project', sub: 'Handing off to the team. Stand by…'         },
]

function CreationModal({ step, error }: { step: number; error: string | null }) {
  const pct = Math.round(((step + 1) / CREATION_PHASES.length) * 100)
  const current = CREATION_PHASES[Math.min(step, CREATION_PHASES.length - 1)]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-label="Creating project"
    >
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-up">

        <div className="h-0.5 bg-[#1a1a1a] w-full">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, boxShadow: '0 0 12px hsl(73 92% 56% / 0.6)' }}
          />
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-live-pulse" />
              <Zap size={15} className="text-primary relative z-10" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold">{error ? 'Setup failed' : current.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {error ? 'See error below' : current.sub}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {CREATION_PHASES.map((p, i) => {
              const isDone    = step > i
              const isCurrent = i === step && !error
              const isFuture  = i > step
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-300',
                    isCurrent && 'bg-primary/8 border border-primary/20',
                    isDone    && 'opacity-40',
                    isFuture  && 'opacity-20',
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0',
                    isDone    && 'bg-primary/30',
                    isCurrent && 'bg-primary',
                    isFuture  && 'border border-border',
                  )}>
                    {isDone    && <span className="text-[7px] text-primary font-bold leading-none">✓</span>}
                    {isCurrent && <span className="block w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />}
                  </div>
                  <span className={cn(
                    'text-xs',
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}>
                    {p.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Setting up your team</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-xs text-red-300 font-mono">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BriefCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-[#0f0f0f] space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export default function NewProjectPage() {
  const [simpleMode, setSimpleMode] = useState(false)
  const [brief, setBrief] = useState<ProjectBriefFields>(() => emptyBrief())
  const [specSimple, setSpecSimple] = useState('')

  const [budget, setBudget]     = useState('5')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()
  const coreRef = useRef<HTMLTextAreaElement>(null)
  const simpleRef = useRef<HTMLTextAreaElement>(null)

  const effectiveSpec = useMemo(() => {
    if (simpleMode) return specSimple.trim()
    return buildProjectSpecFromBrief(brief)
  }, [simpleMode, specSimple, brief])

  const tierIndex = estimateTier(effectiveSpec) - 1
  const currentTier = TIERS[tierIndex]
  const wordCount = effectiveSpec.trim().split(/\s+/).filter(Boolean).length

  const patchBrief = useCallback((patch: Partial<ProjectBriefFields>) => {
    setBrief(b => ({ ...b, ...patch }))
  }, [])

  const toggleId = useCallback((field: 'stackIds' | 'productIds' | 'teamBehaviorIds', id: string) => {
    setBrief(b => {
      const list = b[field]
      const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
      return { ...b, [field]: next }
    })
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!effectiveSpec || loading) return
    setLoading(true)
    setError(null)
    setStep(0)

    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, CREATION_PHASES.length - 2))
    }, 1400)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: effectiveSpec, budget_usd: parseFloat(budget) || 5 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Something went wrong')
      clearInterval(interval)
      setStep(CREATION_PHASES.length - 1)
      await new Promise(r => setTimeout(r, 600))
      router.push(`/projects/${data.id}`)
    } catch (err) {
      clearInterval(interval)
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setLoading(false)
    }
  }, [effectiveSpec, budget, loading, router])

  const tierColor = [
    'border-[#333]',
    'border-teal-900',
    'border-blue-900',
    'border-violet-900',
    'border-primary/40',
  ][tierIndex]

  const tierTextColor = [
    'text-[#525252]',
    'text-teal-400',
    'text-blue-400',
    'text-violet-400',
    'text-primary',
  ][tierIndex]

  const handleModeSimple = useCallback(() => {
    setSimpleMode(true)
    requestAnimationFrame(() => simpleRef.current?.focus())
  }, [])

  const handleModeGuided = useCallback(() => {
    setSimpleMode(false)
    requestAnimationFrame(() => coreRef.current?.focus())
  }, [])

  return (
    <div className="min-h-[calc(100dvh-52px)] flex flex-col">
      {loading && <CreationModal step={step} error={error} />}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-3xl animate-fade-up">

          <h1 className="text-hero mb-2">
            What should<br />
            <span className="text-primary">we build?</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-xl">
            Use the guided brief to think through audience, scope, and how you want the team to work — or switch
            to a single box if you already have a full write-up.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Specification input mode"
            >
              <span className="text-2xs uppercase tracking-widest text-muted-foreground mr-1">Input</span>
              <button
                type="button"
                onClick={handleModeGuided}
                aria-pressed={!simpleMode}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-colors',
                  !simpleMode
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-[#0a0a0a] text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutTemplate size={14} strokeWidth={2} aria-hidden />
                Guided brief
              </button>
              <button
                type="button"
                onClick={handleModeSimple}
                aria-pressed={simpleMode}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-colors',
                  simpleMode
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-[#0a0a0a] text-muted-foreground hover:text-foreground',
                )}
              >
                <AlignLeft size={14} strokeWidth={2} aria-hidden />
                Single text box
              </button>
            </div>

            {simpleMode ? (
              <div className="relative">
                <textarea
                  ref={simpleRef}
                  value={specSimple}
                  onChange={e => setSpecSimple(e.target.value)}
                  disabled={loading}
                  placeholder="Paste or write your full project specification: goals, stack, requirements, constraints, acceptance criteria — everything the team should know."
                  rows={12}
                  className={cn(
                    'textarea w-full transition-all duration-200',
                    specSimple.length > 0 && cn('border-opacity-80', tierColor),
                  )}
                  aria-label="Project specification (full text)"
                />
                {specSimple.length > 0 && (
                  <div className="absolute bottom-3 right-3 text-2xs font-mono text-muted-foreground/40">
                    {wordCount}w
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <BriefCard
                  title="Core idea"
                  description="Start here — a clear sentence or two. Everything else is optional but helps the team."
                >
                  <textarea
                    ref={coreRef}
                    value={brief.coreIdea}
                    onChange={e => patchBrief({ coreIdea: e.target.value })}
                    disabled={loading}
                    placeholder="e.g. A small app that helps book club hosts schedule discussions and track reading progress."
                    rows={3}
                    className={cn(
                      'textarea w-full min-h-[5.5rem]',
                      brief.coreIdea.length > 0 && cn('border-opacity-80', tierColor),
                    )}
                    aria-label="Core project idea"
                    aria-required
                  />
                </BriefCard>

                <BriefCard
                  title="Spark questions"
                  description="Short answers are fine. They often surface requirements you didn't know you had."
                >
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="brief-audience" className="text-2xs uppercase tracking-wider text-muted-foreground">
                        Who is it for?
                      </label>
                      <textarea
                        id="brief-audience"
                        value={brief.audience}
                        onChange={e => patchBrief({ audience: e.target.value })}
                        disabled={loading}
                        placeholder="Primary users, personas, or teams."
                        rows={2}
                        className="textarea w-full mt-1.5 min-h-[3.5rem]"
                        aria-label="Target audience"
                      />
                    </div>
                    <div>
                      <label htmlFor="brief-problem" className="text-2xs uppercase tracking-wider text-muted-foreground">
                        What problem does it solve?
                      </label>
                      <textarea
                        id="brief-problem"
                        value={brief.problem}
                        onChange={e => patchBrief({ problem: e.target.value })}
                        disabled={loading}
                        placeholder="Pain today, or opportunity you're chasing."
                        rows={2}
                        className="textarea w-full mt-1.5 min-h-[3.5rem]"
                        aria-label="Problem or motivation"
                      />
                    </div>
                    <div>
                      <label htmlFor="brief-success" className="text-2xs uppercase tracking-wider text-muted-foreground">
                        What does success look like?
                      </label>
                      <textarea
                        id="brief-success"
                        value={brief.success}
                        onChange={e => patchBrief({ success: e.target.value })}
                        disabled={loading}
                        placeholder="Outcomes, milestones, or a crisp definition of done."
                        rows={2}
                        className="textarea w-full mt-1.5 min-h-[3.5rem]"
                        aria-label="Definition of success"
                      />
                    </div>
                  </div>
                </BriefCard>

                <BriefCard
                  title="Constraints & non-goals"
                  description="Deadlines, compliance, hosting limits, or things you explicitly do not want."
                >
                  <textarea
                    value={brief.constraints}
                    onChange={e => patchBrief({ constraints: e.target.value })}
                    disabled={loading}
                    placeholder="e.g. Must run on Vercel; no native mobile in v1; GDPR-friendly."
                    rows={2}
                    className="textarea w-full min-h-[3.5rem]"
                    aria-label="Constraints and non-goals"
                  />
                </BriefCard>

                <BriefCard
                  title="Stack & platform"
                  description='Tap everything that applies. Unclear is OK — leave blank or choose "No preference yet."'
                >
                  <div className="flex flex-wrap gap-2">
                    {STACK_OPTIONS.map(opt => {
                      const on = brief.stackIds.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={loading}
                          onClick={() => toggleId('stackIds', opt.id)}
                          aria-pressed={on}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                            on
                              ? 'border-primary/50 bg-primary/15 text-foreground'
                              : 'border-border bg-[#111] text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </BriefCard>

                <BriefCard
                  title="Product scope"
                  description="Check areas the product likely touches. This shapes how the team plans sprints."
                >
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {PRODUCT_OPTIONS.map(opt => {
                      const id = `product-${opt.id}`
                      const on = brief.productIds.includes(opt.id)
                      return (
                        <li key={opt.id}>
                          <label
                            htmlFor={id}
                            className="flex gap-3 cursor-pointer rounded-lg border border-transparent p-2 -m-2 hover:bg-white/[0.02] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
                          >
                            <input
                              id={id}
                              type="checkbox"
                              checked={on}
                              disabled={loading}
                              onChange={() => toggleId('productIds', opt.id)}
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 rounded border border-border bg-[#111] accent-primary',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                              )}
                              aria-describedby={opt.hint ? `${id}-hint` : undefined}
                            />
                            <span className="min-w-0">
                              <span className="text-sm text-foreground block">{opt.label}</span>
                              {opt.hint ? (
                                <span id={`${id}-hint`} className="text-2xs text-muted-foreground block mt-0.5">
                                  {opt.hint}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </BriefCard>

                <BriefCard
                  title="Team behavior"
                  description="Tell the agents how you want trade-offs handled. None required."
                >
                  <ul className="grid gap-2 sm:grid-cols-1">
                    {TEAM_BEHAVIOR_OPTIONS.map(opt => {
                      const id = `team-${opt.id}`
                      const on = brief.teamBehaviorIds.includes(opt.id)
                      return (
                        <li key={opt.id}>
                          <label
                            htmlFor={id}
                            className="flex gap-3 cursor-pointer rounded-lg border border-transparent p-2 -m-2 hover:bg-white/[0.02] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
                          >
                            <input
                              id={id}
                              type="checkbox"
                              checked={on}
                              disabled={loading}
                              onChange={() => toggleId('teamBehaviorIds', opt.id)}
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 rounded border border-border bg-[#111] accent-primary',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                              )}
                              aria-describedby={opt.hint ? `${id}-hint` : undefined}
                            />
                            <span className="min-w-0">
                              <span className="text-sm text-foreground block">{opt.label}</span>
                              {opt.hint ? (
                                <span id={`${id}-hint`} className="text-2xs text-muted-foreground block mt-0.5">
                                  {opt.hint}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </BriefCard>

                <BriefCard
                  title="Anything else?"
                  description="Links, competitors to beat, design vibes, tech you hate — freeform."
                >
                  <textarea
                    value={brief.extraNotes}
                    onChange={e => patchBrief({ extraNotes: e.target.value })}
                    disabled={loading}
                    placeholder="Optional notes, links, or a pasted snippet from another doc."
                    rows={3}
                    className="textarea w-full min-h-[5rem]"
                    aria-label="Additional project notes"
                  />
                </BriefCard>

                {effectiveSpec.length > 0 && (
                  <div className="text-2xs font-mono text-muted-foreground/60 text-right pr-1">
                    Compiled brief · {wordCount} words
                  </div>
                )}
              </div>
            )}

            {effectiveSpec.length > 0 && (
              <div className={cn(
                'flex items-start justify-between p-4 rounded-xl border animate-fade-up',
                'bg-[#0d0d0d]',
                tierColor,
              )}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-label', tierTextColor)}>{currentTier.label} tier</span>
                    <div className="flex gap-0.5">
                      {TIERS.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-3 h-0.5 rounded-full transition-all duration-200',
                            tierIndex >= i ? tierTextColor.replace('text-', 'bg-') : 'bg-[#252525]',
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentTier.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={cn('text-sm font-semibold', tierTextColor)}>
                    {currentTier.agents === -1 ? '∞' : currentTier.agents} agents
                  </div>
                  <div className="text-2xs text-muted-foreground mt-0.5">
                    {currentTier.sprints === -1 ? 'unlimited' : `${currentTier.sprints} sprint${currentTier.sprints !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label htmlFor="budget" className="text-xs text-muted-foreground whitespace-nowrap">
                Token budget
              </label>
              <div className="relative flex-1 max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  min="0.5"
                  max="500"
                  step="0.5"
                  disabled={loading}
                  className="input pl-7 pr-3 h-9 text-sm max-w-[160px]"
                  aria-label="Budget in USD"
                />
              </div>
              <span className="text-xs text-muted-foreground">USD</span>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-400 animate-fade-in">
                {error}
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={!effectiveSpec || loading}
                className={cn(
                  'inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(73_92%_56%/0.35)]',
                  'transition-all duration-150 active:scale-[0.97]',
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none',
                )}
              >
                Brief the team
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </form>

          {!loading && (
            <div className="mt-10 pt-8 border-t border-border">
              <p className="text-label text-muted-foreground/40 mb-4">Tier scale</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {TIERS.map((tier, i) => (
                  <div
                    key={tier.id}
                    className={cn(
                      'p-3 rounded-lg border transition-opacity duration-200',
                      i === tierIndex && effectiveSpec.length > 0
                        ? cn('opacity-100', tierColor, 'bg-[#0d0d0d]')
                        : 'opacity-30 border-border bg-transparent',
                    )}
                  >
                    <div className="text-2xs font-bold text-foreground mb-1">{tier.label}</div>
                    <div className="text-2xs text-muted-foreground">
                      {tier.agents === -1 ? '∞' : tier.agents} agents
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
