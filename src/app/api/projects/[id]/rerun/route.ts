import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Reset a project so all sprints/tasks can run again from the beginning.
 * Allowed when the project is not actively executing (not active/running).
 */
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project, error: projErr } = await service
    .from('projects')
    .select('id, owner_id, status')
    .eq('id', projectId)
    .single()

  if (projErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = project.status as string
  if (status === 'active' || status === 'running') {
    return NextResponse.json(
      { error: 'Pause the project before rerunning.' },
      { status: 409 },
    )
  }

  const allowed = ['completed', 'failed', 'paused', 'reviewing']
  if (!allowed.includes(status)) {
    return NextResponse.json(
      {
        error: `Rerun is only for complete, failed, paused, or reviewing projects. Current status: "${status}". Pause first if agents are running.`,
      },
      { status: 409 },
    )
  }

  await service.from('conflicts').delete().eq('project_id', projectId)
  await service.from('execution_log').delete().eq('project_id', projectId)
  await service.from('budget_events').delete().eq('project_id', projectId)

  const { error: pfErr } = await service.from('project_files').delete().eq('project_id', projectId)
  if (pfErr && !/relation|does not exist/i.test(pfErr.message)) {
    console.warn('[Pantheon] rerun: project_files delete', pfErr.message)
  }

  await service
    .from('sprints')
    .update({
      status: 'pending',
      started_at: null,
      completed_at: null,
      auditor_notes: null,
      gate_passed: null,
    })
    .eq('project_id', projectId)

  await service
    .from('tasks')
    .update({
      status: 'pending',
      result: null,
      diff_summary: null,
      tokens_used: 0,
    })
    .eq('project_id', projectId)

  await service
    .from('agents')
    .update({
      status: 'idle',
      tokens_used: 0,
      cost: 0,
      last_heartbeat: null,
    })
    .eq('project_id', projectId)

  await service
    .from('projects')
    .update({
      status: 'scoping',
      tokens_used: 0,
      cost_used: 0,
      report: null,
    })
    .eq('id', projectId)

  await service.from('chat_messages').insert({
    project_id: projectId,
    sender_id: 'system',
    sender_role: 'system',
    sender_name: 'Pantheon',
    content:
      '🔄 **Project rerun:** all sprints and tasks were reset to pending, usage counters cleared, deliverable files removed, and the completion report cleared. Chat history above is preserved. Use **Start project** to run again from sprint 1.',
    message_type: 'system',
  })

  return NextResponse.json({ ok: true })
}
