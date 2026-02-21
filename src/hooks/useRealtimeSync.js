/**
 * useRealtimeSync.js — Production WebSocket via Supabase Realtime
 *
 * Replaces the setInterval simulation in Dashboard.jsx entirely.
 *
 * What it does:
 * - Subscribes to Postgres changes on tasks/columns tables for active project
 * - Deduplicates own-client events (we already applied optimistic update)
 * - Updates Zustand store on INSERT / UPDATE / DELETE events
 * - Tracks connection status (wsConnected) for the UI indicator
 * - Cleans up subscription on project change or unmount
 *
 * Deduplication strategy:
 * When we perform an optimistic update, we store the taskId in a Set.
 * When the Realtime event comes back for that same update, we skip it
 * (we already have the latest state). We clear the entry after skipping.
 */

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/store'

// IDs of updates we initiated — skip their realtime echo
const pendingOwnUpdates = new Set()

export function markOwnUpdate(taskId) {
  pendingOwnUpdates.add(taskId)
  // Auto-clear after 3s in case realtime event never arrives
  setTimeout(() => pendingOwnUpdates.delete(taskId), 3000)
}

export function useRealtimeSync(projectId) {
  const channelRef = useRef(null)
  const projectsChannelRef = useRef(null)
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

  const handleTaskChange = useCallback(
    (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        // Skip if this is our own update echoing back
        if (pendingOwnUpdates.has(newRecord.id)) {
          pendingOwnUpdates.delete(newRecord.id)
          return
        }
        realtimeUpsertTask(projectId, newRecord)
      }

      if (eventType === 'DELETE') {
        realtimeDeleteTask(projectId, oldRecord.id)
      }
    },
    [projectId, realtimeUpsertTask, realtimeDeleteTask]
  )

  const handleColumnChange = useCallback(
    async () => {
      // Re-fetch columns on any column change (rare event, safe to refetch)
      const { data } = await supabase
        .from('columns')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
      if (data) setColumns(projectId, data)
    },
    [projectId, setColumns]
  )

  const handleProjectChange = useCallback(
    (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'INSERT') {
        addProject(newRecord)
      }

      if (eventType === 'UPDATE') {
        updateProject(newRecord.id, newRecord)
      }

      if (eventType === 'DELETE') {
        removeProject(oldRecord.id)
      }
    },
    [addProject, updateProject, removeProject]
  )

  useEffect(() => {
    if (!user?.id) return

    if (projectsChannelRef.current) {
      supabase.removeChannel(projectsChannelRef.current)
      projectsChannelRef.current = null
    }

    const channel = supabase
      .channel(`user:${user.id}:projects`, {
        config: { broadcast: { self: false } },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${user.id}`,
        },
        handleProjectChange
      )
      .subscribe()

    projectsChannelRef.current = channel

    return () => {
      if (projectsChannelRef.current) {
        supabase.removeChannel(projectsChannelRef.current)
        projectsChannelRef.current = null
      }
    }
  }, [user?.id, handleProjectChange])

  useEffect(() => {
    if (!projectId) return

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      setWsConnected(false)
    }

    const channel = supabase
      .channel(`project:${projectId}`, {
        config: { broadcast: { self: false } }, // don't receive own broadcasts
      })
      // Subscribe to task changes for this project
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        handleTaskChange
      )
      // Subscribe to column changes for this project
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'columns',
          filter: `project_id=eq.${projectId}`,
        },
        handleColumnChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setWsConnected(true)
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setWsConnected(false)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setWsConnected(false)
      }
    }
  }, [projectId, handleTaskChange, handleColumnChange, setWsConnected])
}
