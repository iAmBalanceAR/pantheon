import { NextResponse } from 'next/server'
import { SKILLS_LIBRARY } from '@/lib/agents/skills-library/_index'

// GET /api/agents/library — returns the full skills library metadata (no auth required to browse)
export async function GET() {
  return NextResponse.json(SKILLS_LIBRARY)
}
