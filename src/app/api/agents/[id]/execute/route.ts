import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { executeAgentTask } from '@/lib/engine/executor'
import { shouldSpawnSubTeam } from '@/lib/agents/controller'
import { TIER_CONFIGS } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params
  const supabase = await createClient()
  const service  = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_id } = await req.json()
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const { data: agent }   = await service.from('agents').select('*').eq('id', agentId).single()
  const { data: task }    = await service.from('tasks').select('*').eq('id', task_id).single()
  if (!agent || !task) return NextResponse.json({ error: 'Agent or task not found' }, { status: 404 })

  const { data: project } = await service.from('projects').select('*').eq('id', agent.project_id).single()
  const { data: sprint }  = await service.from('sprints').select('*').eq('id', task.sprint_id).single()
  const { data: team }    = await service.from('teams').select('*').eq('id', agent.team_id).single()
  if (!project || !sprint || !team) return NextResponse.json({ error: 'Context not found' }, { status: 404 })

  if (project.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch recent chat for context
  const { data: chatHistory } = await service
    .from('chat_messages')
    .select('sender_role, content')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = (chatHistory ?? []).reverse().map(m => ({
    role: (m.sender_role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }))

  const result = await executeAgentTask(agent, task, project, sprint, team, history)

  // Handle sub-team spawn request if present and tier allows it
  if (result.spawn_team) {
    const tierConfig = TIER_CONFIGS[project.resource_tier as keyof typeof TIER_CONFIGS]
    const spawnDecision = await shouldSpawnSubTeam(
      task.description ?? task.title,
      team.depth,
      tierConfig.maxTeamDepth
    )

    if (spawnDecision.spawn && tierConfig.recursiveTeamsAllowed) {
      const { data: subTeam } = await service.from('teams').insert({
        project_id:    project.id,
        parent_team_id: team.id,
        name:           result.spawn_team.name,
        purpose:        result.spawn_team.purpose,
        depth:          team.depth + 1,
        spawned_by:     agent.id,
      }).select().single()

      if (subTeam) {
        const subAgents = result.spawn_team.agents.map((a: { role: string; display_name: string; provider: string; model: string }) => ({
          project_id:   project.id,
          team_id:      subTeam.id,
          role:         a.role,
          display_name: a.display_name,
          llm_provider: a.provider,
          llm_model:    a.model,
        }))
        await service.from('agents').insert(subAgents)

        await service.from('chat_messages').insert({
          project_id: project.id, sender_id: agent.id,
          sender_role: agent.role, sender_name: agent.display_name,
          message_type: 'event',
          content: `🌿 Spawned sub-team **"${subTeam.name}"** (depth ${subTeam.depth})\nPurpose: ${subTeam.purpose}\nAgents: ${result.spawn_team.agents.map((a: { display_name: string }) => a.display_name).join(', ')}`,
        })
      }
    }
  }

  return NextResponse.json(result)
}
