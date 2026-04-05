import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { analyzeSpec } from '@/lib/agents/controller'
import { sanitizeModel } from '@/lib/agents/model-sanitizer'
import { z } from 'zod'

interface InstalledSkillRow {
  library_id: string
  display_name: string
  description: string
  skill_content: string
}

// Allow up to 60s for the Gemini controller analysis
export const maxDuration = 60

const CreateProjectSchema = z.object({
  spec:       z.string().min(10, 'Spec must be at least 10 characters'),
  budget_usd: z.number().min(0.5).max(500).optional().default(5),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const service  = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parse = CreateProjectSchema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })

  const { spec, budget_usd } = parse.data

  // Load user's installed skills so the Controller can include them in team composition
  const { data: installedSkills } = await supabase
    .from('user_installed_skills')
    .select('library_id, display_name, description, skill_content')
    .eq('user_id', user.id) as { data: InstalledSkillRow[] | null }

  const skillsForController = (installedSkills ?? []).map(s => ({
    library_id:   s.library_id,
    display_name: s.display_name,
    description:  s.description,
  }))

  // Build a lookup of library_id → full skill content for agent creation below
  const skillContentMap = Object.fromEntries(
    (installedSkills ?? []).map(s => [s.library_id, s.skill_content])
  )

  // Controller analyzes spec (with installed skills as available extended roles)
  let analysis
  try {
    analysis = await analyzeSpec(spec, skillsForController.length > 0 ? skillsForController : undefined)
  } catch (err) {
    console.error('[Pantheon] analyzeSpec failed:', err)
    return NextResponse.json({ error: 'Controller failed to analyze spec', detail: String(err) }, { status: 500 })
  }

  // Budget: use submitted value, scale minimum by tier
  const tierBudgetFloors: Record<string, number> = {
    micro: 1, small: 2, medium: 5, large: 10, enterprise: 20,
  }
  const effectiveBudget = Math.max(budget_usd, tierBudgetFloors[analysis.tier] ?? 1)

  // Create project — column names match 001_initial.sql schema
  const { data: project, error: projError } = await service
    .from('projects')
    .insert({
      owner_id:       user.id,
      name:           analysis.suggested_name,
      spec,
      spec_score:     analysis.score,
      resource_tier:  analysis.tier,
      status:         'scoping',
      budget_dollars: effectiveBudget,
      budget_tokens:  Math.round(effectiveBudget / 0.000002), // rough token estimate
      stack:          analysis.stack,
    })
    .select()
    .single()

  if (projError || !project) return NextResponse.json({ error: projError?.message }, { status: 500 })

  // Create root team
  const { data: team } = await service.from('teams').insert({
    project_id: project.id,
    name: 'Core Team',
    purpose: 'Primary development team',
    depth: 0,
  }).select().single()

  // Sanitize and create agents
  const CORE_ROLES      = ['controller','banker','auditor','coder','reviewer','researcher','architect','mediator','custom']
  const VALID_PROVIDERS = ['fireworks','gemini']

  const agentInserts = analysis.team.map(a => {
    const { provider, model } = sanitizeModel(
      VALID_PROVIDERS.includes(a.provider) ? a.provider : 'fireworks',
      a.model || 'accounts/fireworks/models/llama-v3p3-70b-instruct'
    )

    // If the Controller assigned a role matching an installed skill, use the skill
    // content as system_prompt and store the agent as role='custom' in the DB.
    // The executor checks system_prompt first, so the skill content takes precedence.
    const isInstalledSkill = !CORE_ROLES.includes(a.role) && skillContentMap[a.role]
    const resolvedRole     = isInstalledSkill ? 'custom' : (CORE_ROLES.includes(a.role) ? a.role : 'custom')
    const systemPrompt     = isInstalledSkill ? (skillContentMap[a.role] ?? null) : null

    return {
      project_id:    project.id,
      team_id:       team?.id,
      role:          resolvedRole,
      display_name:  a.display_name,
      llm_provider:  provider,
      llm_model:     model,
      system_prompt: systemPrompt,
      // Store the library_id on display_name context for traceability
    }
  })

  const { data: insertedAgents, error: agentError } = await service
    .from('agents').insert(agentInserts).select()
  if (agentError) console.error('[Pantheon] Agent insert failed:', agentError.message)

  // Build a role → agent_id lookup for task assignment.
  // Also map installed-skill library IDs → the custom agent that was created for them.
  const roleToAgentId: Record<string, string> = {}
  const inserted = insertedAgents ?? []
  for (const a of inserted) {
    if (!roleToAgentId[a.role]) roleToAgentId[a.role] = a.id
  }
  // Map installed skill IDs to their corresponding custom agent (matched by display_name order)
  const installedSkillAgents = inserted.filter(a => a.system_prompt)
  analysis.team
    .filter(a => !CORE_ROLES.includes(a.role) && skillContentMap[a.role])
    .forEach((a, i) => {
      const matchingAgent = installedSkillAgents[i]
      if (matchingAgent && !roleToAgentId[a.role]) {
        roleToAgentId[a.role] = matchingAgent.id
      }
    })

  // Create sprints and tasks — assign tasks to agents by role
  for (const sprint of analysis.sprints) {
    const { data: sprintRow } = await service.from('sprints').insert({
      project_id: project.id,
      team_id:    team?.id,
      number:     sprint.number,
      name:       sprint.name,
      goal:       sprint.goal,
    }).select().single()

    if (sprintRow) {
      const taskInserts = sprint.tasks.map((t, i) => ({
        sprint_id:   sprintRow.id,
        project_id:  project.id,
        title:       t.title,
        description: t.description,
        // Assign to matching agent; fall back to first coder, then any agent
        agent_id:    roleToAgentId[t.role]
                  ?? roleToAgentId['coder']
                  ?? Object.values(roleToAgentId)[0]
                  ?? null,
        priority:    i,
      }))
      await service.from('tasks').insert(taskInserts)
    }
  }

  // Post welcome message to chat
  await service.from('chat_messages').insert({
    project_id:   project.id,
    sender_id:    'system',
    sender_role:  'system',
    sender_name:  'Pantheon',
    content:      `Project "${project.name}" initialized. Score: ${analysis.score}/5 → ${analysis.tier.toUpperCase()} tier · ${analysis.team.length} agents · ${analysis.sprints.length} sprints · Budget: $${effectiveBudget}${analysis.gaps.length > 0 ? ` · Gaps: ${analysis.gaps.join(', ')}` : ''}`,
    message_type: 'system',
  })

  // Post controller analysis to chat
  await service.from('chat_messages').insert({
    project_id:   project.id,
    sender_id:    'controller',
    sender_role:  'controller',
    sender_name:  'Controller',
    content:      `📋 **Analysis complete.**\n\n${analysis.summary}\n\n**Stack:** ${Object.entries(analysis.stack).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' · ')}`,
    message_type: 'decision',
  })

  return NextResponse.json({ id: project.id, project, analysis }, { status: 201 })
}
