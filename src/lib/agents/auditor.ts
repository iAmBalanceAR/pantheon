import { callLLM } from '@/lib/llm/client'
import type { Sprint, Task, Project, LLMProvider } from '@/types'

const AUDITOR_PROVIDER = (process.env.AUDITOR_PROVIDER ?? 'gemini') as LLMProvider
const AUDITOR_MODEL    = process.env.AUDITOR_MODEL ?? 'gemini-2.5-flash'

export interface AuditResult {
  approved: boolean
  score: number        // 0-100
  summary: string
  issues: AuditIssue[]
  corrections: string[]
  recommendation: 'approve' | 'revise' | 'reject' | 'escalate'
}

export interface AuditIssue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion'
  category: 'scope' | 'code_quality' | 'completeness' | 'security' | 'performance' | 'standards'
  description: string
  file?: string
}

const AUDITOR_SYSTEM = `You are the Auditor Agent for Pantheon, an AI software development platform.

Your responsibility is to review completed sprint work against:
1. The original project specification and acceptance criteria
2. Code quality and best practices for the declared stack
3. Security considerations
4. Completeness — were all tasks actually completed?

SCORING: 0-100
- 90-100: Approve. Exceeds expectations.
- 75-89:  Approve with minor notes.
- 60-74:  Revise. Significant gaps but recoverable.
- 40-59:  Reject. Core requirements unmet.
- 0-39:   Escalate to Controller. Fundamental misalignment.

Return ONLY valid JSON:
{
  "approved": boolean,
  "score": number,
  "summary": string,
  "issues": [{ "severity": string, "category": string, "description": string, "file": string|null }],
  "corrections": string[],
  "recommendation": "approve"|"revise"|"reject"|"escalate"
}`

export async function auditSprint(
  project: Project,
  sprint: Sprint,
  tasks: Task[]
): Promise<AuditResult> {
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks    = tasks.filter(t => t.status === 'failed')
  const pendingTasks   = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')

  const taskSummary = tasks.map(t =>
    `[${t.status.toUpperCase()}] ${t.title}\n${t.result ? `Result: ${t.result.slice(0, 500)}` : 'No result'}`
  ).join('\n\n')

  const response = await callLLM(
    AUDITOR_PROVIDER,
    AUDITOR_MODEL,
    [
      { role: 'system', content: AUDITOR_SYSTEM },
      {
        role: 'user',
        content: `PROJECT SPEC:
${project.spec}

SPRINT ${sprint.number}: ${sprint.name ?? ''}
Goal: ${sprint.goal ?? 'Not specified'}

TASK RESULTS (${completedTasks.length}/${tasks.length} completed, ${failedTasks.length} failed, ${pendingTasks.length} pending):
${taskSummary}

STACK: ${JSON.stringify(project.stack)}

Audit this sprint.`,
      },
    ],
    { maxTokens: 2048, temperature: 0.2 }
  )

  const jsonMatch = response.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      approved: false,
      score: 0,
      summary: 'Auditor failed to produce a valid review.',
      issues: [{ severity: 'critical', category: 'completeness', description: 'Audit response was malformed.' }],
      corrections: ['Re-run the audit.'],
      recommendation: 'escalate',
    }
  }

  return JSON.parse(jsonMatch[0]) as AuditResult
}

export async function auditConflictResolution(
  projectSpec: string,
  conflictDescription: string,
  resolutionPlan: string
): Promise<{ approved: boolean; notes: string }> {
  const response = await callLLM(
    AUDITOR_PROVIDER,
    AUDITOR_MODEL,
    [
      {
        role: 'system',
        content: `You are the Auditor Agent. Review a proposed conflict resolution plan between two agents. Approve if the plan aligns with the project spec and represents sound engineering. Return JSON: {"approved": boolean, "notes": string}`,
      },
      {
        role: 'user',
        content: `Project spec:\n${projectSpec}\n\nConflict:\n${conflictDescription}\n\nProposed resolution:\n${resolutionPlan}`,
      },
    ],
    { maxTokens: 512, temperature: 0.2 }
  )

  try {
    const json = JSON.parse(response.content.match(/\{[\s\S]*\}/)![0])
    return json
  } catch {
    return { approved: false, notes: 'Could not parse auditor response.' }
  }
}
