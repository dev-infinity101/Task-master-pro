/**
 * useDeadlineScheduler.js
 *
 * Replaces the old 60-second polling interval with a precise event-driven
 * deadline engine.
 *
 * Architecture:
 * - Layer 1: Client-side setTimeout that fires at EXACTLY the next deadline moment.
 * - Layer 2: visibilitychange handler that rechecks ALL tasks when the tab
 *   regains focus (handles "tab was asleep" edge case).
 *
 * Critical design:
 * - `overdue` is set as a SEPARATE boolean field — status (Todo/In Progress/Done)
 *   is NEVER changed to "Overdue". This preserves Kanban column position.
 * - Each "overdue" flip triggers an optimistic Zustand update immediately,
 *   then syncs to Supabase asynchronously.
 */

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import useStore from '../store/store'
import { updateTask as dbUpdateTask } from '../lib/database'

export function useDeadlineScheduler() {
    const timeoutRef = useRef(null)
    const store = useStore.getState

    const markTaskOverdue = useCallback(async (task, projectId) => {
        const now = new Date().toISOString()
        // Optimistic update — sets overdue:true in store immediately
        useStore.getState().optimisticUpdateTask(projectId, task.id, {
            overdue: true,
            overdue_since: now,
        })
        // Sync to DB
        const { error } = await dbUpdateTask(task.id, {
            overdue: true,
            overdue_since: now,
        })
        if (error) {
            // Silently rollback — don't toast (user will see it next cycle)
            useStore.getState().rollbackUpdateTask(projectId, task.id)
        } else {
            useStore.getState().confirmUpdateTask(task.id)
        }
        // Show toast once per task
        toast.warning(`"${task.title}" is now overdue`, {
            id: `overdue-${task.id}`, // deduplicate
            duration: 6000,
        })
    }, [])

    const scheduleNext = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }

        const state = store()
        const now = Date.now()

        // Collect ALL tasks from all projects
        const allTasks = Object.entries(state.tasks).flatMap(([projectId, tasks]) =>
            (tasks ?? []).map((t) => ({ ...t, _projectId: projectId }))
        )

        // Find tasks that haven't been marked overdue yet and have a deadline
        const pendingTasks = allTasks.filter(
            (t) =>
                t.deadline &&
                !t.overdue &&
                t.status !== 'done' &&
                new Date(t.deadline).getTime() > now
        )

        if (pendingTasks.length === 0) return

        // Sort ascending — nearest deadline first
        pendingTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))

        const nearest = pendingTasks[0]
        const delta = new Date(nearest.deadline).getTime() - now

        // Cap at 2 hours for safety; will reschedule after firing
        const delay = Math.min(delta, 2 * 60 * 60 * 1000)

        timeoutRef.current = setTimeout(() => {
            // Recheck all tasks that have now crossed the deadline
            const currentState = store()
            const currentAllTasks = Object.entries(currentState.tasks).flatMap(
                ([projectId, tasks]) =>
                    (tasks ?? []).map((t) => ({ ...t, _projectId: projectId }))
            )
            const nowMs = Date.now()
            const nowOverdue = currentAllTasks.filter(
                (t) =>
                    t.deadline &&
                    !t.overdue &&
                    t.status !== 'done' &&
                    new Date(t.deadline).getTime() <= nowMs
            )
            nowOverdue.forEach((t) => markTaskOverdue(t, t._projectId))
            // Reschedule for next nearest
            scheduleNext()
        }, delay)
    }, [store, markTaskOverdue])

    const checkAllNow = useCallback(() => {
        const state = store()
        const nowMs = Date.now()
        const allTasks = Object.entries(state.tasks).flatMap(([projectId, tasks]) =>
            (tasks ?? []).map((t) => ({ ...t, _projectId: projectId }))
        )
        allTasks
            .filter(
                (t) =>
                    t.deadline &&
                    !t.overdue &&
                    t.status !== 'done' &&
                    new Date(t.deadline).getTime() <= nowMs
            )
            .forEach((t) => markTaskOverdue(t, t._projectId))
        scheduleNext()
    }, [store, markTaskOverdue, scheduleNext])

    // Re-schedule whenever tasks change (subscription to store)
    useEffect(() => {
        const unsubscribe = useStore.subscribe(
            (state) => state.tasks,
            () => scheduleNext(),
            { fireImmediately: true }
        )
        return unsubscribe
    }, [scheduleNext])

    // Tab focus handler — catches "tab was asleep" scenario
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                checkAllNow()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [checkAllNow])
}
