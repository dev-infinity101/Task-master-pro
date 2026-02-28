/**
 * database.js — All Supabase query functions
 *
 * Pattern: every function returns { data, error }
 * Callers handle errors — no silent failures.
 * All queries are user-scoped via RLS (no manual user_id filtering needed,
 * but we include it explicitly for query planner hints on indexed columns).
 */

import { supabase, supabaseConfigured } from './supabase'

const missingSupabase = () => ({ data: null, error: new Error('Supabase is not configured') })

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export async function signUp({ email, password, fullName }) {
  if (!supabaseConfigured) return missingSupabase()

  const res = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // By omitting emailRedirectTo, we force Supabase to use the Site URL 
      // configured in the dashboard. If we pass a URL here that isn't exactly
      // matched in the allowed Redirect URLs list, Supabase silently drops the email!
    },
  })

  // Supabase silently drops duplicate signups by default (returning 200 OK 
  // but sending NO email) to prevent user enumeration. We can detect this 
  // if identities array is completely empty. If so, we proactively resend the email.
  if (res.data?.user && res.data.user.identities && res.data.user.identities.length === 0) {
    const resend = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })
    if (resend.error) return { data: null, error: resend.error }
  }

  return res
}

export async function signIn({ email, password }) {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signOut() {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.signOut()
}

export async function getSession() {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.getSession()
}

export async function resetPassword(email) {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
}

export async function updatePassword(password) {
  if (!supabaseConfigured) return missingSupabase()
  return supabase.auth.updateUser({ password })
}

// ─────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────

export async function getProfile(userId) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
}

export async function updateProfile(userId, updates) {
  return supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
}

export async function uploadAvatar(userId, file) {
  if (!supabaseConfigured) return missingSupabase()
  const extension = file.name?.split('.').pop() || 'png'
  const path = `${userId}/${Date.now()}.${extension}`

  const { data: uploaded, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })

  if (uploadError) return { data: null, error: uploadError }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(uploaded.path)

  return { data: { path: uploaded.path, publicUrl: publicUrlData?.publicUrl ?? null }, error: null }
}

// ─────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────

export async function getProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching projects:', error)
    return { data: [], error }
  }

  return { data: data ?? [], error: null }
}

export async function createProject(userId, { name, color = '#6366f1' }) {
  // Get max position for ordering
  const { data: existing } = await supabase
    .from('projects')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)

  const position = existing?.[0]?.position ?? 0

  return supabase
    .from('projects')
    .insert({ user_id: userId, name, color, position: position + 1000 })
    .select()
    .single()
}

export async function createProjectWithDefaults(
  userId,
  { name, color = '#6366f1' }
) {
  if (!supabaseConfigured) return missingSupabase()

  const { error: ensureProfileError } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

  if (ensureProfileError) return { data: null, error: ensureProfileError }

  const { data: project, error: projectError } = await createProject(userId, {
    name,
    color,
  })

  if (projectError) return { data: null, error: projectError }

  const defaultColumns = [
    { user_id: userId, project_id: project.id, name: 'Todo', color: '#94a3b8', position: 0 },
    { user_id: userId, project_id: project.id, name: 'In Progress', color: '#f59e0b', position: 1000 },
    { user_id: userId, project_id: project.id, name: 'Done', color: '#10b981', position: 2000 },
  ]

  const { data: columns, error: columnsError } = await supabase
    .from('columns')
    .insert(defaultColumns)
    .select()

  if (columnsError) {
    await supabase.from('projects').delete().eq('id', project.id)
    return { data: null, error: columnsError }
  }

  return { data: { project, columns: columns ?? [] }, error: null }
}

export async function updateProject(projectId, updates) {
  return supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single()
}

export async function deleteProject(projectId) {
  return supabase.from('projects').delete().eq('id', projectId)
}

// ─────────────────────────────────────────────
// COLUMNS
// ─────────────────────────────────────────────

export async function getColumns(projectId) {
  return supabase
    .from('columns')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
}

export async function createColumn(userId, projectId, { name, color = '#94a3b8' }) {
  const { data: existing } = await supabase
    .from('columns')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)

  const position = existing?.[0]?.position ?? 0

  return supabase
    .from('columns')
    .insert({ user_id: userId, project_id: projectId, name, color, position: position + 1000 })
    .select()
    .single()
}

export async function updateColumn(columnId, updates) {
  return supabase
    .from('columns')
    .update(updates)
    .eq('id', columnId)
    .select()
    .single()
}

export async function deleteColumn(columnId) {
  return supabase.from('columns').delete().eq('id', columnId)
}

// ─────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────

/**
 * Fetch all top-level tasks for a project, with their subtasks.
 * We fetch flat and reconstruct tree client-side for performance
 * (avoids recursive SQL which can be slow on large datasets).
 */
export async function getTasksByProject(projectId) {
  return supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
}

export async function getTask(taskId) {
  return supabase.from('tasks').select('*').eq('id', taskId).single()
}

export async function createTask(userId, projectId, columnId, taskData) {
  // Place at end of column using fractional indexing
  const { data: lastTask } = await supabase
    .from('tasks')
    .select('position')
    .eq('column_id', columnId)
    .order('position', { ascending: false })
    .limit(1)

  const position = (lastTask?.[0]?.position ?? 0) + 1000

  return supabase
    .from('tasks')
    .insert({
      user_id: userId,
      project_id: projectId,
      column_id: columnId,
      position,
      priority: 'none',
      ...taskData,
    })
    .select()
    .single()
}

export async function updateTask(taskId, updates) {
  return supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single()
}

export async function deleteTask(taskId) {
  return supabase.from('tasks').delete().eq('id', taskId)
}

/**
 * Move task to a new column + update position (Kanban drag-and-drop).
 * Uses fractional indexing: position = (prevPos + nextPos) / 2
 * If positions get too close (< 0.001), we rebalance the entire column.
 */
export async function moveTask(taskId, newColumnId, newPosition) {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      column_id: newColumnId,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()

  // Rebalance if positions are colliding
  if (!error && newPosition < 0.001) {
    await rebalanceColumnPositions(newColumnId)
  }

  return { data, error }
}

/**
 * Rebalance all task positions in a column.
 * Called when fractional positions get too small.
 * Assigns positions 1000, 2000, 3000... to maintain order.
 */
async function rebalanceColumnPositions(columnId) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, position')
    .eq('column_id', columnId)
    .order('position', { ascending: true })

  if (!tasks) return

  const updates = tasks.map((task, index) => ({
    id: task.id,
    position: (index + 1) * 1000,
  }))

  // Batch update (Supabase doesn't support bulk update natively, use Promise.all)
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('tasks').update({ position }).eq('id', id)
    )
  )
}

/**
 * Bulk create tasks (used by AI assistant when creating multiple tasks at once)
 */
export async function bulkCreateTasks(tasks) {
  return supabase.from('tasks').insert(tasks).select()
}

/**
 * Search tasks by title (uses GIN trigram index for fast partial matching)
 */
export async function searchTasks(userId, query) {
  return supabase
    .from('tasks')
    .select('*, projects(name, color)')
    .eq('user_id', userId)
    .ilike('title', `%${query}%`)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)
}

/**
 * Get tasks due today or overdue (for daily planning)
 */
export async function getTodaysTasks(userId) {
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  return supabase
    .from('tasks')
    .select('*, projects(name, color), columns(name)')
    .eq('user_id', userId)
    .lte('due_date', todayEnd.toISOString())
    .neq('status', 'done')
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true })
}

// ─────────────────────────────────────────────
// AI CONVERSATIONS
// ─────────────────────────────────────────────

export async function getAIConversations(userId) {
  return supabase
    .from('ai_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20)
}

export async function getAIConversation(conversationId) {
  return supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()
}

export async function createAIConversation(userId, firstMessage) {
  const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '...' : '')
  return supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title,
      messages: [{ role: 'user', content: firstMessage }],
    })
    .select()
    .single()
}

export async function updateAIConversation(conversationId, messages) {
  return supabase
    .from('ai_conversations')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select()
    .single()
}

export async function deleteAIConversation(conversationId) {
  return supabase.from('ai_conversations').delete().eq('id', conversationId)
}
