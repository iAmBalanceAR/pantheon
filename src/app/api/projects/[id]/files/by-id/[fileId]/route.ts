import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Download a single extracted file by row id.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id: projectId, fileId } = await params
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

  const { data: row, error } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return NextResponse.json({ error: 'Deliverables not available' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = row.path.split('/').pop() ?? 'file'
  return new NextResponse(row.content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(base)}"`,
    },
  })
}
