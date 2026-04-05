import { callLLM } from '@/lib/llm/client'
import type { SpecAnalysis, ResourceTier, AgentRole, LLMProvider } from '@/types'
import { TIER_CONFIGS } from '@/types'

const CONTROLLER_PROVIDER = (process.env.CONTROLLER_PROVIDER ?? 'gemini') as LLMProvider
const CONTROLLER_MODEL    = process.env.CONTROLLER_MODEL ?? 'gemini-2.5-flash'
const CODER_PROVIDER      = (process.env.CODER_PROVIDER ?? 'fireworks') as LLMProvider
const CODER_MODEL         = process.env.CODER_MODEL ?? 'accounts/fireworks/models/llama-v3p1-70b-instruct'
const AUDITOR_PROVIDER    = (process.env.AUDITOR_PROVIDER ?? 'gemini') as LLMProvider
const AUDITOR_MODEL       = process.env.AUDITOR_MODEL ?? 'gemini-2.5-flash'
const BANKER_PROVIDER     = (process.env.BANKER_PROVIDER ?? 'fireworks') as LLMProvider
const BANKER_MODEL        = process.env.BANKER_MODEL ?? 'accounts/fireworks/models/llama-v3p3-70b-instruct'

const SPEC_SCORING_PROMPT = `You are the Controller Agent for Pantheon, an AI-driven software development platform.

Your job is to analyze a project specification and return a structured JSON plan.

SCORING RUBRIC (1-5):
1 - Single vague sentence. No stack, no constraints, no acceptance criteria.
2 - A paragraph with a rough goal but gaps in stack/scope.
3 - Clear goal, implied stack, some acceptance criteria, missing edge cases.
4 - Well-defined scope, explicit stack, clear acceptance criteria, non-functional requirements present.
5 - Formal spec: detailed architecture, acceptance criteria, performance requirements, security considerations, explicit stack.

TIER MAP:
1 → micro   (3 agents, 0 recursion depth, 1 sprint)
2 → small   (8 agents, 1 recursion depth, 3 sprints)
3 → medium  (20 agents, 2 recursion depth, 8 sprints)
4 → large   (50 agents, 3 recursion depth, 20 sprints)
5 → enterprise (unlimited)

TEAM COMPOSITION RULES:
- Always include: controller, banker, auditor
- micro/small: add coder(s) only
- medium+: add architect, reviewer, researcher as needed
- Any agent can be 'custom' for specialized roles

VALID PROVIDERS (use exactly as shown): fireworks, gemini
VALID ROLES (use exactly as shown): controller, banker, auditor, coder, reviewer, researcher, architect, mediator, custom

DO NOT use anthropic as a provider. Only fireworks and gemini are available.

RECOMMENDED MODELS:
- controller:  provider=gemini,    model=gemini-2.5-flash
- auditor:     provider=gemini,    model=gemini-2.5-flash
- architect:   provider=gemini,    model=gemini-2.5-flash
- reviewer:    provider=gemini,    model=gemini-2.5-flash
- banker:      provider=fireworks, model=accounts/fireworks/models/llama-v3p3-70b-instruct
- coder:       provider=fireworks, model=accounts/fireworks/models/llama-v3p3-70b-instruct
- researcher:  provider=fireworks, model=accounts/fireworks/models/llama-v3p3-70b-instruct

Return ONLY valid JSON matching this exact shape:
{
  "score": number,
  "tier": string,
  "summary": string,
  "gaps": string[],
  "suggested_name": string,
  "stack": { "frontend": string, "backend": string, "database": string, "other": string[] },
  "sprints": [{ "number": number, "name": string, "goal": string, "tasks": [{ "title": string, "description": string, "role": string }] }],
  "team": [{ "role": string, "display_name": string, "provider": string, "model": string, "purpose": string }]
}`

export interface InstalledSkillRef {
  library_id: string
  display_name: string
  description: string
}

export async function analyzeSpec(
  spec: string,
  installedSkills?: InstalledSkillRef[]
): Promise<SpecAnalysis> {
  const isGemini = CONTROLLER_PROVIDER === 'gemini'

  // Build the effective system prompt — extend VALID ROLES and add skill descriptions
  // when the user has installed custom skills
  let effectivePrompt = SPEC_SCORING_PROMPT
  if (installedSkills && installedSkills.length > 0) {
    const skillLines = installedSkills.map(s => `- ${s.library_id}: "${s.display_name} — ${s.description}"`).join('\n')
    const extendedRoles = [
      'controller','banker','auditor','coder','reviewer','researcher','architect','mediator','custom',
      ...installedSkills.map(s => s.library_id),
    ].join(', ')

    effectivePrompt = effectivePrompt
      .replace(
        /VALID ROLES \(use exactly as shown\):.*$/m,
        `VALID ROLES (use exactly as shown): ${extendedRoles}`
      )
      + `\n\nAVAILABLE CUSTOM SKILLS (installed by this user — use these roles when they are the best fit for a task):\n${skillLines}`
  }

  const response = await callLLM(
    CONTROLLER_PROVIDER,
    CONTROLLER_MODEL,
    [
      { role: 'system', content: effectivePrompt },
      { role: 'user', content: `Analyze this project specification:\n\n${spec}` },
    ],
    { maxTokens: 4096, temperature: 0.3, jsonMode: isGemini }
  )

  const raw = response.content.trim()

  // Extraction strategy: try these in order
  let jsonText: string | null = null

  // 1. If jsonMode was used, the whole response should be valid JSON
  if (isGemini) {
    jsonText = raw
  }

  // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (!jsonText) {
    const fenceMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (fenceMatch) jsonText = fenceMatch[1]
  }

  // 3. Greedy match — first { to last }
  if (!jsonText) {
    const greedyMatch = raw.match(/\{[\s\S]*\}/)
    if (greedyMatch) jsonText = greedyMatch[0]
  }

  if (!jsonText) {
    console.error('[Controller] Raw LLM response that failed JSON extraction:\n', raw)
    throw new Error('Controller failed to return valid JSON analysis')
  }

  let analysis: SpecAnalysis
  try {
    analysis = JSON.parse(jsonText) as SpecAnalysis
  } catch (parseErr) {
    console.error('[Controller] JSON parse failed. Raw text:\n', jsonText)
    throw new Error(`Controller returned malformed JSON: ${(parseErr as Error).message}`)
  }

  // Validate tier against score
  const expectedTier = scoreTotier(analysis.score)
  analysis.tier = expectedTier

  // Always ensure governance agents are in team
  ensureGovernanceAgents(analysis)

  return analysis
}

function scoreTotier(score: number): ResourceTier {
  if (score >= 5) return 'enterprise'
  if (score >= 4) return 'large'
  if (score >= 3) return 'medium'
  if (score >= 2) return 'small'
  return 'micro'
}

function ensureGovernanceAgents(analysis: SpecAnalysis) {
  const roles = analysis.team.map(a => a.role)

  if (!roles.includes('controller')) {
    analysis.team.unshift({
      role: 'controller', display_name: 'Controller',
      provider: CONTROLLER_PROVIDER, model: CONTROLLER_MODEL,
      purpose: 'Orchestrates the team, manages scope, spawns sub-teams',
    })
  }
  if (!roles.includes('banker')) {
    analysis.team.push({
      role: 'banker', display_name: 'Banker',
      provider: BANKER_PROVIDER, model: BANKER_MODEL,
      purpose: 'Monitors LLM usage and enforces budget guardrails',
    })
  }
  if (!roles.includes('auditor')) {
    analysis.team.push({
      role: 'auditor', display_name: 'Auditor',
      provider: AUDITOR_PROVIDER, model: AUDITOR_MODEL,
      purpose: 'Reviews completed sprints against scope and code standards',
    })
  }
}

// ─── Sprint task decomposition ──────────────────────────────

export async function decomposeTask(
  projectSpec: string,
  sprintGoal: string,
  agentRole: AgentRole
): Promise<string> {
  const tier = TIER_CONFIGS
  const response = await callLLM(
    CONTROLLER_PROVIDER,
    CONTROLLER_MODEL,
    [
      {
        role: 'system',
        content: `You are the Controller Agent. Decompose the following sprint task into a clear, actionable implementation plan for a ${agentRole} agent. Be specific and technical. Return plain text.`,
      },
      {
        role: 'user',
        content: `Project spec:\n${projectSpec}\n\nSprint goal:\n${sprintGoal}\n\nGenerate implementation instructions for the ${agentRole} agent.`,
      },
    ],
    { maxTokens: 2048, temperature: 0.5 }
  )
  return response.content
}

// ─── Sub-team spawn decision ─────────────────────────────────

export async function shouldSpawnSubTeam(
  taskDescription: string,
  currentDepth: number,
  maxDepth: number
): Promise<{ spawn: boolean; reason: string; teamPurpose?: string }> {
  if (currentDepth >= maxDepth) {
    return { spawn: false, reason: 'Max recursion depth reached' }
  }

  const response = await callLLM(
    CONTROLLER_PROVIDER,
    CONTROLLER_MODEL,
    [
      {
        role: 'system',
        content: `You are the Controller Agent. Determine whether spawning a sub-team would meaningfully improve efficiency or quality for this task. Consider: task complexity, parallelization potential, specialization needs. Return JSON: {"spawn": boolean, "reason": string, "teamPurpose": string|null}`,
      },
      { role: 'user', content: `Task: ${taskDescription}\nCurrent depth: ${currentDepth}/${maxDepth}` },
    ],
    { maxTokens: 512, temperature: 0.3 }
  )

  try {
    const raw = response.content.trim()
    const fenceMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const jsonText = fenceMatch ? fenceMatch[1] : (raw.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    return JSON.parse(jsonText)
  } catch {
    return { spawn: false, reason: 'Could not parse spawn decision' }
  }
}
