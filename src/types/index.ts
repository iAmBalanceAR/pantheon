// ============================================================
// Pantheon — Core Types
// ============================================================

export type ResourceTier = 'micro' | 'small' | 'medium' | 'large' | 'enterprise'
export type ProjectStatus = 'scoping' | 'active' | 'paused' | 'reviewing' | 'completed' | 'failed'
export type AgentRole = 'controller' | 'banker' | 'auditor' | 'coder' | 'reviewer' | 'researcher' | 'architect' | 'mediator' | 'custom'
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'failed' | 'terminated'
export type LLMProvider = 'anthropic' | 'fireworks' | 'gemini'
export type SprintStatus = 'pending' | 'active' | 'review' | 'approved' | 'rejected' | 'completed'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed'
export type MessageType = 'chat' | 'event' | 'decision' | 'conflict' | 'meeting' | 'approval' | 'rejection' | 'budget_warning' | 'system'
export type ConflictStatus = 'open' | 'in_meeting' | 'pending_approval' | 'approved' | 'rejected' | 'escalated' | 'resolved'
export type ConflictType = 'overlap' | 'merge' | 'dependency' | 'scope' | 'resource'

// ────────────────────────────────────────────────────────────
// Database row types
// ────────────────────────────────────────────────────────────

export interface Project {
  id: string
  owner_id: string
  name: string
  spec: string
  spec_score: number | null
  resource_tier: ResourceTier
  status: ProjectStatus
  budget_tokens: number
  budget_dollars: number
  tokens_used: number
  cost_used: number
  stack: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  project_id: string
  parent_team_id: string | null
  name: string
  purpose: string | null
  depth: number
  spawned_by: string | null
  status: 'active' | 'dissolved'
  created_at: string
}

export interface Agent {
  id: string
  project_id: string
  team_id: string | null
  role: AgentRole
  display_name: string
  llm_provider: LLMProvider
  llm_model: string
  system_prompt: string | null
  status: AgentStatus
  tokens_used: number
  cost: number
  last_heartbeat: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Sprint {
  id: string
  project_id: string
  team_id: string | null
  number: number
  name: string | null
  goal: string | null
  status: SprintStatus
  auditor_notes: string | null
  gate_passed: boolean | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Task {
  id: string
  sprint_id: string
  project_id: string
  agent_id: string | null
  title: string
  description: string | null
  acceptance: string | null
  status: TaskStatus
  priority: number
  result: string | null
  diff_summary: string | null
  tokens_used: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  project_id: string
  sender_id: string
  sender_role: string | null
  sender_name: string | null
  content: string
  message_type: MessageType
  parent_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Conflict {
  id: string
  project_id: string
  agent_a_id: string | null
  agent_b_id: string | null
  conflict_type: ConflictType
  description: string
  resolution_plan: string | null
  status: ConflictStatus
  auditor_approved: boolean | null
  auditor_notes: string | null
  resolved_at: string | null
  created_at: string
}

export interface BudgetEvent {
  id: string
  project_id: string
  agent_id: string | null
  event_type: 'token_use' | 'cost_update' | 'threshold_warning' | 'hard_stop' | 'budget_increase' | 'reallocation'
  tokens: number
  cost: number
  threshold_pct: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ExecutionLog {
  id: string
  agent_id: string
  project_id: string
  task_id: string | null
  prompt: string | null
  response: string | null
  tokens_in: number
  tokens_out: number
  cost: number
  duration_ms: number | null
  error: string | null
  created_at: string
}

// ────────────────────────────────────────────────────────────
// Resource tier rules  (the graduating scale)
// ────────────────────────────────────────────────────────────

export interface TierConfig {
  label: string
  minSpecScore: number
  maxAgents: number
  maxTeamDepth: number
  maxSprints: number
  defaultBudgetTokens: number
  defaultBudgetDollars: number
  recursiveTeamsAllowed: boolean
  description: string
}

export const TIER_CONFIGS: Record<ResourceTier, TierConfig> = {
  micro: {
    label: 'Micro',
    minSpecScore: 1,
    maxAgents: 3,
    maxTeamDepth: 0,
    maxSprints: 1,
    defaultBudgetTokens: 50_000,
    defaultBudgetDollars: 1,
    recursiveTeamsAllowed: false,
    description: 'Single-shot. One controller, one coder, one auditor.',
  },
  small: {
    label: 'Small',
    minSpecScore: 2,
    maxAgents: 8,
    maxTeamDepth: 1,
    maxSprints: 3,
    defaultBudgetTokens: 200_000,
    defaultBudgetDollars: 5,
    recursiveTeamsAllowed: false,
    description: 'Small team. Up to 3 sprints, no sub-teams.',
  },
  medium: {
    label: 'Medium',
    minSpecScore: 3,
    maxAgents: 20,
    maxTeamDepth: 2,
    maxSprints: 8,
    defaultBudgetTokens: 750_000,
    defaultBudgetDollars: 20,
    recursiveTeamsAllowed: true,
    description: 'Full team with specialist agents. Sub-teams enabled.',
  },
  large: {
    label: 'Large',
    minSpecScore: 4,
    maxAgents: 50,
    maxTeamDepth: 3,
    maxSprints: 20,
    defaultBudgetTokens: 3_000_000,
    defaultBudgetDollars: 75,
    recursiveTeamsAllowed: true,
    description: 'Enterprise-scale. Deep recursion, unlimited sprints.',
  },
  enterprise: {
    label: 'Enterprise',
    minSpecScore: 5,
    maxAgents: 999,
    maxTeamDepth: 5,
    maxSprints: 999,
    defaultBudgetTokens: 10_000_000,
    defaultBudgetDollars: 250,
    recursiveTeamsAllowed: true,
    description: 'Fully specced project. All constraints unlocked.',
  },
}

// ────────────────────────────────────────────────────────────
// LLM types
// ────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  tokens_in: number
  tokens_out: number
  cost: number
  model: string
  provider: LLMProvider
}

// ────────────────────────────────────────────────────────────
// Agent execution types
// ────────────────────────────────────────────────────────────

export interface AgentExecutionContext {
  project: Project
  agent: Agent
  task: Task
  sprint: Sprint
  team: Team
  chatHistory: ChatMessage[]
}

export interface AgentExecutionResult {
  success: boolean
  output: string
  tokens_in: number
  tokens_out: number
  cost: number
  duration_ms: number
  spawn_team?: SpawnTeamRequest
  error?: string
}

export interface SpawnTeamRequest {
  name: string
  purpose: string
  agents: Array<{
    role: AgentRole
    display_name: string
    provider: LLMProvider
    model: string
  }>
}

// ────────────────────────────────────────────────────────────
// Supabase Database type (matches actual schema column names)
// ────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          spec: string
          spec_score: number | null
          resource_tier: string | null
          status: string
          budget_tokens: number
          budget_dollars: number
          tokens_used: number
          cost_used: number
          stack: Record<string, unknown> | null
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['projects']['Row']>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
      }
      agents: {
        Row: {
          id: string
          project_id: string
          team_id: string | null
          role: string
          display_name: string
          llm_provider: string
          llm_model: string
          system_prompt: string | null
          status: string
          tokens_used: number
          cost: number
          last_heartbeat: string | null
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['agents']['Row']>
        Update: Partial<Database['public']['Tables']['agents']['Row']>
      }
      sprints: {
        Row: {
          id: string
          project_id: string
          team_id: string | null
          number: number
          name: string | null
          goal: string | null
          status: string
          auditor_notes: string | null
          gate_passed: boolean | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['sprints']['Row']>
        Update: Partial<Database['public']['Tables']['sprints']['Row']>
      }
      chat_messages: {
        Row: {
          id: string
          project_id: string
          agent_id: string | null
          role: string
          content: string
          message_type: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['chat_messages']['Row']>
        Update: Partial<Database['public']['Tables']['chat_messages']['Row']>
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          task_id: string | null
          agent_id: string | null
          path: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['project_files']['Row']>
        Update: Partial<Database['public']['Tables']['project_files']['Row']>
      }
      controller_profiles: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string
          provider: string
          model: string
          system_prompt_override: string
          tier_lock: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['controller_profiles']['Row']>
        Update: Partial<Database['public']['Tables']['controller_profiles']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

// ────────────────────────────────────────────────────────────
// Controller output types
// ────────────────────────────────────────────────────────────

export interface SpecAnalysis {
  score: number            // 1–5
  tier: ResourceTier
  summary: string
  gaps: string[]
  suggested_name: string
  stack: {
    frontend?: string
    backend?: string
    database?: string
    other?: string[]
  }
  sprints: Array<{
    number: number
    name: string
    goal: string
    tasks: Array<{ title: string; description: string; role: AgentRole }>
  }>
  team: Array<{
    role: AgentRole
    display_name: string
    provider: LLMProvider
    model: string
    purpose: string
  }>
}
