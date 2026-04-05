/**
 * Cross-check HTML in a single task output against sibling <file> paths.
 * Pantheon does not resolve or fetch assets — this only detects obvious gaps.
 */

import { normalizeDeliverablePath } from '@/lib/engine/file-extractor'

const HREF_SRC_RE = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi

export function isExternalOrNonAssetRef(ref: string): boolean {
  const t = ref.trim()
  if (!t || t === '#' || t.startsWith('#')) return true
  if (/^(https?:)?\/\//i.test(t)) return true
  if (t.startsWith('data:')) return true
  if (/^(mailto|tel|javascript):/i.test(t)) return true
  return false
}

/** Resolve a relative URL from an HTML file path (POSIX-style). */
export function resolveRefFromHtmlFile(htmlPath: string, ref: string): string | null {
  const clean = ref.trim().split('?')[0]?.split('#')[0] ?? ''
  if (!clean || isExternalOrNonAssetRef(clean)) return null

  if (clean.startsWith('/')) {
    return normalizeDeliverablePath(clean.slice(1))
  }

  const dir = htmlPath.includes('/') ? htmlPath.replace(/\/[^/]+$/, '') : ''
  const combined = dir ? `${dir}/${clean}` : clean
  const parts = combined.split('/').filter(Boolean)
  const stack: string[] = []
  for (const p of parts) {
    if (p === '..') {
      if (stack.length === 0) return null
      stack.pop()
    } else if (p !== '.') {
      stack.push(p)
    }
  }
  if (stack.length === 0) return null
  return normalizeDeliverablePath(stack.join('/'))
}

export interface DeliverableRefIssue {
  kind: 'missing_ref' | 'unlinked_asset'
  detail: string
}

/**
 * `files` = extracted deliverables from one agent response (paths already normalized by extractor).
 */
export function analyzeDeliverableConsistency(files: { path: string; content: string }[]): DeliverableRefIssue[] {
  const issues: DeliverableRefIssue[] = []
  const pathSet = new Set<string>()
  for (const f of files) {
    const n = normalizeDeliverablePath(f.path)
    if (n) pathSet.add(n)
  }

  const htmlFiles = files.filter(f => /\.html?$/i.test(f.path))

  for (const hf of htmlFiles) {
    HREF_SRC_RE.lastIndex = 0
    let m: RegExpExecArray | null
    const seen = new Set<string>()
    while ((m = HREF_SRC_RE.exec(hf.content)) !== null) {
      const ref = m[1]
      if (isExternalOrNonAssetRef(ref)) continue
      const resolved = resolveRefFromHtmlFile(hf.path, ref)
      if (!resolved || seen.has(resolved)) continue
      seen.add(resolved)
      if (!pathSet.has(resolved)) {
        issues.push({
          kind: 'missing_ref',
          detail: `${hf.path} references \`${ref}\` → expected \`${resolved}\` in a \`<file path="...">\` block, but it was not included in this output.`,
        })
      }
    }
  }

  if (htmlFiles.length > 0) {
    const htmlBlob = htmlFiles.map(h => h.content).join('\n')
    for (const f of files) {
      if (/\.html?$/i.test(f.path)) continue
      if (!/\.(css|js)$/i.test(f.path)) continue
      const base = f.path.split('/').pop() ?? ''
      if (!base) continue
      const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const linked = new RegExp(`(?:href|src)\\s*=\\s*["'][^"']*${esc}[^"']*["']`, 'i').test(htmlBlob)
      if (!linked) {
        issues.push({
          kind: 'unlinked_asset',
          detail: `File \`${f.path}\` was included but no HTML in this output has a matching \`href\` or \`src\` to it (check path spelling and that the HTML links to your CSS/JS).`,
        })
      }
    }
  }

  return issues
}
