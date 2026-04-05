import fs from 'fs'
import path from 'path'

const HELP_DIR = path.join(process.cwd(), 'src', 'content', 'help')

export interface HelpArticleMeta {
  slug: string
  title: string
  description: string
  order: number
}

export interface HelpArticle {
  slug: string
  title: string
  description: string
  order: number
  body: string
}

function parseSimpleYaml(block: string): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const line of block.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    meta[key] = val
  }
  return meta
}

function splitFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m)
  if (!fmMatch) {
    throw new Error(`[Help] Article missing YAML frontmatter`)
  }
  return {
    meta: parseSimpleYaml(fmMatch[1]),
    body: fmMatch[2].trim(),
  }
}

export function listHelpArticles(): HelpArticleMeta[] {
  if (!fs.existsSync(HELP_DIR)) return []

  const files = fs.readdirSync(HELP_DIR).filter(f => f.endsWith('.md'))
  const items: HelpArticleMeta[] = []

  for (const file of files) {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(HELP_DIR, file), 'utf-8')
    const { meta } = splitFrontmatter(raw)
    items.push({
      slug,
      title: meta.title ?? slug,
      description: meta.description ?? '',
      order: Number(meta.order) || 999,
    })
  }

  return items.sort((a, b) => a.order - b.order)
}

export function getHelpArticle(slug: string): HelpArticle | null {
  if (!slug || slug.includes('..') || slug.includes('/')) return null

  const filePath = path.join(HELP_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { meta, body } = splitFrontmatter(raw)

  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? '',
    order: Number(meta.order) || 999,
    body,
  }
}

export function getAllHelpSlugs(): string[] {
  return listHelpArticles().map(a => a.slug)
}
