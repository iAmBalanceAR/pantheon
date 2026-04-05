-- ============================================================
-- Pantheon — Initial Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- PROJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  spec            TEXT NOT NULL,
  spec_score      INTEGER CHECK (spec_score BETWEEN 1 AND 5),
  resource_tier   TEXT NOT NULL DEFAULT 'micro'
                  CHECK (resource_tier IN ('micro','small','medium','large','enterprise')),
  status          TEXT NOT NULL DEFAULT 'scoping'
                  CHECK (status IN ('scoping','active','paused','reviewing','completed','failed')),
  budget_tokens   INTEGER NOT NULL DEFAULT 50000,
  budget_dollars  DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  cost_used       DECIMAL(10,2) NOT NULL DEFAULT 0,
  stack           JSONB DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TEAMS  (recursive — any agent can spawn a sub-team)
-- ────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_team_id  UUID REFERENCES teams(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  purpose         TEXT,
  depth           INTEGER NOT NULL DEFAULT 0,
  spawned_by      UUID,  -- agent_id that created this team (set after agents table)
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','dissolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- AGENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  role            TEXT NOT NULL
                  CHECK (role IN ('controller','banker','auditor','coder','reviewer','researcher','architect','mediator','custom')),
  display_name    TEXT NOT NULL,
  llm_provider    TEXT NOT NULL CHECK (llm_provider IN ('anthropic','fireworks','gemini')),
  llm_model       TEXT NOT NULL,
  system_prompt   TEXT,
  status          TEXT NOT NULL DEFAULT 'idle'
                  CHECK (status IN ('idle','running','waiting','completed','failed','terminated')),
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  last_heartbeat  TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now we can add the FK from teams.spawned_by → agents.id
ALTER TABLE teams ADD CONSTRAINT fk_teams_spawned_by
  FOREIGN KEY (spawned_by) REFERENCES agents(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- SPRINTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE sprints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  number          INTEGER NOT NULL,
  name            TEXT,
  goal            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','review','approved','rejected','completed')),
  auditor_notes   TEXT,
  gate_passed     BOOLEAN,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, number)
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  acceptance      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','blocked','failed')),
  priority        INTEGER NOT NULL DEFAULT 0,
  result          TEXT,
  diff_summary    TEXT,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CHAT MESSAGES  (the shared observable feed)
-- ────────────────────────────────────────────────────────────
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL,   -- agent UUID or 'user' or 'system'
  sender_role     TEXT,            -- controller, banker, auditor, coder, user, system…
  sender_name     TEXT,
  content         TEXT NOT NULL,
  message_type    TEXT NOT NULL DEFAULT 'chat'
                  CHECK (message_type IN ('chat','event','decision','conflict','meeting','approval','rejection','budget_warning','system')),
  parent_id       UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CONFLICTS  (agent collision → meeting protocol)
-- ────────────────────────────────────────────────────────────
CREATE TABLE conflicts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_a_id          UUID REFERENCES agents(id) ON DELETE SET NULL,
  agent_b_id          UUID REFERENCES agents(id) ON DELETE SET NULL,
  conflict_type       TEXT NOT NULL DEFAULT 'overlap'
                      CHECK (conflict_type IN ('overlap','merge','dependency','scope','resource')),
  description         TEXT NOT NULL,
  resolution_plan     TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_meeting','pending_approval','approved','rejected','escalated','resolved')),
  auditor_approved    BOOLEAN,
  auditor_notes       TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- BUDGET EVENTS  (Banker's ledger)
-- ────────────────────────────────────────────────────────────
CREATE TABLE budget_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN ('token_use','cost_update','threshold_warning','hard_stop','budget_increase','reallocation')),
  tokens          INTEGER NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  threshold_pct   INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- EXECUTION LOG  (raw agent output, inspired by Paperclip)
-- ────────────────────────────────────────────────────────────
CREATE TABLE execution_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  prompt          TEXT,
  response        TEXT,
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT triggers
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at   BEFORE UPDATE ON projects   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agents_updated_at     BEFORE UPDATE ON agents     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at      BEFORE UPDATE ON tasks      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_log  ENABLE ROW LEVEL SECURITY;

-- Projects: owner only
CREATE POLICY "owner_select" ON projects FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owner_insert" ON projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner_update" ON projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner_delete" ON projects FOR DELETE USING (auth.uid() = owner_id);

-- All child tables: access if you own the parent project
CREATE POLICY "project_owner" ON teams          FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON agents         FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON sprints        FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON tasks          FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON chat_messages  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON conflicts      FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON budget_events  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));
CREATE POLICY "project_owner" ON execution_log  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

-- Service role bypasses RLS (for server-side agent operations)
-- (Service role key used in API routes bypasses RLS automatically)

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_projects_owner      ON projects(owner_id);
CREATE INDEX idx_teams_project       ON teams(project_id);
CREATE INDEX idx_agents_project      ON agents(project_id);
CREATE INDEX idx_agents_team         ON agents(team_id);
CREATE INDEX idx_sprints_project     ON sprints(project_id);
CREATE INDEX idx_tasks_sprint        ON tasks(sprint_id);
CREATE INDEX idx_tasks_agent         ON tasks(agent_id);
CREATE INDEX idx_chat_project        ON chat_messages(project_id, created_at DESC);
CREATE INDEX idx_budget_project      ON budget_events(project_id, created_at DESC);
CREATE INDEX idx_execlog_agent       ON execution_log(agent_id, created_at DESC);
CREATE INDEX idx_conflicts_project   ON conflicts(project_id);

-- Enable Realtime on chat_messages so the frontend can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE sprints;
