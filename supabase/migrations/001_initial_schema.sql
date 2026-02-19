-- ============================================================
-- TaskMaster — Production Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fast text search on tasks

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create default project
  WITH new_project AS (
    INSERT INTO projects (user_id, name, color, icon, position)
    VALUES (NEW.id, 'My First Project', '#6366f1', 'folder', 1000)
    RETURNING id
  )
  -- Create default columns
  INSERT INTO columns (user_id, project_id, name, color, position, is_default)
  SELECT 
    NEW.id, 
    id, 
    unnest(ARRAY['To Do', 'In Progress', 'Done']), 
    unnest(ARRAY['#94a3b8', '#3b82f6', '#10b981']), 
    unnest(ARRAY[1000, 2000, 3000]),
    unnest(ARRAY[true, false, true])
  FROM new_project;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT NOT NULL DEFAULT 'folder',
  position    INTEGER NOT NULL DEFAULT 0,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KANBAN COLUMNS (per project)
-- ============================================================
CREATE TABLE columns (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#94a3b8',
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id        UUID REFERENCES columns(id) ON DELETE SET NULL,
  parent_task_id   UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  priority         TEXT NOT NULL DEFAULT 'none'
                   CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
  status           TEXT NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo', 'in_progress', 'done', 'overdue')),
  -- Fractional indexing — single-row UPDATE on reorder, no cascading writes
  position         DOUBLE PRECISION NOT NULL DEFAULT 0,
  due_date         TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  estimated_mins   INTEGER,
  actual_mins      INTEGER,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-set completed_at when status flips to done
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_update
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION handle_task_completion();

-- Sync status from column name (denormalized for fast analytics queries)
CREATE OR REPLACE FUNCTION sync_task_status_from_column()
RETURNS TRIGGER AS $$
DECLARE
  col_name TEXT;
  mapped_status TEXT;
BEGIN
  IF NEW.column_id IS NOT NULL THEN
    SELECT name INTO col_name FROM columns WHERE id = NEW.column_id;
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
  BEFORE INSERT OR UPDATE OF column_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION sync_task_status_from_column();

-- ============================================================
-- AI CONVERSATIONS (session memory)
-- ============================================================
CREATE TABLE ai_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT,                   -- auto-generated from first message
  messages    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES — critical for query performance
-- ============================================================

-- Tasks by project (most common query)
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
-- Tasks by user (dashboard queries)
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
-- Tasks by parent (subtask queries)
CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
-- Tasks by due date (overdue detection, calendar view)
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
-- Tasks by status (analytics, filtering)
CREATE INDEX idx_tasks_status ON tasks(status);
-- Ordering within a column
CREATE INDEX idx_tasks_column_position ON tasks(column_id, position);
-- Full text search on task titles
CREATE INDEX idx_tasks_title_search ON tasks USING gin(title gin_trgm_ops);
-- Projects by user (sidebar query)
CREATE INDEX idx_projects_user_id ON projects(user_id);
-- Columns by project
CREATE INDEX idx_columns_project_id ON columns(project_id);
-- AI conversations by user
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);

-- ============================================================
-- ROW LEVEL SECURITY — users only see their own data
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations  ENABLE ROW LEVEL SECURITY;

-- Profiles: own row only
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Projects: own rows only
CREATE POLICY "projects_own" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Columns: own rows only
CREATE POLICY "columns_own" ON columns
  FOR ALL USING (auth.uid() = user_id);

-- Tasks: own rows only
CREATE POLICY "tasks_own" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- AI Conversations: own rows only
CREATE POLICY "ai_conversations_own" ON ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED: Default project + columns for new users
-- Called after profile creation
-- ============================================================
CREATE OR REPLACE FUNCTION create_default_project_for_user(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  proj_id UUID;
  col_todo_id UUID;
  col_inprog_id UUID;
  col_done_id UUID;
BEGIN
  -- Create default project
  INSERT INTO projects (id, user_id, name, color, icon, position)
  VALUES (uuid_generate_v4(), user_uuid, 'My Tasks', '#6366f1', 'inbox', 0)
  RETURNING id INTO proj_id;

  -- Create Todo column (default)
  INSERT INTO columns (id, project_id, user_id, name, color, position, is_default)
  VALUES (uuid_generate_v4(), proj_id, user_uuid, 'Todo', '#94a3b8', 0, TRUE)
  RETURNING id INTO col_todo_id;

  -- Create In Progress column
  INSERT INTO columns (id, project_id, user_id, name, color, position, is_default)
  VALUES (uuid_generate_v4(), proj_id, user_uuid, 'In Progress', '#f59e0b', 1, FALSE)
  RETURNING id INTO col_inprog_id;

  -- Create Done column
  INSERT INTO columns (id, project_id, user_id, name, color, position, is_default)
  VALUES (uuid_generate_v4(), proj_id, user_uuid, 'Done', '#10b981', 2, FALSE)
  RETURNING id INTO col_done_id;

  -- Seed 3 example tasks
  INSERT INTO tasks (user_id, project_id, column_id, title, priority, position)
  VALUES
    (user_uuid, proj_id, col_todo_id,   'Welcome to TaskMaster 👋', 'none',   1000),
    (user_uuid, proj_id, col_inprog_id, 'Try the Kanban board',     'medium', 1000),
    (user_uuid, proj_id, col_done_id,   'Create your account',      'low',    1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hook default project creation into user signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  PERFORM create_default_project_for_user(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME — enable broadcast for WebSocket subscriptions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE columns;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
