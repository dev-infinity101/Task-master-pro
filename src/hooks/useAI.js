/**
 * useAI.js — AI Assistant hook
 *
 * Supports two execution paths:
 *  1. Chat mode (streaming)  — token-by-token SSE from edge function
 *  2. Structured modes (plan | decompose | review | narrate) — single JSON response
 *
 * Streaming state is kept local. Zustand is only touched for task creation.
 */

import { useState, useCallback, useRef, startTransition } from 'react'
import { supabase } from '../lib/supabase'
import { bulkCreateTasks } from '../lib/database'
import useStore from '../store/store'
import { toast } from 'sonner'

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Get a valid JWT for edge function calls.
 * Reads from Zustand store first — it is always up to date because useAuth.js
 * writes every new session to the store via onAuthStateChange (TOKEN_REFRESHED).
 * Falls back to force-refreshing via Supabase SDK if the store token is stale.
 */
async function getAccessToken() {
  // Primary: read fresh token directly from Zustand store
  const storeSession = useStore.getState().session
  if (storeSession?.access_token) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresAt = storeSession.expires_at ?? 0
    if (expiresAt - nowSeconds > 90) return storeSession.access_token
  }

  // Fallback: force a network refresh to guarantee freshness
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error || !session) return null
    return session.access_token
  } catch {
    return null
  }
}

// ─── Edge function headers helper ─────────────────────────────────────────────
// Both headers are REQUIRED when calling Supabase Edge Functions via raw fetch():
//   Authorization: Bearer <user_jwt>  — authenticates the user
//   apikey: <anon_key>                — identifies the project at the gateway level
// Without apikey the Supabase gateway returns 401 before the function even runs.
function edgeHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
  }
}

// ─── Helper: call edge with optional 401-retry ────────────────────────────────
async function fetchEdge(body, signal) {
  const makeReq = (token) => fetch(EDGE_BASE, {
    method: 'POST',
    headers: edgeHeaders(token),
    body: JSON.stringify(body),
    signal,
  })

  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated')

  let res = await makeReq(token)

  // 401 retry: force token refresh and try once more
  if (res.status === 401) {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.access_token) res = await makeReq(session.access_token)
    } catch { /* fall through */ }
  }

  return res
}

// ─── useAI (Chat + Structured) ────────────────────────────────────────────────

export function useAI() {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [structuredResult, setStructuredResult] = useState(null)   // last non-chat result
  const [isLoadingStructured, setIsLoadingStructured] = useState(false)
  const abortRef = useRef(null)
  const store = useStore()

  // ── Structured mode (plan | decompose | review | narrate) ─────────────────

  const callStructured = useCallback(async (mode, payload = {}) => {
    setIsLoadingStructured(true)
    setStructuredResult(null)

    try {
      const res = await fetchEdge({ mode, payload })

      if (res.status === 429) {
        toast.error('Too many requests — please wait a moment.')
        return null
      }
      if (res.status === 401) {
        toast.error('Session expired. Please sign out and sign back in.')
        return null
      }
      if (!res.ok) throw new Error(`Edge function error: ${res.status}`)

      const data = await res.json()

      if (data?.error === 'INSUFFICIENT_DATA') {
        toast.warning('Not enough data to generate a result.')
        return null
      }

      startTransition(() => setStructuredResult(data))
      return data
    } catch (err) {
      console.error(`AI structured [${mode}] error:`, err)
      toast.error('AI assistant is unavailable. Please try again.')
      return null
    } finally {
      setIsLoadingStructured(false)
    }
  }, [])

  // ── Chat mode (streaming) ──────────────────────────────────────────────────

  const sendMessage = useCallback(async (userMessage) => {
    if (isStreaming) return

    const userId = store.user?.id
    const activeProjectId = store.activeProjectId
    if (!userId) return

    const newUserMsg = { role: 'user', content: userMessage, id: Date.now() }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setIsStreaming(true)
    setStreamingContent('')

    const context = buildContext(store, activeProjectId)
    abortRef.current = new AbortController()

    try {
      const res = await fetchEdge(
        {
          mode: 'chat',
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        },
        abortRef.current.signal
      )

      if (res.status === 429) {
        toast.error('Rate limit reached — please wait a minute.')
        setMessages(prev => prev.slice(0, -1))
        return
      }
      if (res.status === 401) {
        toast.error('Session expired. Please sign out and sign back in.')
        setMessages(prev => prev.slice(0, -1))
        return
      }
      if (!res.ok) throw new Error(`Edge function error: ${res.status}`)

      // Stream token-by-token
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let taskActions = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'text_delta') {
              fullContent += parsed.text
              // use startTransition so streaming doesn't block higher-priority renders
              startTransition(() => setStreamingContent(fullContent))
            }
            if (parsed.type === 'task_actions') taskActions = parsed.actions
          } catch { /* non-JSON line */ }
        }
      }

      const assistantMsg = { role: 'assistant', content: fullContent, id: Date.now(), taskActions }
      setMessages(prev => [...prev, assistantMsg])
      startTransition(() => setStreamingContent(''))

      if (taskActions?.length > 0) {
        const columns = store.columns[activeProjectId] ?? []
        await executeTaskActions(taskActions, userId, activeProjectId, columns, store)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (streamingContent) {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: streamingContent + ' _(cancelled)_', id: Date.now() },
          ])
        }
      } else {
        console.error('AI chat error:', err)
        toast.error('AI assistant is unavailable. Please try again.')
        setMessages(prev => prev.slice(0, -1))
      }
      startTransition(() => setStreamingContent(''))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, isStreaming, store, streamingContent])

  const cancelStream = useCallback(() => { abortRef.current?.abort() }, [])
  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingContent('')
    setStructuredResult(null)
  }, [])

  return {
    messages,
    isStreaming,
    streamingContent,
    structuredResult,
    isLoadingStructured,
    sendMessage,
    callStructured,
    cancelStream,
    clearMessages,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(store, activeProjectId) {
  const projectTasks = store.tasks[activeProjectId] ?? []
  const columns = store.columns[activeProjectId] ?? []
  const activeProject = store.getActiveProject()
  const now = new Date()

  return {
    activeProjectId,
    projectName: activeProject?.name,
    columns: columns.map(c => ({ id: c.id, name: c.name })),
    taskCount: projectTasks.filter(t => t.status !== 'done').length,
    overdueTasks: projectTasks
      .filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done')
      .map(t => ({ id: t.id, title: t.title, due_date: t.due_date }))
      .slice(0, 5),
    todaysTasks: projectTasks
      .filter(t => {
        if (!t.due_date || t.status === 'done') return false
        return new Date(t.due_date).toDateString() === now.toDateString()
      })
      .map(t => ({ id: t.id, title: t.title, priority: t.priority }))
      .slice(0, 10),
    recentTasks: projectTasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
  }
}

async function executeTaskActions(actions, userId, projectId, columns, store) {
  const todoColumn = columns.find(c => c.name.toLowerCase() === 'todo')
  if (!todoColumn) return

  const tasksToCreate = actions
    .filter(a => a.type === 'create_task')
    .map((a, idx) => ({
      user_id: userId,
      project_id: projectId,
      column_id: todoColumn.id,
      title: a.title,
      description: a.description ?? null,
      priority: a.priority ?? 'none',
      status: 'todo',
      due_date: a.due_date ?? null,
      tags: a.tags ?? [],
      position: (idx + 1) * 1000 + Date.now(),
    }))

  if (tasksToCreate.length === 0) return

  const { data, error } = await bulkCreateTasks(tasksToCreate)
  if (error) { toast.error(`Failed to create ${tasksToCreate.length} task(s)`); return }

  store.bulkAddTasks(projectId, data)
  toast.success(`✨ Created ${data.length} task${data.length > 1 ? 's' : ''} from AI`)
}
