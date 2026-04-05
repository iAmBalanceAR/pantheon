-- ============================================================
-- Pantheon — Migration 002
-- • Add report JSONB column to projects
-- • Add user_agent_profiles for per-user agent customization
-- ============================================================

-- Add report column to projects (stores the controller completion report)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS report JSONB;

-- ────────────────────────────────────────────────────────────
-- USER AGENT PROFILES
-- Users can attach custom context to any agent role.
-- The base system prompt is immutable (in code); custom_context
-- is appended when that role is invoked.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_agent_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  custom_context TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE TRIGGER trg_agent_profiles_updated_at
  BEFORE UPDATE ON user_agent_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_select" ON user_agent_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_own_insert" ON user_agent_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_update" ON user_agent_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_own_delete" ON user_agent_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_user ON user_agent_profiles(user_id);
