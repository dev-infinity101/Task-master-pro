import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  CheckSquare,
  Flag,
  MoreVertical,
  Trash2,
  Pencil,
  GripVertical,
} from 'lucide-react'
import useStore from '../../store/store'
import { useTasks } from '../../hooks/useTasks'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400' },
  high:   { label: 'High',   color: 'text-orange-400', bg: 'bg-orange-400/10', dot: 'bg-orange-400' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-400/10', dot: 'bg-yellow-400' },
  low:    { label: 'Low',    color: 'text-blue-400',   bg: 'bg-blue-400/10',   dot: 'bg-blue-400'   },
  none:   { label: null,     color: '',                bg: '',                  dot: ''              },
}

function formatDueDate(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: 'Overdue', color: 'text-red-400', bg: 'bg-red-400/10' }
  if (diffDays === 0) return { text: 'Today', color: 'text-amber-400', bg: 'bg-amber-400/10' }
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-slate-300', bg: 'bg-slate-700/50' }
  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: 'text-slate-400',
    bg: 'bg-slate-700/50',
  }
}

export default function TaskCard({ task, isDragging = false }) {
  const [showMenu, setShowMenu] = useState(false)
  const { activeProjectId, getSubtasks } = useStore()
  const { deleteTask, toggleTaskComplete } = useTasks()

  const subtasks = getSubtasks(task.id)
  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length
  const dueInfo = formatDueDate(task.due_date)
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none

  // dnd-kit sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    setShowMenu(false)
    if (activeProjectId) {
      await deleteTask(task.id, activeProjectId)
    }
  }

  const handleToggleComplete = async (e) => {
    e.stopPropagation()
    if (activeProjectId) {
      await toggleTaskComplete(task.id, activeProjectId)
    }
  }

  const isDone = task.status === 'done'
  const isOptimistic = task._isOptimistic

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-slate-800 border rounded-xl p-3.5 cursor-default select-none
        transition-all duration-150
        ${isSortableDragging || isDragging
          ? 'opacity-40 border-indigo-500 shadow-lg shadow-indigo-500/20 rotate-1 scale-105'
          : 'border-slate-700 hover:border-slate-600 hover:shadow-md hover:shadow-black/20'}
        ${isOptimistic ? 'opacity-70' : 'opacity-100'}
        ${isDone ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100"
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Completion checkbox */}
        <button
          onClick={handleToggleComplete}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110"
        >
          {isDone ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-slate-600 hover:border-emerald-500 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-medium leading-snug ${
            isDone ? 'line-through text-slate-500' : 'text-slate-200'
          }`}>
            {task.title}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Priority badge */}
            {priority.label && (
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${priority.color} ${priority.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                {priority.label}
              </span>
            )}

            {/* Due date */}
            {dueInfo && (
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${dueInfo.color} ${dueInfo.bg}`}>
                <Calendar className="w-3 h-3" />
                {dueInfo.text}
              </span>
            )}

            {/* Subtask progress */}
            {subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md text-slate-400 bg-slate-700/50">
                <CheckSquare className="w-3 h-3" />
                {completedSubtasks}/{subtasks.length}
              </span>
            )}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Context menu */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-6 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[140px]">
                <button
                  onClick={(e) => { e.stopPropagation(); /* open edit modal */ setShowMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit task
                </button>
                <div className="h-px bg-slate-700 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
