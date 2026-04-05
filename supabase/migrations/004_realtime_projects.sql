-- Broadcast project row changes (status, cost_used, tokens_used, etc.) to Realtime subscribers.
-- Without this, the overview page only updates from agents/sprints/tasks, not project-level fields.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
