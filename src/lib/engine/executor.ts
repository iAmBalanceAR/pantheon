import { callLLM } from '@/lib/llm/client'
import { recordUsage, shouldHardStop, shouldWarn } from '@/lib/agents/banker'
import { sanitizeModel } from '@/lib/agents/model-sanitizer'
import { loadSkill, injectUserContext } from '@/lib/agents/skill-loader'
import type { Agent, Task, Project, Sprint, Team, AgentExecutionResult } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { persistTaskOutputFiles } from '@/lib/engine/persist-task-files'

export async function executeAgentTask(
  agent: Agent,
  task: Task,
  project: Project,
  sprint: Sprint,
  team: Team,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentExecutionResult> {
  const supabase = createServiceClient()
  const startTime = Date.now()

  // Pause guard — check fresh project state from DB
  const { data: freshProject } = await supabase.from('projects').select('status').eq('id', project.id).single()
  if (freshProject?.status === 'paused') {
    return {
      success: false,
      output: 'Project is paused. Execution halted.',
      tokens_in: 0, tokens_out: 0, cost: 0,
      duration_ms: 0,
      error: 'PROJECT_PAUSED',
    }
  }

  // Banker hard-stop check
  if (shouldHardStop(project)) {
    await postSystemMessage(supabase, project.id,
      `🚨 BANKER: Hard stop. Project budget exceeded. Agent ${agent.display_name} blocked.`)
    return {
      success: false,
      output: 'Budget exceeded. Execution blocked by Banker.',
      tokens_in: 0, tokens_out: 0, cost: 0,
      duration_ms: 0,
      error: 'BUDGET_EXCEEDED',
    }
  }

  if (shouldWarn(project)) {
    await postSystemMessage(supabase, project.id,
      `⚠️ BANKER: Budget warning. ${agent.display_name} proceeding but non-essential spawning is suspended.`,
      'budget_warning')
  }

  // Mark agent as running
  await supabase.from('agents').update({
    status: 'running',
    last_heartbeat: new Date().toISOString(),
  }).eq('id', agent.id)

  // Post "started" event to chat
  await postAgentMessage(supabase, project.id, agent,
    `Starting task: **${task.title}**`, 'event')

  try {
    // Sanitize provider/model before every call — catches Anthropic, deprecated Fireworks, etc.
    const { provider, model } = sanitizeModel(agent.llm_provider, agent.llm_model)

    // Build system prompt from skill file with structured user context injection
    const customCtx    = await fetchUserCustomContext(project.owner_id, agent.role)
    const skillBody    = agent.system_prompt ?? loadSkill(agent.role)
    const systemPrompt = buildSystemPromptFromSkill(
      injectUserContext(skillBody, customCtx),
      project
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.slice(-10),
      {
        role: 'user' as const,
        content: buildTaskPrompt(task, sprint, project),
      },
    ]

    const response = await callLLM(
      provider as Parameters<typeof callLLM>[0],
      model,
      messages,
      { maxTokens: 4096, temperature: 0.7 }
    )

    const duration_ms = Date.now() - startTime

    // Record usage via Banker
    await recordUsage(supabase, project.id, agent.id, response.tokens_in + response.tokens_out, response.cost)

    // Log execution
    await supabase.from('execution_log').insert({
      agent_id:   agent.id,
      project_id: project.id,
      task_id:    task.id,
      prompt:     buildTaskPrompt(task, sprint, project),
      response:   response.content,
      tokens_in:  response.tokens_in,
      tokens_out: response.tokens_out,
      cost:       response.cost,
      duration_ms,
    })

    // Update task result
    await supabase.from('tasks').update({
      status: 'completed',
      result: response.content,
      tokens_used: response.tokens_in + response.tokens_out,
    }).eq('id', task.id)

    const { written: savedCount, consistencyIssues } = await persistTaskOutputFiles(supabase, {
      projectId: project.id,
      taskId: task.id,
      agentId: agent.id,
      resultText: response.content,
    })
    if (savedCount > 0) {
      await postSystemMessage(
        supabase,
        project.id,
        `📦 Saved **${savedCount}** deliverable file${savedCount === 1 ? '' : 's'} from this task — open the **Files** tab to browse or download a zip.`,
        'system',
      )
    }
    if (consistencyIssues.length > 0) {
      const body = consistencyIssues.map(i => `• ${i.detail}`).join('\n')
      await postSystemMessage(
        supabase,
        project.id,
        `⚠️ **Deliverable check:** Pantheon only stores files inside \`<file>\` tags; it does not auto-create assets from HTML. Please fix and re-run if needed:\n${body}`,
        'system',
      )
    }

    // Post result to chat
    await postAgentMessage(supabase, project.id, agent,
      `✅ Completed: **${task.title}**\n\n${response.content.slice(0, 600)}${response.content.length > 600 ? '…' : ''}`,
      'chat')

    // Mark agent idle
    await supabase.from('agents').update({
      status: 'idle',
      last_heartbeat: new Date().toISOString(),
    }).eq('id', agent.id)

    // Check for spawn request in response
    const spawnRequest = parseSpawnRequest(response.content)

    return {
      success: true,
      output: response.content,
      tokens_in: response.tokens_in,
      tokens_out: response.tokens_out,
      cost: response.cost,
      duration_ms,
      spawn_team: spawnRequest ?? undefined,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const duration_ms = Date.now() - startTime

    await supabase.from('agents').update({ status: 'failed' }).eq('id', agent.id)
    await supabase.from('tasks').update({ status: 'failed' }).eq('id', task.id)
    await supabase.from('execution_log').insert({
      agent_id: agent.id, project_id: project.id, task_id: task.id,
      error, duration_ms, tokens_in: 0, tokens_out: 0, cost: 0,
    })
    await postSystemMessage(supabase, project.id,
      `❌ Agent ${agent.display_name} failed on task "${task.title}": ${error}`)

    return { success: false, output: '', tokens_in: 0, tokens_out: 0, cost: 0, duration_ms, error }
  }
}

function buildSystemPromptFromSkill(skillWithContext: string, project: Project): string {
  return `${skillWithContext}

## Project Context

**Project:** ${project.name}
**Stack:** ${JSON.stringify(project.stack ?? {})}

**Specification:**
${project.spec}

Always be thorough, precise, and production-ready in your work.`
}

async function fetchUserCustomContext(userId: string, role: string): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('user_agent_profiles')
      .select('custom_context')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle()
    return data?.custom_context ?? null
  } catch {
    return null
  }
}

function buildTaskPrompt(task: Task, sprint: Sprint, project: Project): string {
  return `SPRINT ${sprint.number}: ${sprint.name ?? ''}
Sprint goal: ${sprint.goal ?? ''}

YOUR TASK:
Title: ${task.title}
Description: ${task.description ?? ''}
${task.acceptance ? `Acceptance criteria:\n${task.acceptance}` : ''}

**Web assets (global):** For static HTML/CSS/JS, every **relative** \`href\` / \`src\` must match a \`<file path="...">\` in the **same** response (e.g. \`styles.css\`, \`scripts.js\`). Use \`<link rel="stylesheet" href="styles.css">\` and \`<script src="scripts.js" defer></script>\` when using separate files.

**Images:** Prefer **hotlinked \`https://\` URLs** to **free, commercial-use** stock/CDN sources so no image file is required in the zip — e.g. [Shopify Burst](https://www.shopify.com/stock-photos), Unsplash, Pexels, or Wikimedia Commons. Use a **direct image URL** that loads in a browser (not a gallery HTML page). For icons/illustrations, inline SVG or CSS is also fine. Only use a **relative** image path if you emit that image as a \`<file>\` (e.g. SVG text) or as a \`data:image/...\` URL inside HTML — do not reference local \`.png\` / \`.jpg\` paths without a matching \`<file>\` block.

Complete this task fully. If you believe a sub-team should be spawned to improve quality or efficiency, include a JSON block at the END of your response in this exact format:
<spawn_team>
{
  "name": "team name",
  "purpose": "why this sub-team is needed",
  "agents": [{"role": "coder", "display_name": "Agent Name", "provider": "fireworks", "model": "accounts/fireworks/models/llama-v3p1-70b-instruct"}]
}
</spawn_team>`
}

function parseSpawnRequest(content: string) {
  const match = content.match(/<spawn_team>([\s\S]*?)<\/spawn_team>/)
  if (!match) return null
  try { return JSON.parse(match[1].trim()) } catch { return null }
}

async function postAgentMessage(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  agent: Agent,
  content: string,
  messageType: string = 'chat'
) {
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    sender_id: agent.id,
    sender_role: agent.role,
    sender_name: agent.display_name,
    content,
    message_type: messageType,
  })
}

async function postSystemMessage(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  content: string,
  messageType: string = 'system'
) {
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    sender_id: 'system',
    sender_role: 'system',
    sender_name: 'Pantheon',
    content,
    message_type: messageType,
  })
}
