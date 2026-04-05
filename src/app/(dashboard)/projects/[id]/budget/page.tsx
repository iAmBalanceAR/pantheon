import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getBudgetStatus } from '@/lib/agents/banker'
import { formatDistanceToNow } from 'date-fns'
import type { BudgetEvent, Agent } from '@/types'

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
  if (!project) notFound()

  const { data: events }   = await supabase.from('budget_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(50)
  const { data: agents }   = await supabase.from('agents').select('*').eq('project_id', id)
  const { data: execLogs } = await supabase.from('execution_log').select('agent_id, tokens_in, tokens_out, cost, duration_ms, created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(20)

  const budget   = getBudgetStatus(project)
  const agentMap = new Map((agents ?? []).map((a: Agent) => [a.id, a]))

  const statusBg: Record<string, string> = {
    healthy:  'bg-green-400/10 border-green-400/30 text-green-400',
    warning:  'bg-yellow-400/10 border-yellow-400/30 text-yellow-400',
    critical: 'bg-orange-400/10 border-orange-400/30 text-orange-400',
    exceeded: 'bg-red-400/10 border-red-400/30 text-red-400',
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-muted-foreground text-sm mt-1">Banker Agent — resource monitoring</p>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-5 ${statusBg[budget.status]}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold uppercase">{budget.status}</span>
        </div>
        <p className="text-sm opacity-90">{budget.recommendation}</p>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4">
        <GaugeCard
          label="Token Usage"
          used={budget.tokens_used}
          total={budget.tokens_budget}
          pct={budget.tokens_pct}
          format={(v) => v.toLocaleString()}
          unit="tokens"
        />
        <GaugeCard
          label="Cost"
          used={budget.cost_used}
          total={budget.cost_budget}
          pct={budget.cost_pct}
          format={(v) => `$${Number(v).toFixed(4)}`}
          unit=""
        />
      </div>

      {/* Per-agent breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-4">Per-Agent Usage</h2>
        <div className="space-y-2">
          {(agents ?? []).sort((a: Agent, b: Agent) => b.tokens_used - a.tokens_used).map((agent: Agent) => (
            <div key={agent.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 truncate">{agent.display_name}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(100, (agent.tokens_used / Math.max(1, budget.tokens_budget)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-20 text-right">{agent.tokens_used.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground w-16 text-right">${Number(agent.cost).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent budget events */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium mb-4">Ledger</h2>
        <div className="space-y-1.5">
          {(events ?? []).slice(0, 20).map((ev: BudgetEvent) => {
            const agent = agentMap.get(ev.agent_id ?? '')
            return (
              <div key={ev.id} className="flex items-center gap-3 py-1 text-xs">
                <span className="text-muted-foreground w-8 font-mono uppercase">{ev.event_type.split('_')[0]}</span>
                <span className="text-muted-foreground flex-1">{agent?.display_name ?? 'System'}</span>
                <span>{ev.tokens.toLocaleString()} tok</span>
                <span className="text-muted-foreground">${Number(ev.cost).toFixed(5)}</span>
                <span className="text-muted-foreground w-24 text-right">
                  {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                </span>
              </div>
            )
          })}
          {!(events?.length) && <p className="text-xs text-muted-foreground">No budget events yet.</p>}
        </div>
      </div>
    </div>
  )
}

function GaugeCard({
  label, used, total, pct, format, unit
}: {
  label: string; used: number; total: number; pct: number; format: (v: number) => string; unit: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-semibold mb-1">{pct}%</p>
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{format(used)} / {format(total)} {unit}</p>
    </div>
  )
}
