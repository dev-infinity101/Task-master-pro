import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  CheckSquare,
  Flag,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-destructive', border: 'border-l-destructive', bg: 'bg-destructive/10' },
  high:   { label: 'High',   color: 'text-orange-500', border: 'border-l-orange-500', bg: 'bg-orange-500/10' },
  medium: { label: 'Medium', color: 'text-yellow-500', border: 'border-l-yellow-500', bg: 'bg-yellow-500/10' },
  low:    { label: 'Low',    color: 'text-blue-500',   border: 'border-l-blue-500',   bg: 'bg-blue-500/10' },
  none:   { label: null,     color: '',                border: 'border-l-transparent', bg: '' },
}

function formatDueDate(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: 'Overdue', className: 'text-destructive bg-destructive/10' }
  if (diffDays === 0) return { text: 'Today', className: 'text-amber-500 bg-amber-500/10' }
  if (diffDays === 1) return { text: 'Tomorrow', className: 'text-muted-foreground bg-secondary' }
  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    className: 'text-muted-foreground bg-secondary',
  }
}

export default function TaskCard({ task, isDragging = false }) {
  const { activeProjectId, getSubtasks } = useStore(useShallow((s) => ({
    activeProjectId: s.activeProjectId,
    getSubtasks: s.getSubtasks,
  })))
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
      className={cn(
        "group relative touch-none outline-none",
        isSortableDragging && "z-50 opacity-50",
        isOptimistic && "opacity-70",
        isDone && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <Card 
        className={cn(
          "relative overflow-hidden border-l-4 transition-all duration-200 hover:ring-1 hover:ring-primary/20 hover:shadow-md",
          priority.border,
          isDragging ? "shadow-xl scale-105 rotate-2 cursor-grabbing" : "cursor-grab active:cursor-grabbing",
          "bg-card text-card-foreground"
        )}
      >
        <CardContent className="p-3.5 space-y-2.5">
          {/* Header: Title + Menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <button
                onClick={handleToggleComplete}
                className={cn(
                  "mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  isDone 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/40 hover:border-primary/50"
                )}
              >
                {isDone && <CheckSquare className="w-3 h-3" />}
              </button>
              <h4 className={cn(
                "text-sm font-medium leading-tight wrap-break-word",
                isDone && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h4>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Metadata Row */}
          {(dueInfo || subtasks.length > 0 || task.priority !== 'none') && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {dueInfo && (
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 font-normal h-5 gap-1", dueInfo.className)}>
                  <Calendar className="w-3 h-3" />
                  {dueInfo.text}
                </Badge>
              )}
              
              {subtasks.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md h-5">
                  <CheckSquare className="w-3 h-3" />
                  <span>{completedSubtasks}/{subtasks.length}</span>
                </div>
              )}

              {task.priority !== 'none' && (
                <div className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md h-5 font-medium", priority.color, priority.bg)}>
                  <Flag className="w-3 h-3" />
                  {priority.label}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
