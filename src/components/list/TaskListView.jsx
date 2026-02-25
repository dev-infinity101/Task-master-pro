import { useState, useRef } from 'react'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  MoreHorizontal,
  Plus,
  ChevronRight,
  ChevronDown,
  Calendar,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu"

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-destructive', bg: 'bg-destructive/10' },
  high: { label: 'High', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  medium: { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  low: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  none: { label: 'None', color: 'text-muted-foreground', bg: 'bg-muted/10' },
}

const PRIORITY_ORDER = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

const STATUS_CONFIG = {
  todo: { label: 'Todo', icon: Circle, color: 'text-slate-400' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-400' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-400' },
  backlog: { label: 'Backlog', icon: AlertCircle, color: 'text-orange-400' },
  canceled: { label: 'Canceled', icon: Circle, color: 'text-muted-foreground' },
}

function TaskRow({ task, level = 0, index }) {
  const [expanded, setExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const inputRef = useRef(null)

  const { getSubtasks } = useStore(useShallow((s) => ({
    getSubtasks: s.getSubtasks,
  })))

  const { updateTask, toggleTaskComplete, deleteTask, addTask } = useTasks()

  const subtasks = getSubtasks(task.id)
  const hasSubtasks = subtasks.length > 0

  // Auto-expand if adding subtask
  const showSubtasks = expanded || hasSubtasks || isAddingSubtask

  const handleToggleExpand = () => setExpanded(!expanded)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      updateTask(task.id, task.project_id, { title })
      setIsEditing(false)
    } else if (e.key === 'Escape') {
      setTitle(task.title)
      setIsEditing(false)
    }
  }

  const handleAddSubtask = async (e) => {
    e.preventDefault()
    if (!subtaskTitle.trim()) {
      setIsAddingSubtask(false)
      return
    }

    await addTask(task.project_id, task.column_id, {
      title: subtaskTitle,
      parent_task_id: task.id,
      status: 'todo',
      priority: 'none'
    })
    setSubtaskTitle('')
    setIsAddingSubtask(false)
    setExpanded(true)
  }

  const priorityKey = task.priority ?? 'none'
  const priority = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none
  const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
  const StatusIcon = status.icon

  const sortedSubtasks = [...subtasks].sort((a, b) => {
    const aRank = PRIORITY_ORDER[a.priority ?? 'none'] ?? 0
    const bRank = PRIORITY_ORDER[b.priority ?? 'none'] ?? 0
    if (aRank !== bRank) return bRank - aRank
    return (a.position || 0) - (b.position || 0)
  })

  return (
    <div className="group border-b border-border bg-card last:border-0 transition-colors">
      <div className="flex items-center gap-3 py-3 px-4 min-h-[56px] hover:bg-muted/20">
        {/* Expand/Collapse */}
        <div className="w-6 flex justify-center shrink-0">
          {(hasSubtasks || isAddingSubtask) ? (
            <button
              onClick={handleToggleExpand}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSubtasks && expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* Checkbox */}
        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={() => toggleTaskComplete(task.id, task.project_id)}
          className="border-muted-foreground/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
        />

        {/* Task ID (Mock) */}
        <span className="text-xs font-mono text-muted-foreground w-16 shrink-0 truncate">
          TASK #{index}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (title !== task.title) updateTask(task.id, task.project_id, { title })
                setIsEditing(false)
              }}
              className="h-8 bg-transparent border-none shadow-none focus-visible:ring-0 px-0 font-medium"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className={cn(
                "font-medium cursor-text truncate select-none",
                task.status === 'done' && "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </span>
          )}

          {/* Subtask count badge */}
          {hasSubtasks && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-white/10 text-muted-foreground">
              {subtasks.filter(t => t.status === 'done').length}/{subtasks.length}
            </Badge>
          )}
        </div>

        {/* Status */}
        <div className="w-32 hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <StatusIcon className={cn("w-3.5 h-3.5", status.color)} />
          <span>{status.label}</span>
        </div>

        {/* Priority */}
        <div className="w-24 hidden md:flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-7 w-full rounded-md px-2 flex items-center gap-1.5 text-xs font-medium transition-colors",
                  "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  priorityKey === 'none'
                    ? "text-muted-foreground"
                    : cn(priority.color, priority.bg)
                )}
              >
                <Flag className={cn("w-3 h-3", priorityKey === 'none' && "opacity-60")} />
                <span className="truncate">
                  {priorityKey === 'none' ? '' : priority.label}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 bg-card border-white/10">
              <DropdownMenuRadioGroup
                value={priorityKey}
                onValueChange={(value) => updateTask(task.id, task.project_id, { priority: value })}
              >
                <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="urgent">Urgent</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {level < 3 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsAddingSubtask(true)
                setExpanded(true)
              }}
              title="Add subtask"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                Edit Title
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteTask(task.id, task.project_id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Subtasks Container */}
      {(showSubtasks && expanded) && (
        <div className="pl-8 border-l border-border ml-7">
          {sortedSubtasks.map((subtask, subIndex) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              level={level + 1}
              index={`${index}.${subIndex + 1}`}
            />
          ))}

          {/* Inline Add Subtask Input */}
          {isAddingSubtask && (
            <div className="flex items-center gap-3 py-2 px-4 border-l-2 border-primary/50 bg-white/5">
              <div className="w-4" />
              <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
              <form onSubmit={handleAddSubtask} className="flex-1 flex items-center gap-2">
                <Input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Subtask title..."
                  className="h-8 bg-transparent border-none shadow-none focus-visible:ring-0 px-0"
                  autoFocus
                  onBlur={() => !subtaskTitle && setIsAddingSubtask(false)}
                />
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TaskListView() {
  const { activeProjectId, getTasksByColumn, getActiveColumns } = useStore(useShallow((s) => ({
    activeProjectId: s.activeProjectId,
    getTasksByColumn: s.getTasksByColumn,
    getActiveColumns: s.getActiveColumns,
  })))

  const { addTask } = useTasks()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const tasksByColumn = getTasksByColumn()
  const columns = getActiveColumns()

  // Flatten tasks from all columns for the list view
  const allTasks = Object.values(tasksByColumn).flat().sort((a, b) => {
    const aRank = PRIORITY_ORDER[a.priority ?? 'none'] ?? 0
    const bRank = PRIORITY_ORDER[b.priority ?? 'none'] ?? 0
    if (aRank !== bRank) return bRank - aRank
    return (a.position || 0) - (b.position || 0)
  })

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !activeProjectId) return

    // Add to first column by default
    const firstCol = columns[0]
    if (!firstCol) return

    await addTask(activeProjectId, firstCol.id, {
      title: newTaskTitle,
      status: 'todo',
      priority: 'none'
    })
    setNewTaskTitle('')
    setIsAdding(false)
  }

  if (!activeProjectId) return null

  return (
    <div className="h-full flex flex-col bg-background text-foreground animate-in fade-in duration-300">
      {/* List Header */}
      <div className="grid grid-cols-[1fr_128px_96px_40px] gap-4 px-6 py-3 text-xs font-medium text-muted-foreground border-b border-border bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="pl-10">Task</div>
        <div className="hidden sm:block">Status</div>
        <div className="hidden md:block">Priority</div>
        <div></div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="flex flex-col">
          {allTasks.length === 0 && !isAdding && (
            <div className="py-12 text-center text-muted-foreground">
              <p>No tasks found. Create one to get started.</p>
            </div>
          )}

          {allTasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              index={idx + 1}
            />
          ))}

          {/* Add Task Row */}
          {isAdding ? (
            <div className="px-6 py-3 border-b border-white/5 bg-white/5">
              <form onSubmit={handleAddTask} className="flex items-center gap-3">
                <div className="w-6" />
                <Checkbox disabled className="opacity-50" />
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="New task title..."
                  className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-0 h-8 font-medium"
                  autoFocus
                  onBlur={() => !newTaskTitle && setIsAdding(false)}
                />
                <Button type="submit" size="sm" variant="glass">Add Task</Button>
              </form>
            </div>
          ) : (
            <div
              onClick={() => setIsAdding(true)}
              className="px-6 py-4 flex items-center gap-3 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 transition-colors border-b border-border group"
            >
              <Plus className="w-4 h-4 ml-8 group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium">Add New Task</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
