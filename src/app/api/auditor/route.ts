import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { auditSprint } from '@/lib/agents/auditor'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const service  = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sprint_id } = await req.json()
  if (!sprint_id) return NextResponse.json({ error: 'sprint_id required' }, { status: 400 })

  const { data: sprint } = await service.from('sprints').select('*').eq('id', sprint_id).single()
  if (!sprint) return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })

  const { data: project } = await service.from('projects').select('*').eq('id', sprint.project_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Verify ownership
  if (project.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: tasks } = await service.from('tasks').select('*').eq('sprint_id', sprint_id)

  // Update sprint to review status
  await service.from('sprints').update({ status: 'review' }).eq('id', sprint_id)

  await service.from('chat_messages').insert({
    project_id: project.id, sender_id: 'system', sender_role: 'auditor',
    sender_name: 'Auditor', message_type: 'event',
    content: `🔍 **Auditor reviewing Sprint ${sprint.number}: ${sprint.name ?? ''}...**`,
  })

  const result = await auditSprint(project, sprint, tasks ?? [])

  // Update sprint with audit result
  await service.from('sprints').update({
    status:        result.approved ? 'approved' : 'rejected',
    auditor_notes: result.summary,
    gate_passed:   result.approved,
    completed_at:  result.approved ? new Date().toISOString() : null,
  }).eq('id', sprint_id)

  // Post audit result to chat
  const icon = result.approved ? '✅' : result.recommendation === 'escalate' ? '🚨' : '❌'
  await service.from('chat_messages').insert({
    project_id:   project.id,
    sender_id:    'system',
    sender_role:  'auditor',
    sender_name:  'Auditor',
    message_type: result.approved ? 'approval' : 'rejection',
    content: `${icon} **Sprint ${sprint.number} Audit — Score: ${result.score}/100**\n\n${result.summary}${result.issues.length > 0 ? `\n\n**Issues:**\n${result.issues.map(i => `• [${i.severity.toUpperCase()}] ${i.description}`).join('\n')}` : ''}${result.corrections.length > 0 ? `\n\n**Required corrections:**\n${result.corrections.map(c => `• ${c}`).join('\n')}` : ''}`,
  })

  return NextResponse.json(result)
}
