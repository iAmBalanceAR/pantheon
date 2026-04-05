import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { executeAgentTask } from '@/lib/engine/executor'
import { generateCompletionReport } from '@/lib/agents/reporter'

// Sprint execution can take several minutes; may chain multiple sprints in one request
export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = params.id

  const { data: initialProject } = await service
    .from('projects').select('*').eq('id', projectId).single()

  if (!initialProject) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (initialProject.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (initialProject.status === 'paused') return NextResponse.json({ error: 'Project is paused' }, { status: 409 })
  if (initialProject.status === 'completed') return NextResponse.json({ error: 'Project already complete' }, { status: 409 })

  let sprintsCompletedThisRequest = 0
  let totalTasksRun = 0
  let anyFailedOverall = false
  let lastSprintNumber = 0
  const allResults: Array<{ task_id: string; success: boolean; error?: string }> = []
  let paused = false

  const MAX_SPRINTS_PER_REQUEST = 30

  for (let chain = 0; chain < MAX_SPRINTS_PER_REQUEST; chain++) {
    const { data: project } = await service
      .from('projects').select('*').eq('id', projectId).single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (project.status === 'paused') {
      paused = true
      break
    }

    const { data: sprint } = await service
      .from('sprints')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['pending', 'active'])
      .order('number', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!sprint) {
      await service.from('projects').update({ status: 'completed' }).eq('id', projectId)
      await service.from('chat_messages').insert({
        project_id: projectId, sender_id: 'system',
        sender_role: 'system', sender_name: 'Pantheon',
        content: 'All sprints complete. Project marked as finished.',
        message_type: 'system',
      })
      return NextResponse.json({
        done: true,
        message: 'All sprints complete',
        sprints_completed: sprintsCompletedThisRequest,
        total_tasks_run: totalTasksRun,
        any_failed: anyFailedOverall,
        results: allResults,
        paused: false,
        sprint_number: lastSprintNumber,
      })
    }

    await service.from('projects').update({ status: 'active' }).eq('id', projectId)
    await service.from('sprints').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', sprint.id)

    await service.from('chat_messages').insert({
      project_id: projectId, sender_id: 'system',
      sender_role: 'system', sender_name: 'Pantheon',
      content: `Sprint ${sprint.number} started${sprint.name ? `: ${sprint.name}` : ''}${sprint.goal ? ` — ${sprint.goal}` : ''}`,
      message_type: 'system',
    })

    const { data: team } = await service
      .from('teams').select('*').eq('project_id', projectId).order('created_at').limit(1).single()

    if (!team) {
      return NextResponse.json({ error: 'No team found for project' }, { status: 500 })
    }

    const { data: tasks } = await service
      .from('tasks')
      .select('*')
      .eq('sprint_id', sprint.id)
      .eq('status', 'pending')
      .order('priority', { ascending: true })

    if (!tasks || tasks.length === 0) {
      await service.from('sprints').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sprint.id)
      lastSprintNumber = sprint.number
      sprintsCompletedThisRequest += 1

      const { data: remainingEmpty } = await service
        .from('sprints')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .limit(1)

      const hasMoreAfterEmpty = (remainingEmpty?.length ?? 0) > 0
      if (!hasMoreAfterEmpty) {
        await finishProject(service, projectId, sprint.number)
        return NextResponse.json({
          done: true,
          sprint_number: sprint.number,
          tasks_run: 0,
          sprints_completed: sprintsCompletedThisRequest,
          total_tasks_run: totalTasksRun,
          any_failed: anyFailedOverall,
          results: allResults,
          paused: false,
          message: 'No pending tasks in last sprint; project complete',
        })
      }

      await service.from('chat_messages').insert({
        project_id: projectId, sender_id: 'system',
        sender_role: 'system', sender_name: 'Pantheon',
        content: `Sprint ${sprint.number} had no pending tasks — skipped. Continuing…`,
        message_type: 'system',
      })
      continue
    }

    const { data: agents } = await service
      .from('agents').select('*').eq('project_id', projectId)

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'No agents found for project' }, { status: 500 })
    }

    const agentById: Record<string, typeof agents[0]> = {}
    const agentByRole: Record<string, typeof agents[0]> = {}
    for (const a of agents) {
      agentById[a.id] = a
      if (!agentByRole[a.role]) agentByRole[a.role] = a
    }

    const { data: recentChat } = await service
      .from('chat_messages')
      .select('sender_role, content')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20)

    const chatHistory = (recentChat ?? []).reverse().map(m => ({
      role: (m.sender_role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }))

    const results: Array<{ task_id: string; success: boolean; error?: string }> = []
    let anyFailed = false

    for (const task of tasks) {
      const { data: freshProject } = await service
        .from('projects').select('status').eq('id', projectId).single()
      if (freshProject?.status === 'paused') {
        await service.from('chat_messages').insert({
          project_id: projectId, sender_id: 'system',
          sender_role: 'system', sender_name: 'Pantheon',
          content: `Execution paused after task "${task.title}".`,
          message_type: 'system',
        })
        paused = true
        allResults.push(...results)
        return NextResponse.json({
          done: false,
          paused: true,
          sprint_number: sprint.number,
          tasks_run: results.length,
          sprints_completed: sprintsCompletedThisRequest,
          total_tasks_run: totalTasksRun + results.length,
          any_failed: anyFailedOverall || anyFailed,
          results: allResults,
        })
      }

      const agent = (task.agent_id ? agentById[task.agent_id] : null)
        ?? agentByRole['coder']
        ?? agents.find(a => !['banker', 'auditor', 'controller'].includes(a.role))
        ?? agents[0]

      await service.from('tasks').update({ status: 'in_progress' }).eq('id', task.id)

      const result = await executeAgentTask(
        agent as Parameters<typeof executeAgentTask>[0],
        task as Parameters<typeof executeAgentTask>[1],
        project as Parameters<typeof executeAgentTask>[2],
        sprint as Parameters<typeof executeAgentTask>[3],
        team as Parameters<typeof executeAgentTask>[4],
        chatHistory
      )

      results.push({ task_id: task.id, success: result.success, error: result.error })
      if (!result.success) anyFailed = true

      if (result.output) {
        chatHistory.push({ role: 'assistant', content: result.output })
        if (chatHistory.length > 20) chatHistory.shift()
      }
    }

    allResults.push(...results)
    totalTasksRun += tasks.length
    anyFailedOverall = anyFailedOverall || anyFailed
    lastSprintNumber = sprint.number
    sprintsCompletedThisRequest += 1

    const sprintStatus = anyFailed ? 'review' : 'completed'
    await service.from('sprints').update({
      status: sprintStatus,
      completed_at: new Date().toISOString(),
    }).eq('id', sprint.id)

    const { data: remaining } = await service
      .from('sprints')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .limit(1)

    const hasMore = (remaining?.length ?? 0) > 0

    if (!hasMore) {
      await finishProject(service, projectId, sprint.number)
      return NextResponse.json({
        done: true,
        sprint_number: sprint.number,
        tasks_run: tasks.length,
        sprints_completed: sprintsCompletedThisRequest,
        total_tasks_run: totalTasksRun,
        any_failed: anyFailedOverall,
        results: allResults,
        paused: false,
      })
    }

    await service.from('chat_messages').insert({
      project_id: projectId, sender_id: 'system',
      sender_role: 'system', sender_name: 'Pantheon',
      content: `Sprint ${sprint.number} complete. Starting next sprint automatically…`,
      message_type: 'system',
    })
  }

  return NextResponse.json({
    done: false,
    paused,
    message: `Stopped after ${MAX_SPRINTS_PER_REQUEST} sprints in one run — click Run again to continue.`,
    sprint_number: lastSprintNumber,
    sprints_completed: sprintsCompletedThisRequest,
    total_tasks_run: totalTasksRun,
    any_failed: anyFailedOverall,
    results: allResults,
  })
}

async function finishProject(
  service: ReturnType<typeof createServiceClient>,
  projectId: string,
  lastSprintNumber: number
) {
  await service.from('projects').update({ status: 'completed' }).eq('id', projectId)
  await service.from('chat_messages').insert({
    project_id: projectId, sender_id: 'system',
    sender_role: 'system', sender_name: 'Pantheon',
    content: `Sprint ${lastSprintNumber} complete. All sprints finished — project complete. Generating completion report…`,
    message_type: 'system',
  })

  try {
    await generateCompletionReport(projectId)
    await service.from('chat_messages').insert({
      project_id: projectId, sender_id: 'system',
      sender_role: 'system', sender_name: 'Pantheon',
      content: '📋 Completion report generated. View it in the Report tab.',
      message_type: 'system',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await service.from('chat_messages').insert({
      project_id: projectId, sender_id: 'system',
      sender_role: 'system', sender_name: 'Pantheon',
      content: `⚠️ Report generation failed: ${msg}`,
      message_type: 'system',
    })
  }
}
