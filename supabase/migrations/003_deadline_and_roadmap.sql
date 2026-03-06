-- ============================================================
-- Migration 003 — Deadline System + Roadmap Table
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Add deadline columns to existing tasks table ──────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deadline_type   TEXT NOT NULL DEFAULT 'auto'
                                           CHECK (deadline_type IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS overdue         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overdue_since   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminded_at     TIMESTAMPTZ;

-- Back-fill existing tasks: auto-deadline = created_at + 24h
UPDATE public.tasks
SET
  deadline      = created_at + INTERVAL '24 hours',
  deadline_type = 'auto'
WHERE deadline IS NULL;

-- Index for efficient overdue queries
CREATE INDEX IF NOT EXISTS idx_tasks_deadline
  ON public.tasks(deadline)
  WHERE deadline IS NOT NULL AND overdue = FALSE;

-- ── 2. Create roadmap_months table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.roadmap_months (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  super_goal    TEXT,
  week_1_goal   TEXT,
  week_2_goal   TEXT,
  week_3_goal   TEXT,
  week_4_goal   TEXT,
  week_1_done   BOOLEAN NOT NULL DEFAULT FALSE,
  week_2_done   BOOLEAN NOT NULL DEFAULT FALSE,
  week_3_done   BOOLEAN NOT NULL DEFAULT FALSE,
  week_4_done   BOOLEAN NOT NULL DEFAULT FALSE,
  color_accent  TEXT NOT NULL DEFAULT '#6366f1',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_user_project
  ON public.roadmap_months(user_id, project_id, year);

-- ── 3. RLS for roadmap_months ────────────────────────────────
ALTER TABLE public.roadmap_months ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roadmap_months TO anon, authenticated;

CREATE POLICY "roadmap_months_own" ON public.roadmap_months
  FOR ALL USING (auth.uid() = user_id);

-- ── 4. Enable Realtime for roadmap_months ────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.roadmap_months;
