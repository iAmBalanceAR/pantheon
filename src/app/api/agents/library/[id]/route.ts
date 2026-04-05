import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { SKILLS_LIBRARY } from '@/lib/agents/skills-library/_index'

const LIBRARY_DIR = path.join(process.cwd(), 'src', 'lib', 'agents', 'skills-library')

// GET /api/agents/library/[id] — returns full skill content for a specific skill
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const meta = SKILLS_LIBRARY.find(s => s.id === params.id)
  if (!meta) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

  const filePath = path.join(LIBRARY_DIR, `${params.id}.md`)
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'Skill file missing' }, { status: 500 })
  }

  // Strip frontmatter to return just the body
  const fmMatch = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/m)
  const body = fmMatch ? fmMatch[1].trim() : raw.trim()

  return NextResponse.json({ ...meta, body })
}
