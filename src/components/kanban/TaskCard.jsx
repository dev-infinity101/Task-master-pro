/**
 * TaskCard.jsx
 *
 * Kanban task card with:
 * - dnd-kit drag-and-drop support
 * - Visual urgency states (warning / critical / overdue) from deadline field
 * - DeadlinePopover floating picker on the calendar icon
 * - Priority flag inline dropdown
 * - Subtask count badge
 * - Delete + complete toggles
 */

import { useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CheckSquare, Flag, Trash2, Clock, AlertTriangle,
} from 'lucide-react'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import DeadlinePopover, { getDeadlineUrgency } from '../ui/DeadlinePopover'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

/* ─── Priority config ─────────────────────────────────────── */
const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'text-destructive', border: 'border-l-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
  high: { label: 'High', color: 'text-orange-500', border: 'border-l-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500', border: 'border-l-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  low: { label: 'Low', color: 'text-blue-500', border: 'border-l-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  none: { label: 'None', color: 'text-muted-foreground', border: '', bg: '', dot: 'bg-muted-foreground/40' },
}

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none']

/* ─── Priority flag dropdown ──────────────────────────────── */
function PriorityButton({ task, updateTask, activeProjectId }) {
  const currentKey = task.priority ?? 'none'
  const cfg = PRIORITY_CONFIG[currentKey] ?? PRIORITY_CONFIG.none

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Priority: ${cfg.label}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            currentKey !== 'none'
              ? cn(cfg.color, 'opacity-100')
              : 'text-muted-foreground/50 hover:text-muted-foreground',
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
              <DropdownMenuRadioItem key={key} value={key} className="gap-2 cursor-pointer">
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
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none
  const currentPriorityKey = task.priority ?? 'none'

  // Urgency from deadline (memoised)
  const urgency = useMemo(
    () => getDeadlineUrgency(task.deadline, task.overdue),
    [task.deadline, task.overdue]
  )

  // dnd-kit sortable
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

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

  /* ── Urgency-derived card decoration ────────────────────── */
  const urgencyRing = {
    none: '',
    normal: '',
    warning: 'ring-1 ring-inset ring-amber-400/25 dark:ring-amber-500/20',
    critical: 'ring-1 ring-inset ring-red-400/40 dark:ring-red-500/30',
    overdue: 'ring-1 ring-inset ring-red-500/50 dark:ring-red-600/40',
  }[urgency]

  const urgencyBg = {
    overdue: 'bg-red-50/30 dark:bg-red-950/20',
  }[urgency] ?? ''

  const borderLeft = urgency !== 'none' && urgency !== 'normal'
    ? {
      warning: 'border-l-4 border-l-amber-400',
      critical: 'border-l-4 border-l-red-500',
      overdue: 'border-l-4 border-l-red-600',
    }[urgency]
    : currentPriorityKey !== 'none'
      ? cn('border-l-4', priority.border)
      : 'border'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative touch-none outline-none',
        isSortableDragging && 'z-50 opacity-50',
        isOptimistic && 'opacity-70',
        isDone && 'opacity-60',
      )}
      {...attributes}
      {...listeners}
    >
      <Card
        className={cn(
          'relative overflow-visible transition-all duration-200',
          'hover:shadow-md hover:ring-1 hover:ring-primary/15',
          borderLeft,
          urgencyRing,
          urgencyBg,
          isDragging
            ? 'shadow-2xl scale-105 rotate-1 cursor-grabbing'
            : 'cursor-grab active:cursor-grabbing',
          'bg-card text-card-foreground',
        )}
      >
        <CardContent className="p-3.5 space-y-2.5">

          {/* ── Header ───────────────────────────────────── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              {/* Complete toggle */}
              <button
                onClick={handleToggleComplete}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  'mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
                  isDone
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/40 hover:border-primary/50'
                )}
              >
                {isDone && <CheckSquare className="w-3 h-3" />}
              </button>
              {/* Title */}
              <h4 className={cn(
                'text-sm font-medium leading-tight break-words select-none',
                isDone && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>
            </div>

            {/* Delete (hover only) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:text-destructive hover:bg-destructive/10"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* ── Urgency inline badges ─────────────────── */}
          {!isDone && urgency === 'overdue' && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" />
              OVERDUE
            </div>
          )}
          {!isDone && urgency === 'critical' && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 animate-pulse">
              <Clock className="w-3 h-3" />
              Due very soon
            </div>
          )}

          {/* ── Footer: deadline icon + subtasks + priority ── */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Left cluster */}
            <div className="flex items-center gap-2">
              {/* Deadline popover trigger (calendar icon) */}
              <DeadlinePopover
                task={task}
                projectId={task.project_id ?? activeProjectId}
              />

              {/* Subtask count */}
              {subtasks.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md h-5">
                  <CheckSquare className="w-3 h-3" />
                  <span>{completedSubtasks}/{subtasks.length}</span>
                </div>
              )}

              {/* Priority badge (only when no urgency override) */}
              {currentPriorityKey !== 'none' && (urgency === 'none' || urgency === 'normal') && (
                <div className={cn(
                  'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md h-5 font-medium',
                  priority.color, priority.bg,
                )}>
                  <Flag className="w-3 h-3" />
                  {priority.label}
                </div>
              )}
            </div>

            {/* Right: priority flag button (hover) */}
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
