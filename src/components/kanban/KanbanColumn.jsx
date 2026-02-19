import { useState, useRef } from 'react'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus, MoreHorizontal } from 'lucide-react'
import useStore from '../../store/store'
import { useTasks } from '../../hooks/useTasks'
import TaskCard from './TaskCard'

export default function KanbanColumn({ column, tasks }) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const inputRef = useRef(null)
  const { activeProjectId, user } = useStore((s) => ({
    activeProjectId: s.activeProjectId,
    user: s.user,
  }))
  const { addTask } = useTasks()

  // Make column itself droppable (for dropping into empty columns)
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const taskIds = tasks.map((t) => t.id)

  const handleAddTask = async () => {
    const title = newTaskTitle.trim()
    if (!title || !activeProjectId) return

    setNewTaskTitle('')
    setIsAddingTask(false)

    await addTask(activeProjectId, column.id, { title })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTask()
    if (e.key === 'Escape') {
      setIsAddingTask(false)
      setNewTaskTitle('')
    }
  }

  const handleStartAdding = () => {
    setIsAddingTask(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Column accent color
  const accentColor = column.color ?? '#94a3b8'

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 rounded-2xl transition-colors duration-200 ${
        isOver ? 'bg-slate-800/60' : 'bg-slate-900/40'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <h3 className="font-semibold text-slate-200 text-sm">{column.name}</h3>
          <span className="text-xs font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleStartAdding}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            title="Add task"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top accent line */}
      <div
        className="h-0.5 mx-4 rounded-full mb-3 opacity-60"
        style={{ backgroundColor: accentColor }}
      />

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-[100px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isAddingTask && (
          <div
            className="h-20 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors"
            onClick={handleStartAdding}
          >
            <p className="text-xs text-slate-600">Drop here or click to add</p>
          </div>
        )}
      </div>

      {/* Quick Add Task */}
      {isAddingTask ? (
        <div className="px-3 pb-3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <textarea
              ref={inputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Task name..."
              rows={2}
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none resize-none"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add task
              </button>
              <button
                onClick={() => { setIsAddingTask(false); setNewTaskTitle('') }}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3">
          <button
            onClick={handleStartAdding}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
        </div>
      )}
    </div>
  )
}
