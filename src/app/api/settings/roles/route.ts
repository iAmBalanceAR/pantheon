import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSkillDefinitions } from '@/lib/agents/skill-loader'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const definitions = getSkillDefinitions()
    return NextResponse.json(definitions)
  } catch (err) {
    console.error('[/api/settings/roles] Failed to load skill definitions:', err)
    return NextResponse.json({ error: 'Failed to load role definitions' }, { status: 500 })
  }
}
