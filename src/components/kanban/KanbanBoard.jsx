/**
 * KanbanBoard.jsx
 *
 * Full Kanban implementation using @dnd-kit/core + @dnd-kit/sortable.
 * Features:
 * - Drag tasks between columns (cross-column)
 * - Drag tasks within a column (reorder)
 * - Drag overlay (floating card while dragging)
 * - Optimistic updates — moves happen instantly, DB sync in background
 * - Keyboard accessible (dnd-kit supports Tab + Space + Arrow keys natively)
 */

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { createPortal } from 'react-dom'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import KanbanColumn from './KanbanColumn'
import TaskCard from './TaskCard'

export default function KanbanBoard() {
  const [activeTask, setActiveTask] = useState(null)
  const { activeProjectId, getTasksByColumn, getActiveColumns } = useStore(useShallow((s) => ({
    activeProjectId: s.activeProjectId,
    getTasksByColumn: s.getTasksByColumn,
    getActiveColumns: s.getActiveColumns,
  })))
  const { moveTask } = useTasks()

  const columns = getActiveColumns()
  const tasksByColumn = getTasksByColumn()

  // Configure sensors — pointer (mouse/touch) + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 5px movement before drag starts (prevents accidental drags on click)
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = useCallback((event) => {
    const { active } = event
    // Find the task being dragged across all columns
    const allTasks = Object.values(tasksByColumn).flat()
    const task = allTasks.find((t) => t.id === active.id)
    setActiveTask(task ?? null)
  }, [tasksByColumn])

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeTaskId = active.id
      const overId = over.id

      // Determine source and target columns
      let sourceColumnId = null
      let targetColumnId = null

      // Check if over a column directly
      const isOverColumn = columns.some((c) => c.id === overId)

      if (isOverColumn) {
        targetColumnId = overId
      } else {
        // Over a task — find its column
        for (const [colId, tasks] of Object.entries(tasksByColumn)) {
          if (tasks.some((t) => t.id === activeTaskId)) sourceColumnId = colId
          if (tasks.some((t) => t.id === overId)) targetColumnId = colId
        }
      }

      if (!targetColumnId || sourceColumnId === targetColumnId) return

      // Cross-column drag — optimistically move task to target column
      // We'll calculate exact position on dragEnd
    },
    [columns, tasksByColumn]
  )

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event
      setActiveTask(null)

      if (!over || !activeProjectId) return

      const activeTaskId = active.id
      const overId = over.id

      if (activeTaskId === overId) return

      // Find source column
      let sourceColumnId = null
      for (const [colId, tasks] of Object.entries(tasksByColumn)) {
        if (tasks.some((t) => t.id === activeTaskId)) {
          sourceColumnId = colId
          break
        }
      }

      // Determine target column and position
      const isOverColumn = columns.some((c) => c.id === overId)
      let targetColumnId = null
      let prevTask = null
      let nextTask = null

      if (isOverColumn) {
        // Dropped directly on a column — place at bottom
        targetColumnId = overId
        const columnTasks = tasksByColumn[overId] ?? []
        prevTask = columnTasks[columnTasks.length - 1] ?? null
        nextTask = null
      } else {
        // Dropped over a task — find its column and position
        for (const [colId, tasks] of Object.entries(tasksByColumn)) {
          const overIdx = tasks.findIndex((t) => t.id === overId)
          if (overIdx !== -1) {
            targetColumnId = colId
            // Insert before the task we're hovering over
            prevTask = overIdx > 0 ? tasks[overIdx - 1] : null
            nextTask = tasks[overIdx]
            break
          }
        }
      }

      if (!targetColumnId) return

      await moveTask(activeTaskId, activeProjectId, targetColumnId, prevTask, nextTask)
    },
    [activeProjectId, tasksByColumn, columns, moveTask]
  )

  const handleDragCancel = useCallback(() => {
    setActiveTask(null)
  }, [])

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <p>No columns found. Something went wrong.</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4 px-6">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] ?? []}
          />
        ))}
      </div>

      {/* Drag Overlay — renders the floating card while dragging */}
      {createPortal(
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeTask ? (
            <TaskCard task={activeTask} isDragging />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
