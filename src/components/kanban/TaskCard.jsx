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
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

/* ─── Priority config (single source of truth for this file) ── */
const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-destructive', border: 'border-l-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
  high: { label: 'High', color: 'text-orange-500', border: 'border-l-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500', border: 'border-l-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  low: { label: 'Low', color: 'text-blue-500', border: 'border-l-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  none: { label: 'None', color: 'text-muted-foreground', border: '', bg: '', dot: 'bg-muted-foreground/40' },
}

/* ─── Priority items (ordered high → low) ─────────────────── */
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none']

/* ─── Due date formatter ───────────────────────────────────── */
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

/* ─── Inline priority flag button ─────────────────────────── */
/**
 * Renders a small flag-icon button that:
 * - Shows the current priority colour
 * - Opens a dropdown to change it on click
 * - stopPropagation so it doesn't trigger drag
 */
function PriorityButton({ task, updateTask, activeProjectId }) {
  const currentKey = task.priority ?? 'none'
  const cfg = PRIORITY_CONFIG[currentKey] ?? PRIORITY_CONFIG.none

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Priority: ${cfg.label}`}
          onPointerDown={(e) => e.stopPropagation()} // don't start drag
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            currentKey !== 'none' ? cn(cfg.color, 'opacity-100') : 'text-muted-foreground/50 hover:text-muted-foreground',
          )}
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="w-40"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
          Set Priority
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={currentKey}
          onValueChange={(value) => {
            updateTask(task.id, task.project_id ?? activeProjectId, { priority: value })
          }}
        >
          {PRIORITY_OPTIONS.map((key) => {
            const c = PRIORITY_CONFIG[key]
            return (
              <DropdownMenuRadioItem
                key={key}
                value={key}
                className="gap-2 cursor-pointer"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                <span className={cn('text-xs font-medium', key !== 'none' && c.color)}>
                  {c.label}
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Task Card ────────────────────────────────────────────── */
export default function TaskCard({ task, isDragging = false }) {
  const { activeProjectId, getSubtasks } = useStore(useShallow((s) => ({
    activeProjectId: s.activeProjectId,
    getSubtasks: s.getSubtasks,
  })))
  const { deleteTask, toggleTaskComplete, updateTask } = useTasks()

  const subtasks = getSubtasks(task.id)
  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length
  const dueInfo = formatDueDate(task.due_date)
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none
  const currentPriorityKey = task.priority ?? 'none'

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
    if (activeProjectId) await deleteTask(task.id, activeProjectId)
  }

  const handleToggleComplete = async (e) => {
    e.stopPropagation()
    if (activeProjectId) await toggleTaskComplete(task.id, activeProjectId)
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
        isDone && "opacity-60",
      )}
      {...attributes}
      {...listeners}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-200 hover:ring-1 hover:ring-primary/20 hover:shadow-md",
          currentPriorityKey !== 'none' ? cn("border-l-4", priority.border) : "border",
          isDragging ? "shadow-xl scale-105 rotate-2 cursor-grabbing" : "cursor-grab active:cursor-grabbing",
          "bg-card text-card-foreground",
        )}
      >
        <CardContent className="p-3.5 space-y-2.5">

          {/* ── Header: Checkbox + Title + Menu ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              {/* Complete toggle */}
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

              {/* Title */}
              <h4 className={cn(
                "text-sm font-medium leading-tight break-words",
                isDone && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h4>
            </div>

            {/* ⋮ Context menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Priority submenu inside ⋮ menu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Flag className={cn("w-3.5 h-3.5", currentPriorityKey !== 'none' ? priority.color : 'text-muted-foreground')} />
                    <span>Set Priority</span>
                    {currentPriorityKey !== 'none' && (
                      <span className={cn("ml-auto text-[10px] font-medium", priority.color)}>
                        {priority.label}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    <DropdownMenuRadioGroup
                      value={currentPriorityKey}
                      onValueChange={(value) =>
                        updateTask(task.id, task.project_id ?? activeProjectId, { priority: value })
                      }
                    >
                      {PRIORITY_OPTIONS.map((key) => {
                        const c = PRIORITY_CONFIG[key]
                        return (
                          <DropdownMenuRadioItem
                            key={key}
                            value={key}
                            className="gap-2 cursor-pointer"
                          >
                            <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                            <span className={cn('text-xs font-medium', key !== 'none' && c.color)}>
                              {c.label}
                            </span>
                          </DropdownMenuRadioItem>
                        )
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ── Footer: metadata + priority flag button ── */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Left: due date + subtask count + priority badge */}
            <div className="flex flex-wrap items-center gap-1.5">
              {dueInfo && (
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0 font-normal h-5 gap-1", dueInfo.className)}
                >
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

              {currentPriorityKey !== 'none' && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md h-5 font-medium",
                  priority.color, priority.bg,
                )}>
                  <Flag className="w-3 h-3" />
                  {priority.label}
                </div>
              )}
            </div>

            {/* Right: inline priority flag button (always visible) */}
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <PriorityButton
                task={task}
                updateTask={updateTask}
                activeProjectId={activeProjectId}
              />
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
