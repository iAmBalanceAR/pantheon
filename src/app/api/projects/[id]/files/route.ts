import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * List extracted deliverable files for a project (metadata only).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: proj } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!proj) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('project_files')
    .select('id, path, updated_at, task_id, agent_id')
    .eq('project_id', projectId)
    .order('path', { ascending: true })

  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error: 'Deliverables table not installed',
          detail: 'Apply migration 003_project_files.sql in Supabase, then retry.',
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ files: data ?? [] })
}
