import type { SupabaseClient } from '@supabase/supabase-js'
import { extractFileBlocksFromOutput } from '@/lib/engine/file-extractor'
import { analyzeDeliverableConsistency, type DeliverableRefIssue } from '@/lib/engine/deliverable-refs'

export interface PersistTaskFilesResult {
  written: number
  consistencyIssues: DeliverableRefIssue[]
}

/**
 * Upserts extracted <file> blocks into project_files (last write wins per path).
 * Runs HTML ↔ sibling-file consistency checks on the same response (missing href/src targets, unlinked CSS/JS).
 */
export async function persistTaskOutputFiles(
  supabase: SupabaseClient,
  args: {
    projectId: string
    taskId: string
    agentId: string
    resultText: string
  },
): Promise<PersistTaskFilesResult> {
  const files = extractFileBlocksFromOutput(args.resultText)
  if (files.length === 0) {
    return { written: 0, consistencyIssues: [] }
  }

  let written = 0
  for (const f of files) {
    const { error } = await supabase.from('project_files').upsert(
      {
        project_id: args.projectId,
        task_id: args.taskId,
        agent_id: args.agentId,
        path: f.path,
        content: f.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,path' },
    )
    if (error) {
      console.error('[Pantheon] persistTaskOutputFiles:', f.path, error.message)
      continue
    }
    written += 1
  }

  const consistencyIssues =
    written > 0 ? analyzeDeliverableConsistency(files) : []

  return { written, consistencyIssues }
}
