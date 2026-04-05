import { callLLM } from '@/lib/llm/client'
import type { Project, Agent, BudgetEvent, LLMProvider } from '@/types'

const BANKER_PROVIDER = (process.env.BANKER_PROVIDER ?? 'fireworks') as LLMProvider
const BANKER_MODEL    = process.env.BANKER_MODEL ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct'

export interface BudgetStatus {
  tokens_used: number
  tokens_budget: number
  tokens_pct: number
  cost_used: number
  cost_budget: number
  cost_pct: number
  status: 'healthy' | 'warning' | 'critical' | 'exceeded'
  recommendation: string
}

export function getBudgetStatus(project: Project): BudgetStatus {
  const tokens_pct = Math.round((project.tokens_used / project.budget_tokens) * 100)
  const cost_pct   = Math.round((Number(project.cost_used) / Number(project.budget_dollars)) * 100)
  const pct        = Math.max(tokens_pct, cost_pct)

  let status: BudgetStatus['status']
  let recommendation: string

  if (pct >= 100) {
    status = 'exceeded'
    recommendation = 'HARD STOP. Budget exceeded. Pause all agents immediately.'
  } else if (pct >= 90) {
    status = 'critical'
    recommendation = 'Critical threshold. Terminate non-essential agents. Finalize current sprint only.'
  } else if (pct >= 75) {
    status = 'warning'
    recommendation = 'Warning threshold reached. Avoid spawning new agents. Complete in-progress tasks only.'
  } else {
    status = 'healthy'
    recommendation = 'Budget healthy. Normal operations.'
  }

  return {
    tokens_used: project.tokens_used,
    tokens_budget: project.budget_tokens,
    tokens_pct,
    cost_used: Number(project.cost_used),
    cost_budget: Number(project.budget_dollars),
    cost_pct,
    status,
    recommendation,
  }
}

export function shouldHardStop(project: Project): boolean {
  const status = getBudgetStatus(project)
  return status.status === 'exceeded'
}

export function shouldWarn(project: Project): boolean {
  const status = getBudgetStatus(project)
  return status.status === 'warning' || status.status === 'critical'
}

// Banker generates a human-readable budget summary for the chat feed
export async function generateBudgetReport(
  project: Project,
  recentEvents: BudgetEvent[]
): Promise<string> {
  const status = getBudgetStatus(project)

  const response = await callLLM(
    BANKER_PROVIDER,
    BANKER_MODEL,
    [
      {
        role: 'system',
        content: `You are the Banker Agent for a software development platform. Generate a concise budget status report in 2-3 sentences. Be direct and factual. Flag any concerns clearly.`,
      },
      {
        role: 'user',
        content: `Budget status:
- Tokens: ${status.tokens_used.toLocaleString()} / ${status.tokens_budget.toLocaleString()} (${status.tokens_pct}%)
- Cost: $${status.cost_used.toFixed(4)} / $${status.cost_budget.toFixed(2)} (${status.cost_pct}%)
- Status: ${status.status.toUpperCase()}
- Recent events: ${recentEvents.slice(0, 5).map(e => e.event_type).join(', ')}

Write the budget report.`,
      },
    ],
    { maxTokens: 256, temperature: 0.3 }
  )

  return response.content
}

// Called after every agent execution to record usage
export async function recordUsage(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
  projectId: string,
  agentId: string,
  tokensUsed: number,
  cost: number
): Promise<void> {
  // Update project totals
  const { data: proj } = await supabase
    .from('projects')
    .select('tokens_used, cost_used')
    .eq('id', projectId)
    .single()

  if (proj) {
    await supabase.from('projects').update({
      tokens_used: proj.tokens_used + tokensUsed,
      cost_used: Number(proj.cost_used) + cost,
    }).eq('id', projectId)
  }

  // Update agent totals
  await supabase
    .from('agents')
    .select('tokens_used, cost')
    .eq('id', agentId)
    .single()
    .then(({ data }) => {
      if (data) {
        supabase.from('agents').update({
          tokens_used: data.tokens_used + tokensUsed,
          cost: Number(data.cost) + cost,
        }).eq('id', agentId)
      }
    })

  // Log budget event
  await supabase.from('budget_events').insert({
    project_id: projectId,
    agent_id:   agentId,
    event_type: 'token_use',
    tokens:     tokensUsed,
    cost,
  })
}
