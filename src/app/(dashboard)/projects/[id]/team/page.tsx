import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Agent, Team } from '@/types'

const ROLE_ICONS: Record<string, string> = {
  controller: '🎯', banker: '💰', auditor: '🔍',
  coder: '💻', reviewer: '👁️', researcher: '🔬',
  architect: '🏗️', mediator: '🤝', custom: '⚡',
}

const STATUS_COLORS: Record<string, string> = {
  idle:       'text-muted-foreground',
  running:    'text-green-400',
  waiting:    'text-yellow-400',
  completed:  'text-blue-400',
  failed:     'text-red-400',
  terminated: 'text-slate-500',
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  fireworks: 'Fireworks',
  gemini:    'Gemini',
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('name, resource_tier').eq('id', id).single()
  if (!project) notFound()

  const { data: teams }  = await supabase.from('teams').select('*').eq('project_id', id).order('depth')
  const { data: agents } = await supabase.from('agents').select('*').eq('project_id', id)

  const teamList: Team[] = teams ?? []
  const agentList: Agent[] = agents ?? []

  const agentsByTeam = teamList.map(team => ({
    team,
    agents: agentList.filter(a => a.team_id === team.id),
  }))

  const totalCost = agentList.reduce((sum, a) => sum + Number(a.cost), 0)
  const totalTokens = agentList.reduce((sum, a) => sum + a.tokens_used, 0)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {agentList.length} agents · {teamList.length} team{teamList.length !== 1 ? 's' : ''} ·{' '}
          {totalTokens.toLocaleString()} tokens · ${totalCost.toFixed(4)}
        </p>
      </div>

      {agentsByTeam.map(({ team, agents }) => (
        <div key={team.id} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {Array.from({ length: team.depth }).map((_, i) => <span key={i}>──</span>)}
              {team.depth > 0 && <span>└</span>}
            </div>
            <h2 className="text-sm font-medium">{team.name}</h2>
            {team.depth > 0 && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                depth {team.depth}
              </span>
            )}
            {team.purpose && (
              <span className="text-xs text-muted-foreground">— {team.purpose}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-2">No agents in this team yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const modelShort = agent.llm_model.split('/').at(-1) ?? agent.llm_model

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{ROLE_ICONS[agent.role] ?? '⚡'}</span>
          <div>
            <p className="text-sm font-medium">{agent.display_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{agent.role}</p>
          </div>
        </div>
        <span className={`text-xs font-medium ${STATUS_COLORS[agent.status] ?? ''} ${agent.status === 'running' ? 'agent-running' : ''}`}>
          ● {agent.status}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border mt-2">
        <span>{PROVIDER_LABELS[agent.llm_provider] ?? agent.llm_provider}</span>
        <span className="font-mono truncate max-w-[120px]">{modelShort}</span>
        <span className="ml-auto">{agent.tokens_used.toLocaleString()} tok</span>
      </div>
    </div>
  )
}
