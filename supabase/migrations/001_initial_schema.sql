-- ============================================================
-- TaskMaster — Production Schema (FIXED)
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ⚠️ DESTRUCTIVE: Clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_task_update ON public.tasks;
DROP TRIGGER IF EXISTS on_task_column_change ON public.tasks;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_default_project_for_user(uuid);
DROP FUNCTION IF EXISTS public.handle_task_completion();
DROP FUNCTION IF EXISTS public.sync_task_status_from_column();

DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.columns CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.ai_conversations CASCADE;

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT NOT NULL DEFAULT 'folder',
  position    INTEGER NOT NULL DEFAULT 0,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KANBAN COLUMNS
-- ============================================================
CREATE TABLE public.columns (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#94a3b8',
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE public.tasks (
  id               UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_id        UUID REFERENCES public.columns(id) ON DELETE SET NULL,
  parent_task_id   UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  priority         TEXT NOT NULL DEFAULT 'none'
                   CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
  status           TEXT NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo', 'in_progress', 'done', 'overdue')),
  position         DOUBLE PRECISION NOT NULL DEFAULT 0,
  due_date         TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  estimated_mins   INTEGER,
  actual_mins      INTEGER,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE public.ai_conversations (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT,
  messages    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES (before RLS to avoid errors)
-- ============================================================
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_column_position ON public.tasks(column_id, position);
CREATE INDEX idx_tasks_title_search ON public.tasks USING gin(title extensions.gin_trgm_ops);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_columns_project_id ON public.columns(project_id);
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- 1. Task Completion (runs as invoker, no RLS issues)
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_update
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_completion();

-- 2. Sync Task Status from Column (runs as invoker)
CREATE OR REPLACE FUNCTION public.sync_task_status_from_column()
RETURNS TRIGGER AS $$
DECLARE
  col_name TEXT;
  mapped_status TEXT;
BEGIN
  IF NEW.column_id IS NOT NULL THEN
    SELECT name INTO col_name FROM public.columns WHERE id = NEW.column_id;
    mapped_status := CASE lower(col_name)
      WHEN 'todo'        THEN 'todo'
      WHEN 'in progress' THEN 'in_progress'
      WHEN 'done'        THEN 'done'
      ELSE 'todo'
    END;
    NEW.status = mapped_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_column_change
  BEFORE INSERT OR UPDATE OF column_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_status_from_column();

-- 3. Seed Default Project (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_default_project_for_user(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  proj_id UUID;
  col_todo_id UUID;
  col_inprog_id UUID;
  col_done_id UUID;
BEGIN
  -- Guard: only create if no projects exist
  IF EXISTS (SELECT 1 FROM public.projects WHERE user_id = user_uuid) THEN
    RETURN;
  END IF;

  -- Create default project
  INSERT INTO public.projects (user_id, name, color, icon, position)
  VALUES (user_uuid, 'My Tasks', '#6366f1', 'inbox', 0)
  RETURNING id INTO proj_id;

  -- Create columns
  INSERT INTO public.columns (project_id, user_id, name, color, position, is_default)
  VALUES (proj_id, user_uuid, 'Todo', '#94a3b8', 0, TRUE)
  RETURNING id INTO col_todo_id;

  INSERT INTO public.columns (project_id, user_id, name, color, position, is_default)
  VALUES (proj_id, user_uuid, 'In Progress', '#f59e0b', 1, FALSE)
  RETURNING id INTO col_inprog_id;

  INSERT INTO public.columns (project_id, user_id, name, color, position, is_default)
  VALUES (proj_id, user_uuid, 'Done', '#10b981', 2, FALSE)
  RETURNING id INTO col_done_id;

  -- Seed example tasks
  INSERT INTO public.tasks (user_id, project_id, column_id, title, priority, position)
  VALUES
    (user_uuid, proj_id, col_todo_id,   'Welcome to TaskMaster 👋', 'none',   1000),
    (user_uuid, proj_id, col_inprog_id, 'Try the Kanban board',     'medium', 1000),
    (user_uuid, proj_id, col_done_id,   'Create your account',      'low',    1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. User Signup Handler (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile (NEW.id comes from auth.users)
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Create default project
  PERFORM public.create_default_project_for_user(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES (enable AFTER functions are created)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.columns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO anon, authenticated;

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations  ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects: full access to own projects
CREATE POLICY "projects_own" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- Columns: full access to own columns
CREATE POLICY "columns_own" ON public.columns
  FOR ALL USING (auth.uid() = user_id);

-- Tasks: full access to own tasks
CREATE POLICY "tasks_own" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- AI Conversations: full access to own conversations
CREATE POLICY "ai_conversations_own" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME (enable AFTER RLS)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- ============================================================
-- GRANT USAGE ON EXTENSIONS SCHEMA (critical for uuid_generate_v4)
-- ============================================================
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
