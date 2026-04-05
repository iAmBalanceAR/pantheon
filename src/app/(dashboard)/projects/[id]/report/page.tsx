'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { ProjectReport, SprintSummary, AgentSummary, ErrorEntry, ConflictSummary } from '@/lib/agents/reporter'

function ms(n: number | null | undefined): string {
  if (!n) return '—'
  if (n < 1000) return `${n}ms`
  if (n < 60_000) return `${(n / 1000).toFixed(1)}s`
  return `${(n / 60_000).toFixed(1)}m`
}

function Bar({ pct, danger }: { pct: number; danger?: boolean }) {
  const color = danger
    ? pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-yellow-500' : 'bg-primary'
    : 'bg-primary'
  return (
    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setReport((data.report as ProjectReport) ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleRegenerate = async () => {
    setRegenerating(true)
    await fetch(`/api/projects/${id}/report`, { method: 'POST' })
    await load()
    setRegenerating(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-4xl">📋</p>
        <h2 className="text-lg font-semibold">No report yet</h2>
        <p className="text-sm text-muted-foreground">
          The completion report is generated automatically when all sprints finish.
          If the project is complete and you don&apos;t see a report, generate one now.
        </p>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {regenerating ? 'Generating…' : 'Generate Report'}
        </button>
      </div>
    )
  }

  const totalTasks     = report.sprints.reduce((s, sp) => s + sp.tasks_total, 0)
  const completedTasks = report.sprints.reduce((s, sp) => s + sp.tasks_completed, 0)
  const failedTasks    = report.sprints.reduce((s, sp) => s + sp.tasks_failed, 0)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Completion Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generated {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : '↻ Regenerate'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Duration"      value={ms(report.duration.total_ms)}  sub="total wall time" />
        <Stat label="Tasks"         value={`${completedTasks}/${totalTasks}`} sub={`${failedTasks} failed`} />
        <Stat label="Cost"          value={`$${report.budget.dollar_used.toFixed(4)}`} sub={`of $${report.budget.dollar_budget} budget`} />
        <Stat label="Tokens Used"   value={report.budget.tokens_used.toLocaleString()} sub={`${report.budget.tokens_pct}% of budget`} />
      </div>

      {/* Narrative */}
      <Section title="Executive Summary" icon="📝">
        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
          {report.narrative}
        </div>
      </Section>

      {/* Stack */}
      {Object.keys(report.stack).length > 0 && (
        <Section title="Stack" icon="🏗️">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(report.stack).map(([k, v]) => (
              <div key={k} className="bg-secondary/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground capitalize">{k}</p>
                <p className="text-sm font-mono mt-0.5 truncate">{String(v)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Budget */}
      <Section title="Budget Usage" icon="💰">
        <div className="space-y-4">
          <BudgetRow
            label="Dollar spend"
            used={`$${report.budget.dollar_used.toFixed(4)}`}
            limit={`$${report.budget.dollar_budget}`}
            pct={report.budget.dollar_pct}
          />
          <BudgetRow
            label="Token spend"
            used={report.budget.tokens_used.toLocaleString()}
            limit={report.budget.tokens_budget.toLocaleString()}
            pct={report.budget.tokens_pct}
          />
        </div>
      </Section>

      {/* Sprints */}
      <Section title="Sprint Breakdown" icon="🏃">
        <div className="space-y-2">
          {report.sprints.map(s => <SprintRow key={s.number} sprint={s} />)}
        </div>
      </Section>

      {/* Agents */}
      <Section title="Agent Performance" icon="🤖">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left pb-2 font-medium">Agent</th>
                <th className="text-left pb-2 font-medium">Role</th>
                <th className="text-left pb-2 font-medium">Model</th>
                <th className="text-right pb-2 font-medium">Tasks</th>
                <th className="text-right pb-2 font-medium">Avg Time</th>
                <th className="text-right pb-2 font-medium">Tokens</th>
                <th className="text-right pb-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.agents.map(a => <AgentRow key={a.id} agent={a} />)}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Errors */}
      {report.errors.length > 0 && (
        <Section title={`Error Log (${report.errors.length})`} icon="❌">
          <div className="space-y-2">
            {report.errors.map((e, i) => <ErrorRow key={i} entry={e} />)}
          </div>
        </Section>
      )}

      {/* Conflicts */}
      {report.conflicts.length > 0 && (
        <Section title={`Conflicts (${report.conflicts.length})`} icon="⚡">
          <div className="space-y-2">
            {report.conflicts.map((c, i) => <ConflictRow key={i} conflict={c} />)}
          </div>
        </Section>
      )}

    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function BudgetRow({ label, used, limit, pct }: { label: string; used: string; limit: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-mono">
          {used} <span className="text-muted-foreground">/ {limit}</span>
          <span className="text-xs text-muted-foreground ml-2">({pct}%)</span>
        </span>
      </div>
      <Bar pct={pct} danger />
    </div>
  )
}

function SprintRow({ sprint }: { sprint: SprintSummary }) {
  const allDone  = sprint.tasks_completed === sprint.tasks_total && sprint.tasks_failed === 0
  const hasFails = sprint.tasks_failed > 0
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
        allDone  ? 'bg-green-500/10 border-green-500/30 text-green-400' :
        hasFails ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                   'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      }`}>
        S{sprint.number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{sprint.name ?? `Sprint ${sprint.number}`}</p>
        {sprint.goal && <p className="text-xs text-muted-foreground truncate">{sprint.goal}</p>}
      </div>
      <div className="text-xs text-muted-foreground text-right shrink-0">
        <p>{sprint.tasks_completed}/{sprint.tasks_total} tasks</p>
        {sprint.duration_ms && <p className="mt-0.5">{ms(sprint.duration_ms)}</p>}
      </div>
    </div>
  )
}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const hasFails = agent.tasks_failed > 0
  return (
    <tr className="hover:bg-secondary/20 transition-colors">
      <td className="py-2.5 pr-4">
        <p className="font-medium">{agent.display_name}</p>
      </td>
      <td className="py-2.5 pr-4">
        <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
      </td>
      <td className="py-2.5 pr-4">
        <span className="text-xs font-mono text-muted-foreground">{agent.llm_model.split('/').at(-1)}</span>
      </td>
      <td className="py-2.5 pr-4 text-right">
        <span className={hasFails ? 'text-red-400' : ''}>
          {agent.tasks_completed}
          {hasFails && <span className="text-red-400"> / {agent.tasks_failed}✕</span>}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-right text-muted-foreground">{ms(agent.avg_duration_ms)}</td>
      <td className="py-2.5 pr-4 text-right text-muted-foreground">{agent.tokens_used.toLocaleString()}</td>
      <td className="py-2.5 text-right text-muted-foreground">${agent.cost.toFixed(4)}</td>
    </tr>
  )
}

function ErrorRow({ entry }: { entry: ErrorEntry }) {
  return (
    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-red-400 font-medium">{entry.agent_name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground truncate">{entry.task_title}</span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs text-red-300/80 font-mono">{entry.error}</p>
    </div>
  )
}

function ConflictRow({ conflict }: { conflict: ConflictSummary }) {
  const isResolved = conflict.status === 'resolved' || conflict.status === 'approved'
  return (
    <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${
          isResolved
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>{conflict.status}</span>
        <span className="text-muted-foreground text-xs capitalize">{conflict.conflict_type}</span>
      </div>
      <p className="text-foreground/80">{conflict.description}</p>
      {conflict.resolution_plan && (
        <p className="text-xs text-muted-foreground mt-1 border-t border-yellow-500/10 pt-1">
          Resolution: {conflict.resolution_plan}
        </p>
      )}
    </div>
  )
}
