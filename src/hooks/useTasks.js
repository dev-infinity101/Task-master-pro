/**
 * useTasks.js — Task operations with optimistic updates
 *
 * Every mutation:
 * 1. Updates store immediately (optimistic)
 * 2. Fires async DB call
 * 3. On success: confirms (clears snapshot)
 * 4. On error: rolls back + shows toast notification
 *
 * This gives instant UI feedback with no loading spinners for common actions.
 */

import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import {
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  moveTask as dbMoveTask,
  getTasksByProject,
} from '../lib/database'
import useStore from '../store/store'
import { markOwnUpdate } from './useRealtimeSync'

export function useTasks() {
  const store = useStore()

  const loadTasks = useCallback(async (projectId) => {
    store.setTasksLoading(true)
    const { data, error } = await getTasksByProject(projectId)
    store.setTasksLoading(false)

    if (error) {
      toast.error('Failed to load tasks')
      return
    }
    store.setTasks(projectId, data ?? [])
  }, [store])

  const addTask = useCallback(
    async (projectId, columnId, taskData) => {
      const userId = store.user?.id
      if (!userId) return

      // Create optimistic task with temp UUID
      const tempId = `temp_${uuidv4()}`
      const optimisticTask = {
        id: tempId,
        user_id: userId,
        project_id: projectId,
        column_id: columnId,
        parent_task_id: taskData.parent_task_id ?? null,
        title: taskData.title,
        description: taskData.description ?? null,
        priority: taskData.priority ?? 'none',
        status: taskData.status ?? 'todo',
        position: Date.now(), // temp position
        due_date: taskData.due_date ?? null,
        tags: taskData.tags ?? [],
        estimated_mins: taskData.estimated_mins ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _isOptimistic: true,
      }

      store.optimisticAddTask(projectId, optimisticTask)

      const { data, error } = await dbCreateTask(userId, projectId, columnId, taskData)

      if (error) {
        store.rollbackAddTask(projectId, tempId)
        toast.error('Failed to create task. Please try again.')
        return null
      }

      // Mark as own update so realtime echo is ignored
      markOwnUpdate(data.id)
      store.confirmAddTask(projectId, tempId, data)
      return data
    },
    [store]
  )

  const updateTask = useCallback(
    async (taskId, projectId, updates) => {
      store.optimisticUpdateTask(projectId, taskId, updates)
      markOwnUpdate(taskId)

      const { data, error } = await dbUpdateTask(taskId, updates)

      if (error) {
        store.rollbackUpdateTask(projectId, taskId)
        toast.error('Failed to update task.')
        return null
      }

      store.confirmUpdateTask(taskId)
      return data
    },
    [store]
  )

  const deleteTask = useCallback(
    async (taskId, projectId) => {
      store.optimisticDeleteTask(projectId, taskId)

      const { error } = await dbDeleteTask(taskId)

      if (error) {
        store.rollbackDeleteTask(projectId, taskId)
        toast.error('Failed to delete task.')
      }
    },
    [store]
  )

  /**
   * moveTask — called by Kanban drag-and-drop
   * Calculates fractional position between prev and next tasks.
   */
  const moveTask = useCallback(
    async (taskId, projectId, newColumnId, prevTask, nextTask) => {
      // Calculate fractional position
      const prevPos = prevTask?.position ?? 0
      const nextPos = nextTask?.position ?? prevPos + 2000
      const newPosition = (prevPos + nextPos) / 2

      // Optimistic update
      store.optimisticUpdateTask(projectId, taskId, {
        column_id: newColumnId,
        position: newPosition,
      })
      markOwnUpdate(taskId)

      const { error } = await dbMoveTask(taskId, newColumnId, newPosition)

      if (error) {
        store.rollbackUpdateTask(projectId, taskId)
        toast.error('Failed to move task.')
      } else {
        store.confirmUpdateTask(taskId)
      }
    },
    [store]
  )

  const toggleTaskComplete = useCallback(
    async (taskId, projectId) => {
      const tasks = store.tasks[projectId] ?? []
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      // Find the "Done" column
      const columns = store.columns[projectId] ?? []
      const doneColumn = columns.find((c) => c.name.toLowerCase() === 'done')
      const todoColumn = columns.find((c) => c.name.toLowerCase() === 'todo')

      const isDone = task.status === 'done'
      const newColumnId = isDone ? todoColumn?.id : doneColumn?.id
      const newStatus = isDone ? 'todo' : 'done'

      await updateTask(taskId, projectId, {
        status: newStatus,
        column_id: newColumnId ?? task.column_id,
        completed_at: isDone ? null : new Date().toISOString(),
      })
    },
    [store, updateTask]
  )

  return { loadTasks, addTask, updateTask, deleteTask, moveTask, toggleTaskComplete }
}
