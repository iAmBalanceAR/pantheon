import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

/**
 * Download all project_files as a single zip (reconstructed tree by relative path).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: proj } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!proj) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rows, error } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', projectId)

  if (error) {
    if (/relation|does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Deliverables not available', detail: 'Apply migration 003_project_files.sql.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json(
      { error: 'No extracted files yet', detail: 'Complete tasks that emit <file> blocks (e.g. Coder).' },
      { status: 404 },
    )
  }

  const zip = new JSZip()
  for (const row of rows) {
    zip.file(row.path, row.content)
  }
  const u8 = await zip.generateAsync({ type: 'uint8array' })
  const safeName = String(proj.name ?? 'project')
    .replace(/[^\w\-]+/g, '-')
    .slice(0, 48)
    || 'project'

  const blob = new Blob([new Uint8Array(u8)], { type: 'application/zip' })
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}-deliverables.zip"`,
    },
  })
}
