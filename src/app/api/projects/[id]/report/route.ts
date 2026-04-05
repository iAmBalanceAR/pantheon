import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompletionReport } from '@/lib/agents/reporter'

export const maxDuration = 120

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects').select('owner_id').eq('id', id).single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const report = await generateCompletionReport(id)
  if (!report) return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })

  return NextResponse.json({ report })
}
