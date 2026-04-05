import { callLLM } from '@/lib/llm/client'
import { auditConflictResolution } from '@/lib/agents/auditor'
import type { Agent, Project, LLMProvider } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

const CONTROLLER_PROVIDER = (process.env.CONTROLLER_PROVIDER ?? 'anthropic') as LLMProvider
const CONTROLLER_MODEL    = process.env.CONTROLLER_MODEL ?? 'claude-sonnet-4-6'

// Detect overlap between two agent tasks
export async function detectConflict(
  agentA: Agent,
  agentB: Agent,
  taskA: string,
  taskB: string
): Promise<{ conflict: boolean; type: string; description: string }> {
  const response = await callLLM(
    CONTROLLER_PROVIDER,
    CONTROLLER_MODEL,
    [
      {
        role: 'system',
        content: `You detect conflicts between concurrent agent tasks in a software project. A conflict exists when two tasks touch the same files, modules, APIs, or data structures in incompatible ways. Return JSON: {"conflict": boolean, "type": "overlap"|"merge"|"dependency"|"scope"|"resource"|"none", "description": string}`,
      },
      {
        role: 'user',
        content: `Agent A (${agentA.role}): ${taskA}\n\nAgent B (${agentB.role}): ${taskB}`,
      },
    ],
    { maxTokens: 512, temperature: 0.2 }
  )

  try {
    return JSON.parse(response.content.match(/\{[\s\S]*\}/)![0])
  } catch {
    return { conflict: false, type: 'none', description: '' }
  }
}

// Run the meeting protocol between two conflicting agents
export async function runMeetingProtocol(
  supabase: ReturnType<typeof createServiceClient>,
  conflictId: string,
  project: Project,
  agentA: Agent,
  agentB: Agent,
  conflictDescription: string
): Promise<{ resolved: boolean; plan: string; auditorApproved: boolean }> {
  // Post meeting open to chat
  await supabase.from('chat_messages').insert({
    project_id: project.id,
    sender_id: 'system',
    sender_role: 'system',
    sender_name: 'Pantheon',
    content: `🤝 **CONFLICT MEETING** opened between **${agentA.display_name}** and **${agentB.display_name}**\n\nConflict: ${conflictDescription}`,
    message_type: 'meeting',
  })

  await supabase.from('conflicts').update({ status: 'in_meeting' }).eq('id', conflictId)

  // Agent A presents position
  const positionA = await callLLM(
    agentA.llm_provider, agentA.llm_model,
    [
      {
        role: 'system',
        content: `You are ${agentA.display_name}, a ${agentA.role} agent in a software project. You are in a conflict resolution meeting. Present your current work approach and why it is the right direction. Be concise and technical. Maximum 200 words.`,
      },
      { role: 'user', content: `Conflict description: ${conflictDescription}\n\nPresent your position.` },
    ],
    { maxTokens: 400, temperature: 0.5 }
  )

  await supabase.from('chat_messages').insert({
    project_id: project.id,
    sender_id: agentA.id, sender_role: agentA.role, sender_name: agentA.display_name,
    content: `**My position:** ${positionA.content}`, message_type: 'meeting',
  })

  // Agent B presents position
  const positionB = await callLLM(
    agentB.llm_provider, agentB.llm_model,
    [
      {
        role: 'system',
        content: `You are ${agentB.display_name}, a ${agentB.role} agent in a software project. You are in a conflict resolution meeting. Present your current work approach and why it is the right direction. Consider the other agent's approach. Be concise and technical. Maximum 200 words.`,
      },
      {
        role: 'user',
        content: `Conflict: ${conflictDescription}\n\nAgent A's position: ${positionA.content}\n\nPresent your position.`,
      },
    ],
    { maxTokens: 400, temperature: 0.5 }
  )

  await supabase.from('chat_messages').insert({
    project_id: project.id,
    sender_id: agentB.id, sender_role: agentB.role, sender_name: agentB.display_name,
    content: `**My position:** ${positionB.content}`, message_type: 'meeting',
  })

  // Controller mediates and produces resolution plan
  const mediationResponse = await callLLM(
    CONTROLLER_PROVIDER, CONTROLLER_MODEL,
    [
      {
        role: 'system',
        content: `You are the Controller Agent mediating a conflict between two development agents. Review both positions and produce a clear, actionable resolution plan that resolves the conflict while best serving the project goals. Be specific about who does what.`,
      },
      {
        role: 'user',
        content: `Project spec: ${project.spec}\n\nConflict: ${conflictDescription}\n\n${agentA.display_name} position: ${positionA.content}\n\n${agentB.display_name} position: ${positionB.content}\n\nProvide the resolution plan.`,
      },
    ],
    { maxTokens: 1024, temperature: 0.4 }
  )

  const resolutionPlan = mediationResponse.content

  await supabase.from('chat_messages').insert({
    project_id: project.id,
    sender_id: 'system', sender_role: 'controller', sender_name: 'Controller',
    content: `📋 **Proposed Resolution Plan:**\n\n${resolutionPlan}\n\n_Submitting to Auditor for approval..._`,
    message_type: 'decision',
  })

  // Auditor reviews and approves/rejects
  const auditResult = await auditConflictResolution(project.spec, conflictDescription, resolutionPlan)

  await supabase.from('chat_messages').insert({
    project_id: project.id,
    sender_id: 'system', sender_role: 'auditor', sender_name: 'Auditor',
    content: auditResult.approved
      ? `✅ **AUDITOR APPROVED** the resolution plan.\n\n${auditResult.notes}`
      : `❌ **AUDITOR REJECTED** the resolution plan.\n\n${auditResult.notes}\n\nEscalating to Controller for revision.`,
    message_type: auditResult.approved ? 'approval' : 'rejection',
  })

  await supabase.from('conflicts').update({
    resolution_plan: resolutionPlan,
    auditor_approved: auditResult.approved,
    auditor_notes: auditResult.notes,
    status: auditResult.approved ? 'approved' : 'escalated',
    resolved_at: auditResult.approved ? new Date().toISOString() : null,
  }).eq('id', conflictId)

  return {
    resolved: auditResult.approved,
    plan: resolutionPlan,
    auditorApproved: auditResult.approved,
  }
}
