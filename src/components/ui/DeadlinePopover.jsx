/**
 * DeadlinePopover.jsx (trigger only)
 *
 * This component is now JUST the calendar icon button on each task card.
 * Clicking it dispatches `openDeadlineModal` to the global Zustand store.
 * The actual deadline-picking UI lives in DeadlineModal.jsx, rendered at root level in App.jsx.
 *
 * No floating-ui, no portal, no local open state.
 */

import { useMemo } from 'react'
import { addDays, format, isToday } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'

/*  Urgency calculation  */
export function getDeadlineUrgency(deadline, overdue, isDone = false) {
    // Completed tasks are never overdue  -  no urgency indicators at all
    if (isDone) return 'none'
    if (overdue) return 'overdue'
    if (!deadline) return 'none'
    const delta = new Date(deadline).getTime() - Date.now()
    if (delta <= 0) return 'overdue'
    if (delta <= 2 * 60 * 60 * 1000) return 'critical'
    if (delta <= 24 * 60 * 60 * 1000) return 'warning'
    return 'normal'
}

/*  Urgency → icon colour classes  */
const URGENCY_ICON = {
    none: 'text-muted-foreground/40 hover:text-muted-foreground/70',
    normal: 'text-muted-foreground/70 hover:text-muted-foreground',
    warning: 'text-amber-500 hover:text-amber-400',
    critical: 'text-red-500 hover:text-red-400 animate-[deadline-pulse_2s_ease-in-out_infinite]',
    overdue: 'text-red-600 hover:text-red-500 animate-[deadline-pulse_2s_ease-in-out_infinite]',
}

/*  DeadlinePopover Trigger Button  */
export default function DeadlinePopover({ task, projectId }) {
    const openDeadlineModal = useStore((s) => s.openDeadlineModal)
    const isDone = task.status === 'done'

    const urgency = useMemo(
        () => getDeadlineUrgency(task.deadline, task.overdue, isDone),
        [task.deadline, task.overdue, isDone]
    )

    /* Tooltip label */
    const triggerLabel = useMemo(() => {
        if (!task.deadline) return 'No deadline set  -  click to add'
        const d = new Date(task.deadline)
        const formatted = format(d, 'MMM d · h:mm a')
        if (isDone) return `Deadline: ${formatted}`
        const delta = d.getTime() - Date.now()
        if (urgency === 'overdue') return `Overdue · ${formatted}`
        if (urgency === 'critical') {
            const mins = Math.floor(delta / 60000)
            return `Due in ${mins}m · ${formatted}`
        }
        if (urgency === 'warning') return `Due soon · ${formatted}`
        return `Due ${formatted}`
    }, [task.deadline, urgency, isDone])

    /* Badge text  -  hidden for completed tasks */
    const badgeText = useMemo(() => {
        // No deadline badge on completed tasks
        if (isDone) return null
        if (!task.deadline) return null
        const d = new Date(task.deadline)
        const delta = d.getTime() - Date.now()
        if (urgency === 'overdue') return 'Overdue'
        if (urgency === 'critical') {
            const hrs = Math.floor(delta / 3600000)
            const mins = Math.floor((delta % 3600000) / 60000)
            return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m left`
        }
        if (isToday(d)) return 'Today'
        const tomorrow = addDays(new Date(), 1)
        if (format(d, 'yyyyMMdd') === format(tomorrow, 'yyyyMMdd')) return 'Tomorrow'
        return format(d, 'MMM d')
    }, [task.deadline, urgency, isDone])

    const handleClick = (e) => {
        e.stopPropagation()
        openDeadlineModal({
            taskId: task.id,
            projectId,
            currentDeadline: task.deadline ?? null,
        })
    }

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={triggerLabel}
                aria-haspopup="dialog"
                className={cn(
                    'relative group/dl flex items-center gap-1 transition-colors duration-200 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                    URGENCY_ICON[urgency],
                )}
            >
                <CalendarIcon className="w-3.5 h-3.5 shrink-0" />

                {/* Inline badge next to icon */}
                {badgeText && (
                    <span className={cn(
                        'text-[10px] font-semibold leading-none',
                        urgency === 'overdue' && 'text-red-500',
                        urgency === 'critical' && 'text-red-500',
                        urgency === 'warning' && 'text-amber-500',
                        urgency === 'normal' && 'text-muted-foreground',
                    )}>
                        {badgeText}
                    </span>
                )}

                {/* CSS tooltip on hover (no JS) */}
                <span className={cn(
                    'absolute -top-8 left-0 whitespace-nowrap text-[11px]',
                    'bg-[#111] text-white px-2.5 py-1 rounded-lg shadow-lg pointer-events-none z-50',
                    'opacity-0 group-hover/dl:opacity-100 transition-opacity delay-[400ms]',
                )}>
                    {triggerLabel}
                </span>
            </button>

            {/* Keyframe animation for urgency pulse */}
            <style>{`
                @keyframes deadline-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.5; }
                }
            `}</style>
        </>
    )
}
