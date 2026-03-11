/**
 * DeadlineModal.jsx
 *
 * Centered full-screen modal for picking a task deadline.
 * Rendered once in App.jsx root  -  never inside Kanban columns,
 * so z-index and overflow:hidden clipping are non-issues.
 *
 * State flow:
 *   TaskCard calendar icon clicked
 *     → store.openDeadlineModal({ taskId, projectId, currentDeadline })
 *     → this modal renders
 *     → user picks date/time → clicks Confirm
 *     → updateTask({ deadline, deadline_type: 'manual', overdue })
 *     → store.closeDeadlineModal()
 *
 * Escape / backdrop click → close without saving.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
    format, addDays, setHours, setMinutes, isToday,
} from 'date-fns'
import { X, Clock, Zap, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import { Calendar } from '@/components/ui/calendar'



function endOfDay(date) {
    return setMinutes(setHours(date, 23), 59)
}

function buildISO(date, h, m, ap) {
    if (!date) return null
    let hours24 = h % 12
    if (ap === 'PM') hours24 += 12
    return setMinutes(setHours(date, hours24), m).toISOString()
}

/*  DeadlineModal  */
export default function DeadlineModal() {
    const { deadlineModal, closeDeadlineModal } = useStore(
        useShallow((s) => ({
            deadlineModal: s.deadlineModal,
            closeDeadlineModal: s.closeDeadlineModal,
        }))
    )
    const { open, taskId, projectId, currentDeadline } = deadlineModal

    /* Mount animation state */
    const [visible, setVisible] = useState(false)
    const modalRef = useRef(null)

    /* Local form state */
    const initDate = currentDeadline ? new Date(currentDeadline) : null
    const [selectedDate, setSelectedDate] = useState(initDate)
    const [hour, setHour] = useState(initDate ? ((initDate.getHours() % 12) || 12) : 11)
    const [minute, setMinute] = useState(initDate ? initDate.getMinutes() : 59)
    const [ampm, setAmpm] = useState(initDate ? (initDate.getHours() < 12 ? 'AM' : 'PM') : 'PM')
    const [calMonth, setCalMonth] = useState(initDate ?? new Date())

    const { updateTask } = useTasks()

    /* Re-init state when a new task is opened */
    useEffect(() => {
        if (!open) return
        const d = currentDeadline ? new Date(currentDeadline) : null
        setSelectedDate(d)
        setCalMonth(d ?? new Date())
        setHour(d ? ((d.getHours() % 12) || 12) : 11)
        setMinute(d ? d.getMinutes() : 59)
        setAmpm(d ? (d.getHours() < 12 ? 'AM' : 'PM') : 'PM')
    }, [open, currentDeadline])

    /* Trigger entrance animation */
    useEffect(() => {
        if (open) {
            const t = setTimeout(() => setVisible(true), 10)
            return () => clearTimeout(t)
        } else {
            setVisible(false)
        }
    }, [open])

    /* Auto-focus modal div */
    useEffect(() => {
        if (open && modalRef.current) {
            modalRef.current.focus()
        }
    }, [open])

    /* Keyboard: Escape → close, Ctrl/Cmd+Enter → confirm */
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            closeDeadlineModal()
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleConfirm()
        }
    }, [selectedDate, hour, minute, ampm]) // eslint-disable-line

    const handleConfirm = useCallback(async () => {
        const iso = buildISO(selectedDate, hour, minute, ampm)
        if (!taskId || !iso) { closeDeadlineModal(); return }
        await updateTask(taskId, projectId, {
            deadline: iso,
            deadline_type: 'manual',
            overdue: new Date(iso).getTime() <= Date.now()
        })
        closeDeadlineModal()
    }, [selectedDate, hour, minute, ampm, taskId, projectId, updateTask, closeDeadlineModal])

    const handleQuick = useCallback(async (date) => {
        const iso = endOfDay(date).toISOString()
        await updateTask(taskId, projectId, {
            deadline: iso,
            deadline_type: 'manual',
            overdue: false,
        })
        closeDeadlineModal()
    }, [taskId, projectId])

    const handleReset = useCallback(async () => {
        const auto = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await updateTask(taskId, projectId, {
            deadline: auto.toISOString(),
            deadline_type: 'auto',
            overdue: false,
        })
        closeDeadlineModal()
    }, [taskId, projectId])

    const handleClear = useCallback(async () => {
        await updateTask(taskId, projectId, { deadline: null, deadline_type: null, overdue: false })
        closeDeadlineModal()
    }, [taskId, projectId])

    const handleSelectDay = (day) => {
        if (!day) return
        setSelectedDate(day)
        setCalMonth(day)
        setHour(11); setMinute(59); setAmpm('PM')
    }

    const isAutoSet = !currentDeadline

    if (!open) return null

    return createPortal(
        <>
            <style>{`
                @keyframes dm-backdrop { from { opacity: 0; } to { opacity: 1; } }
                @keyframes dm-enter    { from { opacity: 0; transform: translate(-50%,-50%) scale(0.92); }
                                           to   { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
            `}</style>

            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 9998,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(4px)',
                    animation: 'dm-backdrop 180ms ease-out forwards',
                }}
                onClick={closeDeadlineModal}
            />

            {/* Modal box */}
            <div
                ref={modalRef}
                role="dialog"
                aria-label="Set deadline"
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                style={{
                    position: 'fixed',
                    top: '50%', left: '50%',
                    zIndex: 9999,
                    width: 320,
                    borderRadius: 16,
                    outline: 'none',
                    animation: visible
                        ? 'dm-enter 180ms ease-out forwards'
                        : 'none',
                    transform: 'translate(-50%,-50%)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                }}
                className="bg-card text-card-foreground"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                    <span className="text-sm font-semibold text-foreground">Set Deadline</span>
                    <button
                        onClick={closeDeadlineModal}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Select */}
                <div className="flex gap-2 p-3 pb-2">
                    {[
                        { label: 'Today', date: new Date() },
                        { label: 'Tomorrow', date: addDays(new Date(), 1) },
                        { label: 'Next Week', date: addDays(new Date(), 7) },
                    ].map(({ label, date }) => (
                        <button
                            key={label}
                            onClick={() => handleQuick(date)}
                            className={cn(
                                'flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-lg',
                                'bg-muted hover:bg-accent border border-border dark:border-white/5',
                                'text-muted-foreground hover:text-foreground transition-all duration-150'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Calendar */}
                <div className="px-2 pb-1 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate ?? undefined}
                        onSelect={handleSelectDay}
                        month={calMonth}
                        onMonthChange={setCalMonth}
                        showOutsideDays
                        className="p-1 pointer-events-auto"
                    />
                </div>

                {/* Time row (enabled after date selected) */}
                <div className={cn(
                    'flex items-center gap-2 px-3 py-2.5 border-t border-border transition-opacity',
                    selectedDate ? 'opacity-100' : 'opacity-40 pointer-events-none select-none'
                )}>
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 flex-1">
                        {/* Hour */}
                        <input
                            type="number" min={1} max={12} value={hour}
                            onChange={(e) => setHour(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
                            className="w-10 text-center bg-muted border border-border rounded-md text-sm text-foreground font-mono py-1 focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-muted-foreground font-bold">:</span>
                        {/* Minute */}
                        <input
                            type="number" min={0} max={59} value={String(minute).padStart(2, '0')}
                            onChange={(e) => setMinute(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                            className="w-10 text-center bg-muted border border-border rounded-md text-sm text-foreground font-mono py-1 focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {/* AM/PM */}
                        <button
                            onClick={() => setAmpm((p) => p === 'AM' ? 'PM' : 'AM')}
                            className="px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                        >
                            {ampm}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-3 py-3 border-t border-border">
                    {/* Left: Auto label or Reset */}
                    {isAutoSet ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Zap className="w-3 h-3" />
                            <span>Auto-set · 24h</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                        </button>
                    )}

                    {/* Right: Clear + Confirm */}
                    <div className="flex items-center gap-2">
                        {currentDeadline && (
                            <button
                                onClick={handleClear}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <X className="w-3 h-3" />
                                <span>Clear</span>
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedDate}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                selectedDate
                                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                            )}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    )
}
