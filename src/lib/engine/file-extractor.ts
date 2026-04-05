/**
 * Extract `<file path="relative/path">...</file>` blocks from agent task output.
 * Used to land concrete deliverables regardless of project "type".
 */

export interface ExtractedFile {
  path: string
  content: string
}

const FILE_BLOCK_RE = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi

/**
 * Normalize to a safe relative path; rejects traversal / empty.
 */
export function normalizeDeliverablePath(raw: string): string | null {
  let p = raw.trim().replace(/\\/g, '/')
  if (p.startsWith('/')) p = p.slice(1)
  const parts = p.split('/').filter(Boolean)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '..') {
      if (stack.length === 0) return null
      stack.pop()
    } else if (part !== '.' && part.length > 0) {
      stack.push(part)
    }
  }
  if (stack.length === 0) return null
  return stack.join('/')
}

export function extractFileBlocksFromOutput(text: string): ExtractedFile[] {
  if (!text?.trim()) return []
  const out: ExtractedFile[] = []
  FILE_BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FILE_BLOCK_RE.exec(text)) !== null) {
    const normalized = normalizeDeliverablePath(m[1])
    if (!normalized) continue
    const content = m[2].replace(/^\n/, '').replace(/\n$/, '')
    out.push({ path: normalized, content })
  }
  return out
}
