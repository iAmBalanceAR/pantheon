import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const InstallSchema = z.object({
  library_id:   z.string().min(1),
  display_name: z.string().min(1),
  icon:         z.string().min(1),
  category:     z.string().min(1),
  description:  z.string(),
  skill_content: z.string().min(1),
})

const UpdateSchema = z.object({
  library_id:    z.string().min(1),
  skill_content: z.string().min(1),
})

// GET /api/agents/skills — fetch all installed skills for the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_installed_skills')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/agents/skills — install a skill (upsert by library_id)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Handle both install (full object) and update (library_id + skill_content)
  const isUpdate = 'skill_content' in body && Object.keys(body).length === 2
  const schema = isUpdate ? UpdateSchema : InstallSchema
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('user_installed_skills')
    .upsert(
      { user_id: user.id, ...parsed.data },
      { onConflict: 'user_id,library_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/agents/skills — uninstall a skill by library_id
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { library_id } = await req.json()
  if (!library_id) return NextResponse.json({ error: 'library_id required' }, { status: 400 })

  const { error } = await supabase
    .from('user_installed_skills')
    .delete()
    .eq('user_id', user.id)
    .eq('library_id', library_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
