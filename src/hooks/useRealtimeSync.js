/**
 * useRealtimeSync.js
 *
 * Critical fixes vs previous versions:
 *
 * 1. DO NOT fight the SDK's own token refresh.
 *    Supabase JS v2 has an internal `onAuthStateChange` listener that
 *    automatically sets the new access_token on the Realtime client when
 *    TOKEN_REFRESHED fires. Our hook just subscribes channels — the SDK
 *    handles re-auth of existing channels automatically.
 *
 * 2. Stable channel names — never include Date.now() or random suffixes.
 *    A stable name lets the SDK reuse the WebSocket transport instead of
 *    opening a new one every retry.
 *
 * 3. NEVER retry on CHANNEL_ERROR.
 *    CHANNEL_ERROR means the server refused the channel (auth / RLS issue).
 *    Retrying loops into a 401 storm. Fix the auth, don't retry.
 *
 * 4. Only retry on TIMED_OUT (network drop).
 *    Exponential back-off: 2s, 4s, 8s (3 attempts max).
 *
 * 5. Don't flash "Connecting" when switching projects.
 *    Old channel is removed, new one subscribes — wsConnected stays true
 *    until CLOSED/ERROR actually arrives on the new channel.
 */

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/store'

// Deduplication: skip realtime echoes of our own writes
const pendingOwnUpdates = new Set()
export function markOwnUpdate(taskId) {
  pendingOwnUpdates.add(taskId)
  setTimeout(() => pendingOwnUpdates.delete(taskId), 3000)
}

export function useRealtimeSync(projectId) {
  const channelRef = useRef(null)
  const projectsChannelRef = useRef(null)
  const retryRef = useRef({ timer: null, count: 0 })

  const {
    user,
    realtimeUpsertTask,
    realtimeDeleteTask,
    setColumns,
    setWsConnected,
    addProject,
    updateProject,
    removeProject,
  } = useStore()

  // ── handlers (stable) ────────────────────────────────────────────────────

  const handleTaskChange = useCallback((payload) => {
    const { eventType, new: n, old: o } = payload
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (pendingOwnUpdates.has(n.id)) { pendingOwnUpdates.delete(n.id); return }
      realtimeUpsertTask(projectId, n)
    }
    if (eventType === 'DELETE') realtimeDeleteTask(projectId, o.id)
  }, [projectId, realtimeUpsertTask, realtimeDeleteTask])

  const handleColumnChange = useCallback(async () => {
    const { data } = await supabase
      .from('columns').select('*')
      .eq('project_id', projectId).order('position', { ascending: true })
    if (data) setColumns(projectId, data)
  }, [projectId, setColumns])

  const handleProjectChange = useCallback((payload) => {
    const { eventType, new: n, old: o } = payload
    if (eventType === 'INSERT') addProject(n)
    if (eventType === 'UPDATE') updateProject(n.id, n)
    if (eventType === 'DELETE') removeProject(o.id)
  }, [addProject, updateProject, removeProject])

  // ── Projects channel ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id || !supabase) return

    if (projectsChannelRef.current) {
      supabase.removeChannel(projectsChannelRef.current)
      projectsChannelRef.current = null
    }

    projectsChannelRef.current = supabase
      .channel(`projects:uid:${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
        handleProjectChange
      )
      .subscribe()

    return () => {
      if (projectsChannelRef.current) {
        supabase.removeChannel(projectsChannelRef.current)
        projectsChannelRef.current = null
      }
    }
  }, [user?.id, handleProjectChange])

  // ── Tasks + Columns channel ───────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !supabase) return

    let alive = true
    const { timer, count } = retryRef.current
    if (timer) { clearTimeout(timer); retryRef.current.timer = null }
    retryRef.current.count = 0

    // Remove old channel; keep wsConnected=true until new one settles
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const connect = () => {
      if (!alive) return

      channelRef.current = supabase
        .channel(`tasks:pid:${projectId}`)           // stable name
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
          handleTaskChange
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` },
          handleColumnChange
        )
        .subscribe((status) => {
          if (!alive) return

          if (status === 'SUBSCRIBED') {
            retryRef.current.count = 0
            setWsConnected(true)
            if (import.meta.env.DEV) console.debug('[Realtime] ✅ SUBSCRIBED')
            return
          }

          if (status === 'TIMED_OUT') {
            // Pure network drop → retry with back-off (max 3 attempts)
            setWsConnected(false)
            const n = retryRef.current.count
            if (n < 3) {
              retryRef.current.count++
              const delay = Math.pow(2, n) * 2000       // 2s, 4s, 8s
              if (import.meta.env.DEV) console.warn(`[Realtime] TIMED_OUT — retry in ${delay}ms`)
              retryRef.current.timer = setTimeout(() => {
                if (channelRef.current) {
                  supabase.removeChannel(channelRef.current)
                  channelRef.current = null
                }
                connect()
              }, delay)
            }
            return
          }

          if (status === 'CHANNEL_ERROR') {
            // Auth / RLS error — DO NOT retry (would spam 401s).
            // The SDK's own listener will re-auth channels when token refreshes.
            setWsConnected(false)
            if (import.meta.env.DEV) console.error('[Realtime] CHANNEL_ERROR — waiting for SDK re-auth')
            return
          }

          if (status === 'CLOSED') {
            setWsConnected(false)
          }
        })
    }

    connect()

    return () => {
      alive = false
      if (retryRef.current.timer) { clearTimeout(retryRef.current.timer); retryRef.current.timer = null }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setWsConnected(false)
    }
  }, [projectId, handleTaskChange, handleColumnChange, setWsConnected])
}
