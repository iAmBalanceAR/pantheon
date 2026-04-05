'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle2, AlertCircle, RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface PageProps { params: { id: string } }

const STATUS_LABEL: Record<string, string> = {
  scoping: 'Scoping', active: 'Running', paused: 'Paused',
  reviewing: 'Reviewing', completed: 'Complete', failed: 'Failed',
}

const RUN_PHASES = [
  'Activating',
  'Loading tasks',
  'Agents executing',
  'Auditing',
  'Advancing sprint',
  'Finalising',
]

// ── Inline run ticker — non-blocking, lives inside the run control box ────────
function RunTicker({
  sprintIndex,
  sprintTotal,
  phase,
  log,
  error,
}: {
  sprintIndex: number
  sprintTotal: number
  phase: number
  log: string[]
  error: string | null
}) {
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const overallPct = sprintTotal > 0
    ? Math.min(Math.round(((sprintIndex - 1 + (phase / RUN_PHASES.length)) / sprintTotal) * 100), 99)
    : Math.round((phase / RUN_PHASES.length) * 100)

  const recentLog = log.slice(-4)
  const currentPhase = RUN_PHASES[Math.min(phase, RUN_PHASES.length - 1)]

  return (
    <div className="flex-1 min-w-0 border-l border-border pl-5 space-y-2 animate-fade-in">

      {/* Phase + sprint label */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {error
            ? <AlertCircle size={10} className="text-red-400 flex-shrink-0" />
            : <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 animate-live-pulse" />
          }
          <span className={cn(
            'text-xs font-medium truncate',
            error ? 'text-red-400' : 'text-foreground'
          )}>
            {error ? 'Error' : currentPhase}
          </span>
        </div>
        <span className="text-2xs font-mono text-muted-foreground/50 flex-shrink-0">
          {sprintTotal > 0 ? `S${sprintIndex}/${sprintTotal}` : '…'}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            error ? 'bg-red-500' : 'bg-primary'
          )}
          style={{
            width: `${overallPct}%`,
            boxShadow: error ? undefined : '0 0 6px hsl(73 92% 56% / 0.5)',
          }}
        />
      </div>

      {/* Scrollable log — last 4 lines */}
      <div
        ref={logRef}
        className="overflow-hidden space-y-0.5"
        aria-live="polite"
        aria-label="Run log"
      >
        {recentLog.length === 0
          ? <p className="text-2xs font-mono text-muted-foreground/30">Initialising…</p>
          : recentLog.map((line, i) => (
            <p
              key={i}
              className={cn(
                'text-2xs font-mono truncate transition-opacity',
                i === recentLog.length - 1
                  ? 'text-muted-foreground/80'
                  : 'text-muted-foreground/35'
              )}
            >
              {line}
            </p>
          ))
        }
      </div>
    </div>
  )
}

export default function ProjectOverviewPage({ params }: PageProps) {
  const [project, setProject]     = useState<Record<string, unknown> | null>(null)
  const [agents, setAgents]       = useState<Record<string, unknown>[]>([])
  const [sprints, setSprints]     = useState<Record<string, unknown>[]>([])
  const [running, setRunning]   = useState(false)
  const [phase, setPhase]       = useState(0)
  const [sprintIdx, setSprintIdx] = useState(1)
  const [runLog, setRunLog]     = useState<string[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [rerunning, setRerunning] = useState(false)
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const addLog = (line: string) => setRunLog(l => [...l.slice(-40), line])

  const load = useCallback(async () => {
    const [{ data: p }, { data: a }, { data: s }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', params.id).single(),
      supabase.from('agents').select('*').eq('project_id', params.id).order('created_at'),
      supabase.from('sprints').select('*').eq('project_id', params.id).order('number'),
    ])
    setProject(p)
    setAgents(a ?? [])
    setSprints(s ?? [])
  }, [params.id, supabase])

  const loadDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const scheduleLoad = useCallback(() => {
    clearTimeout(loadDebounceRef.current)
    loadDebounceRef.current = setTimeout(() => {
      void load()
    }, 250)
  }, [load])

  useEffect(() => {
    return () => { clearTimeout(loadDebounceRef.current) }
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`overview-${params.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${params.id}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents', filter: `project_id=eq.${params.id}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `project_id=eq.${params.id}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${params.id}` }, scheduleLoad)
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Pantheon] overview realtime:', status, err?.message ?? err)
        }
      })
    return () => {
      clearTimeout(loadDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [load, params.id, scheduleLoad, supabase])

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!running) return
    const tick = () => { void loadRef.current() }
    tick()
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [running])

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    setRunLog([])
    setPhase(0)
    setSprintIdx(1)

    try {
      let sprintsDone = false
      let iteration   = 0

      while (!sprintsDone && iteration < 50) {
        iteration++
        setSprintIdx(iteration)
        setPhase(0); addLog(`▶ Sprint ${iteration} — activating project…`)

        const res  = await fetch(`/api/projects/${params.id}/run`, { method: 'POST' })
        const data = await res.json()

        setPhase(1); addLog('  Tasks loaded. Executing…')

        if (!res.ok) {
          if (data.error === 'Project is paused') { addLog('⏸ Paused.'); break }
          throw new Error(data.error ?? 'Run failed')
        }

        const sc = typeof data.sprints_completed === 'number' ? data.sprints_completed : 1
        const tr = typeof data.total_tasks_run === 'number' ? data.total_tasks_run : (data.tasks_run ?? '?')
        setPhase(2); addLog(`  ${sc} sprint(s) in this run, ${tr} tasks total.`)
        if (data.any_failed) addLog(`  ⚠ ${data.results?.filter((r: {success: boolean}) => !r.success).length ?? 0} task(s) failed.`)

        setPhase(3); addLog('  Audit complete.')

        if (data.paused) { addLog('⏸ Paused by user.'); break }
        if (data.done)   {
          setPhase(5); addLog('✅ All sprints complete. Generating report…')
          sprintsDone = true
          break
        }

        setPhase(4); addLog('  More sprints remain (run limit) — continuing…')
        await load()
        await new Promise(r => setTimeout(r, 400))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      addLog(`✕ Error: ${msg}`)
    } finally {
      setRunning(false)
      await load()
      router.refresh()
    }
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeAgents     = agents.filter(a => a.status === 'running')
  const completedSprints = sprints.filter(s => s.status === 'completed' || s.status === 'approved')
  const status           = project.status as string
  const canRun           = ['scoping', 'active'].includes(status) && !running
  const isComplete       = status === 'completed'
  const canRerun =
    ['completed', 'failed', 'paused', 'reviewing'].includes(status) && !running && !rerunning

  const openRerunModal = () => {
    if (!canRerun) return
    setRerunDialogOpen(true)
  }

  const executeRerun = async () => {
    if (!canRerun) return
    setRerunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${params.id}/rerun`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Rerun failed')
      setRerunDialogOpen(false)
      await load()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rerun failed')
      setRerunDialogOpen(false)
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-10 animate-fade-up">

      {/* ── Run control ─────────────────────────────────────────── */}
      {!isComplete && (
        <div className={cn(
          'p-5 rounded-2xl border bg-[#0f0f0f] transition-all duration-300',
          running ? 'border-primary/20' : 'border-border'
        )}>
          <div className="flex items-center gap-5">
            {/* Left: status + button */}
            <div className="flex items-center justify-between gap-4 flex-shrink-0">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {running ? 'Agents working…' : status === 'scoping' ? 'Ready to run' : 'Continue'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {`${completedSprints.length} of ${sprints.length} sprint${sprints.length !== 1 ? 's' : ''} complete`}
                </div>
              </div>

              <button
                onClick={handleRun}
                disabled={!canRun}
                aria-label="Start or continue project execution"
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex-shrink-0',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  canRun
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(73_92%_56%/0.35)] active:scale-[0.97]'
                    : 'bg-[#161616] border border-border text-muted-foreground'
                )}
              >
                <Play size={14} strokeWidth={2.5} />
                {status === 'scoping' ? 'Start project' : 'Run next sprint'}
              </button>
            </div>

            {/* Right: live ticker — appears when running or on error */}
            {(running || error) && (
              <RunTicker
                sprintIndex={sprintIdx}
                sprintTotal={sprints.length}
                phase={phase}
                log={runLog}
                error={error}
              />
            )}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl border border-[#1e2d1e] bg-[#0d1a0d]">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 size={16} className="text-[#4ade80] flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-[#4ade80]">Project complete</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                All {sprints.length} sprints finished
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openRerunModal}
            disabled={!canRerun}
            aria-label="Reset project and run again from sprint one"
            className={cn(
              'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold shrink-0',
              'border border-border bg-[#111] text-foreground hover:border-primary/40 hover:bg-primary/5',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
          >
            <RotateCcw size={14} strokeWidth={2.5} />
            Rerun project
          </button>
        </div>
      )}

      {canRerun && !isComplete && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl border border-border bg-[#0f0f0f]">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Rerun from the start</div>
            <div className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Status is <span className="font-mono text-foreground/80">{status}</span>. Reset all sprints and tasks, clear usage and deliverables, then use <strong className="text-foreground">Start project</strong> again. Chat above is kept.
            </div>
          </div>
          <button
            type="button"
            onClick={openRerunModal}
            disabled={!canRerun}
            aria-label="Reset project and run again from sprint one"
            className={cn(
              'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold shrink-0',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
          >
            <RotateCcw size={14} strokeWidth={2.5} />
            Rerun project
          </button>
        </div>
      )}

      {/* ── Summary stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Agents',  value: agents.length },
          { label: 'Running', value: activeAgents.length, highlight: activeAgents.length > 0 },
          { label: 'Sprints', value: `${completedSprints.length} / ${sprints.length}` },
          { label: 'Spent',   value: `$${((project.cost_used as number) ?? 0).toFixed(4)}` },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-xl bg-[#0f0f0f] border border-border">
            <div className={cn(
              'text-2xl font-bold tracking-tight',
              stat.highlight ? 'text-[#4ade80]' : 'text-foreground'
            )}>
              {stat.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Agents ───────────────────────────────────────────────── */}
      {agents.length > 0 && (
        <section>
          <h2 className="text-label text-muted-foreground/50 mb-3">Team</h2>
          <div className="sep mb-4" />
          {agents.map(agent => (
            <div key={agent.id as string}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  agent.status === 'running'  ? 'bg-[#4ade80] animate-live-pulse' :
                  agent.status === 'waiting'  ? 'bg-[#facc15]' :
                  agent.status === 'completed'? 'bg-[#525252]' : 'bg-[#333]'
                )} />
                <span className="text-sm font-medium">
                  {(agent.display_name as string) ?? (agent.role as string)}
                </span>
                <span className="text-2xs text-muted-foreground font-mono capitalize">
                  {agent.role as string}
                </span>
              </div>
              <div className="flex items-center gap-4 text-2xs text-muted-foreground font-mono">
                <span>{agent.llm_provider as string}</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full font-medium',
                  agent.status === 'running'   ? 'text-[#4ade80] bg-[#0d1a0d]' :
                  agent.status === 'waiting'   ? 'text-[#facc15] bg-[#1a1700]' :
                  agent.status === 'completed' ? 'text-[#525252] bg-[#1a1a1a]' :
                  'text-muted-foreground bg-[#1a1a1a]'
                )}>
                  {STATUS_LABEL[agent.status as string] ?? (agent.status as string)}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Sprints ──────────────────────────────────────────────── */}
      {sprints.length > 0 && (
        <section>
          <h2 className="text-label text-muted-foreground/50 mb-3">Sprints</h2>
          <div className="sep mb-4" />
          {sprints.map(sprint => (
            <div key={sprint.id as string}
              className="flex items-start justify-between py-4 border-b border-border last:border-0"
            >
              <div className="flex items-start gap-4">
                <span className="text-mono text-muted-foreground/40 pt-0.5 w-6 text-right">
                  {sprint.number as number}
                </span>
                <div>
                  <div className="text-sm font-medium">{sprint.name as string}</div>
                  {sprint.goal ? (
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {sprint.goal as string}
                    </div>
                  ) : null}
                </div>
              </div>
              <span className={cn(
                'flex-shrink-0 px-2 py-0.5 rounded-full text-2xs font-medium',
                sprint.status === 'completed' || sprint.status === 'approved'
                  ? 'text-[#4ade80] bg-[#0d1a0d]' :
                sprint.status === 'active'
                  ? 'text-[#60a5fa] bg-[#0d1626]' :
                'text-[#525252] bg-[#1a1a1a]'
              )}>
                {sprint.status as string}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── Jump to ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-label text-muted-foreground/50 mb-3">Jump to</h2>
        <div className="sep mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Live Feed',  sub: 'Agent conversation',   href: `/projects/${params.id}/chat` },
            { label: 'Budget',     sub: 'Token usage & costs',  href: `/projects/${params.id}/budget` },
            { label: 'Settings',   sub: 'Edit project settings',href: `/projects/${params.id}/settings` },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className="group p-4 rounded-xl border border-border bg-[#0f0f0f] hover:border-[#2a2a2a] hover:bg-[#131313] transition-colors duration-150"
            >
              <div className="text-sm font-medium group-hover:text-primary transition-colors duration-150">
                {item.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      <AlertDialog
        open={rerunDialogOpen}
        onOpenChange={open => {
          if (!open && !rerunning) setRerunDialogOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogClose
            disabled={rerunning}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground disabled:opacity-40"
          />
          <AlertDialogHeader>
            <AlertDialogTitle>Rerun from the beginning?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
                <p>
                  This resets every sprint and task to <span className="text-foreground font-medium">pending</span>,
                  clears spend counters, removes saved deliverable files, and clears the completion report.
                </p>
                <p className="text-foreground/85">Chat history stays in the Live Feed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={rerunning}>
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              disabled={rerunning}
              onClick={executeRerun}
              className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'rounded-xl h-10')}
            >
              {rerunning ? (
                <Loader2 size={14} className="animate-spin" strokeWidth={2.5} aria-hidden />
              ) : (
                <RotateCcw size={14} strokeWidth={2.5} aria-hidden />
              )}
              {rerunning ? 'Resetting…' : 'Rerun project'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
