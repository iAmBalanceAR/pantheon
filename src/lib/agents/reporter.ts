/**
 * Generates a structured completion report at the end of a project.
 * Pulls raw data from the DB, then calls the Controller Agent to write
 * a narrative summary. Result is stored in projects.report (JSONB).
 */

import { callLLM } from '@/lib/llm/client'
import { sanitizeModel } from '@/lib/agents/model-sanitizer'
import { createServiceClient } from '@/lib/supabase/server'

export interface AgentSummary {
  id: string
  display_name: string
  role: string
  llm_provider: string
  llm_model: string
  tasks_completed: number
  tasks_failed: number
  tokens_used: number
  cost: number
  avg_duration_ms: number
}

export interface SprintSummary {
  number: number
  name: string | null
  goal: string | null
  status: string
  tasks_total: number
  tasks_completed: number
  tasks_failed: number
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
}

export interface ErrorEntry {
  agent_name: string
  task_title: string
  error: string
  timestamp: string
}

export interface ConflictSummary {
  conflict_type: string
  description: string
  resolution_plan: string | null
  status: string
  created_at: string
}

export interface ProjectReport {
  generated_at: string
  project_id: string
  project_name: string
  stack: Record<string, unknown>
  resource_tier: string
  spec_score: number | null
  duration: {
    started_at: string | null
    completed_at: string
    total_ms: number | null
  }
  sprints: SprintSummary[]
  agents: AgentSummary[]
  errors: ErrorEntry[]
  conflicts: ConflictSummary[]
  budget: {
    tokens_budget: number
    tokens_used: number
    tokens_pct: number
    dollar_budget: number
    dollar_used: number
    dollar_pct: number
  }
  narrative: string
}

export async function generateCompletionReport(projectId: string): Promise<ProjectReport | null> {
  const supabase = createServiceClient()

  // ── Load project ─────────────────────────────────────────
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return null

  // ── Load sprints + tasks ──────────────────────────────────
  const { data: sprints } = await supabase
    .from('sprints')
    .select('*, tasks(*)')
    .eq('project_id', projectId)
    .order('number', { ascending: true })

  // ── Load agents ───────────────────────────────────────────
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('project_id', projectId)

  // ── Load execution log ────────────────────────────────────
  const { data: execLog } = await supabase
    .from('execution_log')
    .select('agent_id, task_id, tokens_in, tokens_out, cost, duration_ms, error, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  // ── Load conflicts ────────────────────────────────────────
  const { data: conflicts } = await supabase
    .from('conflicts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const now = new Date().toISOString()
  const allTasks = (sprints ?? []).flatMap(s => (s as { tasks: unknown[] }).tasks ?? []) as Array<{
    id: string; status: string; title: string; result?: string
  }>

  // ── Build sprint summaries ────────────────────────────────
  const sprintSummaries: SprintSummary[] = (sprints ?? []).map(s => {
    const tasks = ((s as { tasks: unknown[] }).tasks ?? []) as Array<{ status: string }>
    const completed = tasks.filter(t => t.status === 'completed').length
    const failed    = tasks.filter(t => t.status === 'failed').length
    const startMs   = s.started_at ? new Date(s.started_at).getTime() : null
    const endMs     = s.completed_at ? new Date(s.completed_at).getTime() : null
    return {
      number:         s.number,
      name:           s.name,
      goal:           s.goal,
      status:         s.status,
      tasks_total:    tasks.length,
      tasks_completed: completed,
      tasks_failed:   failed,
      started_at:     s.started_at ?? null,
      completed_at:   s.completed_at ?? null,
      duration_ms:    startMs && endMs ? endMs - startMs : null,
    }
  })

  // ── Build agent summaries ─────────────────────────────────
  const agentSummaries: AgentSummary[] = (agents ?? []).map(a => {
    const logs = (execLog ?? []).filter(l => l.agent_id === a.id)
    const errors   = logs.filter(l => l.error)
    const success  = logs.filter(l => !l.error)
    const totalTokens = logs.reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
    const totalCost   = logs.reduce((s, l) => s + Number(l.cost ?? 0), 0)
    const durations   = logs.filter(l => l.duration_ms).map(l => l.duration_ms as number)
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0
    return {
      id:              a.id,
      display_name:    a.display_name,
      role:            a.role,
      llm_provider:    a.llm_provider,
      llm_model:       a.llm_model,
      tasks_completed: success.length,
      tasks_failed:    errors.length,
      tokens_used:     totalTokens,
      cost:            totalCost,
      avg_duration_ms: Math.round(avgDuration),
    }
  })

  // ── Build error log ───────────────────────────────────────
  const agentMap = Object.fromEntries((agents ?? []).map(a => [a.id, a.display_name]))
  const taskMap  = Object.fromEntries(allTasks.map(t => [t.id, t.title]))
  const errorEntries: ErrorEntry[] = (execLog ?? [])
    .filter(l => l.error)
    .map(l => ({
      agent_name: agentMap[l.agent_id] ?? l.agent_id,
      task_title: (l.task_id ? taskMap[l.task_id] : null) ?? '—',
      error:      l.error!,
      timestamp:  l.created_at,
    }))

  // ── Build conflict summaries ──────────────────────────────
  const conflictSummaries: ConflictSummary[] = (conflicts ?? []).map(c => ({
    conflict_type:    c.conflict_type,
    description:      c.description,
    resolution_plan:  c.resolution_plan ?? null,
    status:           c.status,
    created_at:       c.created_at,
  }))

  // ── Calculate project duration ────────────────────────────
  const firstSprint  = (sprints ?? []).find(s => s.started_at)
  const startedAt    = firstSprint?.started_at ?? null
  const totalMs      = startedAt ? new Date(now).getTime() - new Date(startedAt).getTime() : null

  // ── Budget summary ────────────────────────────────────────
  const tokenBudget  = project.budget_tokens ?? 0
  const tokenUsed    = project.tokens_used ?? 0
  const dollarBudget = Number(project.budget_dollars ?? 0)
  const dollarUsed   = Number(project.cost_used ?? 0)

  const budget = {
    tokens_budget: tokenBudget,
    tokens_used:   tokenUsed,
    tokens_pct:    tokenBudget > 0 ? Math.round((tokenUsed / tokenBudget) * 100) : 0,
    dollar_budget: dollarBudget,
    dollar_used:   dollarUsed,
    dollar_pct:    dollarBudget > 0 ? Math.round((dollarUsed / dollarBudget) * 100) : 0,
  }

  // ── Generate narrative via Controller Agent ───────────────
  const narrative = await generateNarrative(project, sprintSummaries, agentSummaries, errorEntries, conflictSummaries, budget)

  const report: ProjectReport = {
    generated_at:  now,
    project_id:    projectId,
    project_name:  project.name,
    stack:         (project.stack as Record<string, unknown>) ?? {},
    resource_tier: project.resource_tier,
    spec_score:    project.spec_score,
    duration: {
      started_at:    startedAt,
      completed_at:  now,
      total_ms:      totalMs,
    },
    sprints:    sprintSummaries,
    agents:     agentSummaries,
    errors:     errorEntries,
    conflicts:  conflictSummaries,
    budget,
    narrative,
  }

  // ── Persist to DB ─────────────────────────────────────────
  await supabase
    .from('projects')
    .update({ report })
    .eq('id', projectId)

  return report
}

async function generateNarrative(
  project: { name: string; spec: string; resource_tier: string },
  sprints: SprintSummary[],
  agents: AgentSummary[],
  errors: ErrorEntry[],
  conflicts: ConflictSummary[],
  budget: { dollar_used: number; dollar_budget: number; tokens_used: number }
): Promise<string> {
  const controllerProvider = (process.env.CONTROLLER_PROVIDER ?? 'gemini') as 'gemini' | 'fireworks' | 'anthropic'
  const controllerModel    = process.env.CONTROLLER_MODEL ?? 'gemini-2.5-flash'
  const { provider, model } = sanitizeModel(controllerProvider, controllerModel)

  const totalTasks     = sprints.reduce((s, sp) => s + sp.tasks_total, 0)
  const completedTasks = sprints.reduce((s, sp) => s + sp.tasks_completed, 0)
  const failedTasks    = sprints.reduce((s, sp) => s + sp.tasks_failed, 0)
  const slowestAgent   = [...agents].sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)[0]
  const mostExpensive  = [...agents].sort((a, b) => b.cost - a.cost)[0]

  const prompt = `You are the Controller Agent writing the final project completion report for "${project.name}".

Project Summary Data:
- Spec score: ${project.resource_tier} tier
- Sprints: ${sprints.length} total
- Tasks: ${completedTasks}/${totalTasks} completed, ${failedTasks} failed
- Budget used: $${budget.dollar_used.toFixed(4)} of $${budget.dollar_budget} (${budget.tokens_used.toLocaleString()} tokens)
- Agents deployed: ${agents.length}
- Errors encountered: ${errors.length}
- Conflicts: ${conflicts.length}
${slowestAgent ? `- Slowest agent: ${slowestAgent.display_name} (avg ${(slowestAgent.avg_duration_ms / 1000).toFixed(1)}s/task)` : ''}
${mostExpensive ? `- Most expensive agent: ${mostExpensive.display_name} ($${mostExpensive.cost.toFixed(4)})` : ''}

Sprint outcomes:
${sprints.map(s => `  Sprint ${s.number} "${s.name ?? ''}": ${s.tasks_completed}/${s.tasks_total} tasks, status: ${s.status}${s.duration_ms ? `, duration: ${Math.round(s.duration_ms / 1000)}s` : ''}`).join('\n')}

${errors.length > 0 ? `Errors:\n${errors.slice(0, 5).map(e => `  - ${e.agent_name} on "${e.task_title}": ${e.error.slice(0, 120)}`).join('\n')}` : ''}

${conflicts.length > 0 ? `Conflicts:\n${conflicts.map(c => `  - ${c.conflict_type}: ${c.description.slice(0, 100)} (${c.status})`).join('\n')}` : ''}

Write a 3-5 paragraph executive summary of this project run. Cover:
1. What was built and whether the spec was met
2. Team performance and any notable agent behavior (fast, slow, expensive, reliable)
3. Any issues, conflicts, or errors — and their impact
4. Budget efficiency
5. What worked well and what could be improved in a future run

Be direct and specific. Use the data. No fluff.`

  try {
    const response = await callLLM(
      provider as Parameters<typeof callLLM>[0],
      model,
      [{ role: 'user', content: prompt }],
      { maxTokens: 1024, temperature: 0.4 }
    )
    return response.content
  } catch {
    return `Project "${project.name}" completed. ${completedTasks}/${totalTasks} tasks across ${sprints.length} sprint(s). $${budget.dollar_used.toFixed(4)} spent of $${budget.dollar_budget} budget. ${errors.length} error(s) encountered. Narrative generation failed — see raw data above.`
  }
}
