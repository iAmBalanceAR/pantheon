-- ============================================================
-- Pantheon — Migration 003: extracted deliverables from agent output
-- Parses <file path="..."> blocks from task results into queryable rows.
-- Safe to re-run: IF NOT EXISTS indexes, DROP POLICY/TRIGGER before create.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS project_files (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
  path        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, path)
);

DROP TRIGGER IF EXISTS trg_project_files_updated_at ON project_files;
CREATE TRIGGER trg_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, path);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_owner" ON project_files;
CREATE POLICY "project_owner" ON project_files
  FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
