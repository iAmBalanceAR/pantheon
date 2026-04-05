/**
 * @deprecated — role-prompts.ts is now a shim.
 * All agent skill content lives in src/lib/agents/skills/*.md
 * and is loaded at runtime by skill-loader.ts.
 *
 * This file re-exports the same public interface so existing
 * imports continue to work without changes.
 */
export type { RoleDefinition } from './skill-loader'
export {
  ROLE_DEFINITIONS,
  ROLE_PROMPT_MAP,
  getRoleDefinition,
} from './skill-loader'
