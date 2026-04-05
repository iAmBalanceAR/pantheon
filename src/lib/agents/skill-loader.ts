/**
 * Skill Loader — server-side only.
 * Reads agent skill markdown files from src/lib/agents/skills/,
 * parses frontmatter metadata, caches content in memory.
 *
 * Provides the same public interface as the old role-prompts.ts
 * so callers need minimal changes.
 */

import fs from 'fs'
import path from 'path'

export interface RoleDefinition {
  role: string
  display_name: string
  description: string
  icon: string
  base_prompt: string  // markdown body without frontmatter
}

// ── File-system helpers ──────────────────────────────────────────────────────

const SKILLS_DIR = path.join(process.cwd(), 'src', 'lib', 'agents', 'skills')

const VALID_ROLES = [
  'controller', 'coder', 'architect', 'reviewer',
  'researcher', 'auditor', 'banker', 'mediator', 'custom',
] as const

interface ParsedSkillFile {
  meta: { role: string; display_name: string; description: string; icon: string }
  body: string
}

function parseSkillFile(raw: string): ParsedSkillFile {
  // Extract YAML frontmatter between first pair of ---
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m)
  if (!fmMatch) {
    throw new Error(`[SkillLoader] Skill file missing frontmatter`)
  }

  const fmBlock = fmMatch[1]
  const body    = fmMatch[2].trim()

  // Parse simple key: value YAML (no nested structures needed)
  const parseLine = (key: string): string => {
    const m = fmBlock.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim() : ''
  }

  return {
    meta: {
      role:         parseLine('role'),
      display_name: parseLine('display_name'),
      description:  parseLine('description'),
      icon:         parseLine('icon'),
    },
    body,
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const _cache = new Map<string, ParsedSkillFile>()

function readSkillFile(role: string): ParsedSkillFile {
  if (_cache.has(role)) return _cache.get(role)!

  const filePath = path.join(SKILLS_DIR, `${role}.md`)

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    if (role !== 'custom') {
      console.warn(`[SkillLoader] No skill file for role "${role}", falling back to custom`)
      return readSkillFile('custom')
    }
    throw new Error(`[SkillLoader] Missing required skill file: ${filePath}`)
  }

  const parsed = parseSkillFile(raw)
  _cache.set(role, parsed)
  return parsed
}

// Eagerly warm the cache on module load so all skill files are read once
// (keeps the hot-path synchronous and avoids Vercel cold-start I/O per request)
for (const role of VALID_ROLES) {
  try { readSkillFile(role) } catch (e) {
    console.error(`[SkillLoader] Failed to load skill "${role}":`, e)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full skill markdown body (without frontmatter) for a role.
 * The body still contains `<!-- USER_CONTEXT_PLACEHOLDER -->`.
 * Call `injectUserContext` before using as a system prompt.
 */
export function loadSkill(role: string): string {
  return readSkillFile(role).body
}

/**
 * Replaces the `<!-- USER_CONTEXT_PLACEHOLDER -->` in a skill body with
 * the user's custom context, or strips the User Context section entirely
 * if no context is provided.
 */
export function injectUserContext(skillBody: string, context: string | null | undefined): string {
  const ctx = context?.trim()

  if (!ctx) {
    // Remove the entire "## User Context" section (heading + placeholder)
    return skillBody
      .replace(/\n## User Context\n\n<!-- USER_CONTEXT_PLACEHOLDER -->\n?/, '')
      .trimEnd()
  }

  return skillBody.replace('<!-- USER_CONTEXT_PLACEHOLDER -->', ctx)
}

/**
 * Returns a RoleDefinition for every valid role, with `base_prompt` set
 * to the full skill body (including placeholder, for display purposes).
 */
export function getSkillDefinitions(): RoleDefinition[] {
  return VALID_ROLES.map(role => {
    const { meta, body } = readSkillFile(role)
    return {
      role:         meta.role || role,
      display_name: meta.display_name,
      description:  meta.description,
      icon:         meta.icon,
      base_prompt:  body,
    }
  })
}

/**
 * Returns the RoleDefinition for a single role, falling back to 'custom'.
 */
export function getRoleDefinition(role: string): RoleDefinition {
  const { meta, body } = readSkillFile(role)
  return {
    role:         meta.role || role,
    display_name: meta.display_name,
    description:  meta.description,
    icon:         meta.icon,
    base_prompt:  body,
  }
}

/**
 * Quick-access map of role → skill body (placeholder still present).
 * Mirrors the old ROLE_PROMPT_MAP interface.
 */
export const ROLE_PROMPT_MAP: Record<string, string> = Object.fromEntries(
  VALID_ROLES.map(role => [role, readSkillFile(role).body])
)

/**
 * Full ROLE_DEFINITIONS array — mirrors old role-prompts.ts interface.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = getSkillDefinitions()
