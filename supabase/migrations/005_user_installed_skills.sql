-- Migration: 005_user_installed_skills
-- Creates user_installed_skills table to store skills a user has imported from
-- the built-in Pantheon skills library. Installed skills can be edited to add
-- user-specific context, and are available to the Controller as named agent types.

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

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_user_installed_skills_updated_at'
  ) THEN
    CREATE TRIGGER set_user_installed_skills_updated_at
      BEFORE UPDATE ON public.user_installed_skills
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS: users can only see and manage their own installed skills
ALTER TABLE public.user_installed_skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_installed_skills' AND policyname = 'own_skills'
  ) THEN
    CREATE POLICY own_skills ON public.user_installed_skills
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
