-- ============================================================
-- Pantheon — Complete Database Schema
-- Version: 0.9.0-beta
--
-- Run this entire file once in Supabase SQL Editor to set up
-- a fresh Pantheon database from scratch.
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ────────────────────────────────────────────────────────────
-- SHARED TRIGGER FUNCTION — updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Alias used by migration 005
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- PROJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  spec            TEXT        NOT NULL,
  spec_score      INTEGER     CHECK (spec_score BETWEEN 1 AND 5),
  resource_tier   TEXT        NOT NULL DEFAULT 'micro'
                              CHECK (resource_tier IN ('micro','small','medium','large','enterprise')),
  status          TEXT        NOT NULL DEFAULT 'scoping'
                              CHECK (status IN ('scoping','active','paused','reviewing','completed','failed')),
  budget_tokens   INTEGER     NOT NULL DEFAULT 50000,
  budget_dollars  DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  tokens_used     INTEGER     NOT NULL DEFAULT 0,
  cost_used       DECIMAL(10,2) NOT NULL DEFAULT 0,
  stack           JSONB       DEFAULT '{}',
  report          JSONB,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- TEAMS  (recursive — any agent can spawn a sub-team)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_team_id  UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  purpose         TEXT,
  depth           INTEGER     NOT NULL DEFAULT 0,
  spawned_by      UUID,       -- agent_id (FK added after agents table)
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','dissolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- AGENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agents (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id         UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  role            TEXT        NOT NULL
                              CHECK (role IN ('controller','banker','auditor','coder','reviewer','researcher','architect','mediator','custom')),
  display_name    TEXT        NOT NULL,
  llm_provider    TEXT        NOT NULL CHECK (llm_provider IN ('anthropic','fireworks','gemini')),
  llm_model       TEXT        NOT NULL,
  system_prompt   TEXT,
  status          TEXT        NOT NULL DEFAULT 'idle'
                              CHECK (status IN ('idle','running','waiting','completed','failed','terminated')),
  tokens_used     INTEGER     NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  last_heartbeat  TIMESTAMPTZ,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_agents_updated_at ON public.agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add FK from teams.spawned_by → agents (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_spawned_by'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT fk_teams_spawned_by
      FOREIGN KEY (spawned_by) REFERENCES public.agents(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- SPRINTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sprints (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id         UUID        REFERENCES public.teams(id) ON DELETE SET NULL,
  number          INTEGER     NOT NULL,
  name            TEXT,
  goal            TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
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
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sprint_id       UUID        NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id        UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  acceptance      TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_progress','completed','blocked','failed')),
  priority        INTEGER     NOT NULL DEFAULT 0,
  result          TEXT,
  diff_summary    TEXT,
  tokens_used     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- CHAT MESSAGES  (the shared observable feed)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id       TEXT        NOT NULL,   -- agent UUID or 'user' or 'system'
  sender_role     TEXT,
  sender_name     TEXT,
  content         TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'chat'
                              CHECK (message_type IN ('chat','event','decision','conflict','meeting','approval','rejection','budget_warning','system')),
  parent_id       UUID        REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- CONFLICTS  (agent collision → meeting protocol)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conflicts (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_a_id          UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_b_id          UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  conflict_type       TEXT        NOT NULL DEFAULT 'overlap'
                                  CHECK (conflict_type IN ('overlap','merge','dependency','scope','resource')),
  description         TEXT        NOT NULL,
  resolution_plan     TEXT,
  status              TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','in_meeting','pending_approval','approved','rejected','escalated','resolved')),
  auditor_approved    BOOLEAN,
  auditor_notes       TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- BUDGET EVENTS  (Banker's ledger)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id        UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL
                              CHECK (event_type IN ('token_use','cost_update','threshold_warning','hard_stop','budget_increase','reallocation')),
  tokens          INTEGER     NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  threshold_pct   INTEGER,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- EXECUTION LOG  (raw agent output)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.execution_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id         UUID        REFERENCES public.tasks(id) ON DELETE SET NULL,
  prompt          TEXT,
  response        TEXT,
  tokens_in       INTEGER     NOT NULL DEFAULT 0,
  tokens_out      INTEGER     NOT NULL DEFAULT 0,
  cost            DECIMAL(10,4) NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- PROJECT FILES  (deliverables extracted from agent output)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_files (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id     UUID        REFERENCES public.tasks(id) ON DELETE SET NULL,
  agent_id    UUID        REFERENCES public.agents(id) ON DELETE SET NULL,
  path        TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, path)
);

DROP TRIGGER IF EXISTS trg_project_files_updated_at ON public.project_files;
CREATE TRIGGER trg_project_files_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- USER AGENT PROFILES  (per-user custom context per role)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_agent_profiles (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL,
  custom_context TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

DROP TRIGGER IF EXISTS trg_agent_profiles_updated_at ON public.user_agent_profiles;
CREATE TRIGGER trg_agent_profiles_updated_at
  BEFORE UPDATE ON public.user_agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- USER INSTALLED SKILLS  (skills installed from the library)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_installed_skills (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  library_id    TEXT        NOT NULL,
  display_name  TEXT        NOT NULL,
  icon          TEXT        NOT NULL DEFAULT '🎯',
  category      TEXT,
  description   TEXT,
  skill_content TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, library_id)
);

DROP TRIGGER IF EXISTS set_user_installed_skills_updated_at ON public.user_installed_skills;
CREATE TRIGGER set_user_installed_skills_updated_at
  BEFORE UPDATE ON public.user_installed_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_agent_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_installed_skills ENABLE ROW LEVEL SECURITY;

-- Projects: owner only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='owner_select') THEN
    CREATE POLICY "owner_select" ON public.projects FOR SELECT USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='owner_insert') THEN
    CREATE POLICY "owner_insert" ON public.projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='owner_update') THEN
    CREATE POLICY "owner_update" ON public.projects FOR UPDATE USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='owner_delete') THEN
    CREATE POLICY "owner_delete" ON public.projects FOR DELETE USING (auth.uid() = owner_id);
  END IF;
END $$;

-- Child tables: access if you own the parent project
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teams'        AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.teams         FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agents'       AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.agents        FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sprints'      AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.sprints       FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks'        AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.tasks         FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.chat_messages FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conflicts'    AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.conflicts     FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budget_events' AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.budget_events FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='execution_log' AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.execution_log FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_files' AND policyname='project_owner') THEN
    CREATE POLICY "project_owner" ON public.project_files FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- User-scoped tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_agent_profiles' AND policyname='own_profiles') THEN
    CREATE POLICY "own_profiles" ON public.user_agent_profiles
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_installed_skills' AND policyname='own_skills') THEN
    CREATE POLICY "own_skills" ON public.user_installed_skills
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_owner       ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_project        ON public.teams(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_project       ON public.agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_team          ON public.agents(team_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project      ON public.sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint         ON public.tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent          ON public.tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_project         ON public.chat_messages(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_project       ON public.budget_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execlog_agent        ON public.execution_log(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflicts_project    ON public.conflicts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path   ON public.project_files(project_id, path);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user  ON public.user_agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_installed_skills_user ON public.user_installed_skills(user_id);


-- ────────────────────────────────────────────────────────────
-- REALTIME PUBLICATIONS
-- Enable real-time subscriptions on tables the frontend watches
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_messages','agents','tasks','sprints','projects']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
