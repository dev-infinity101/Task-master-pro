/**
 * TaskDetailModal.jsx
 *
 * A full-featured modal for viewing and editing every property of a task.
 * Opens when any task card is clicked anywhere in the app.
 *
 * Features:
 * - URL-driven state: ?task=<id> — supports deep-linking + browser back button
 * - Scale + fade entry animation (0.95→1 over 200ms)
 * - Auto-save: title/description debounced 500ms; other fields immediate
 * - Deadline panel with live countdown + deadline_type badge
 * - Subtask list with progress bar + inline add
 * - Priority selector (5 levels), Status badge (click to cycle)
 * - Tags multi-input
 * - Delete with confirmation click
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    X, Flag, Clock, Calendar, CheckSquare, Plus, Trash2,
    AlarmClock, RotateCcw, Tag, ChevronDown, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import { cn } from '@/lib/utils'

/* ─── Helpers ─────────────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
    urgent: { label: 'Urgent', color: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500' },
    high: { label: 'High', color: 'text-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
    medium: { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
    low: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
    none: { label: 'None', color: 'text-muted-foreground', bg: '', dot: 'bg-muted-foreground/40' },
}
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low', 'none']
const STATUS_CYCLE = ['todo', 'in_progress', 'done']
const STATUS_LABELS = { todo: 'Todo', in_progress: 'In Progress', done: 'Done' }
const STATUS_COLORS = {
    todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
}

function computeUrgency(deadline, overdue) {
    if (overdue) return 'overdue'
    if (!deadline) return 'normal'
    const delta = new Date(deadline).getTime() - Date.now()
    if (delta <= 0) return 'overdue'
    if (delta <= 2 * 60 * 60 * 1000) return 'critical'   // ≤ 2h
    if (delta <= 24 * 60 * 60 * 1000) return 'warning'   // ≤ 24h
    return 'normal'
}

function formatCountdown(deadline, overdue) {
    if (!deadline) return null
    const delta = new Date(deadline).getTime() - Date.now()
    const abs = Math.abs(delta)
    const days = Math.floor(abs / 86400000)
    const hrs = Math.floor((abs % 86400000) / 3600000)
    const mins = Math.floor((abs % 3600000) / 60000)

    let parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hrs > 0) parts.push(`${hrs}h`)
    if (mins >= 0 && days === 0) parts.push(`${mins}m`)

    if (overdue || delta <= 0) return `Overdue by ${parts.join(' ')}`
    return `Due in ${parts.join(' ')}`
}

function toLocalDatetimeString(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ─── SubtaskRow ───────────────────────────────────────────────────── */
function SubtaskRow({ subtask, onToggle, onDelete }) {
    const isDone = subtask.status === 'done'
    return (
        <div className="flex items-center gap-2.5 py-1.5 group/st">
            <button
                onClick={() => onToggle(subtask)}
                className={cn(
                    'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    isDone
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/40 hover:border-primary/60'
                )}
            >
                {isDone && <Check className="w-2.5 h-2.5" />}
            </button>
            <span className={cn('flex-1 text-sm', isDone && 'line-through text-muted-foreground')}>
                {subtask.title}
            </span>
            <button
                onClick={() => onDelete(subtask.id)}
                className="shrink-0 opacity-0 group-hover/st:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

/* ─── Main Modal ───────────────────────────────────────────────────── */
export default function TaskDetailModal() {
    const [searchParams, setSearchParams] = useSearchParams()
    const taskId = searchParams.get('task')

    const {
        tasks,
        activeProjectId,
        getSubtasks,
    } = useStore(useShallow((s) => ({
        tasks: s.tasks,
        activeProjectId: s.activeProjectId,
        getSubtasks: s.getSubtasks,
    })))

    const { updateTask, deleteTask, addTask } = useTasks()

    // Find the task across all projects
    const { task, projectId } = useMemo(() => {
        for (const [pid, tArr] of Object.entries(tasks)) {
            const found = (tArr ?? []).find((t) => t.id === taskId)
            if (found) return { task: found, projectId: pid }
        }
        return { task: null, projectId: null }
    }, [tasks, taskId])

    const subtasks = useMemo(
        () => (task ? getSubtasks(task.id) : []),
        [task, getSubtasks]
    )

    // Local editable state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [newSubtask, setNewSubtask] = useState('')
    const [newTag, setNewTag] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [visible, setVisible] = useState(false)

    // Sync local state when task loads
    useEffect(() => {
        if (task) {
            setTitle(task.title ?? '')
            setDescription(task.description ?? '')
            setDeleteConfirm(false)
        }
    }, [task?.id])

    // Entry animation
    useEffect(() => {
        if (taskId) {
            requestAnimationFrame(() => setVisible(true))
        } else {
            setVisible(false)
        }
    }, [taskId])

    // Debounced auto-save for title
    const titleDebounce = useRef(null)
    const handleTitleChange = (val) => {
        setTitle(val)
        clearTimeout(titleDebounce.current)
        titleDebounce.current = setTimeout(() => {
            if (val.trim() && val !== task?.title) {
                updateTask(task.id, projectId, { title: val.trim() })
            }
        }, 500)
    }

    // Debounced auto-save for description
    const descDebounce = useRef(null)
    const handleDescChange = (val) => {
        setDescription(val)
        clearTimeout(descDebounce.current)
        descDebounce.current = setTimeout(() => {
            if (val !== task?.description) {
                updateTask(task.id, projectId, { description: val })
            }
        }, 500)
    }

    const closeModal = useCallback(() => {
        setVisible(false)
        setTimeout(() => {
            const next = new URLSearchParams(searchParams)
            next.delete('task')
            setSearchParams(next, { replace: true })
        }, 180)
    }, [searchParams, setSearchParams])

    // Escape key handler
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') closeModal() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [closeModal])

    if (!taskId) return null
    if (!task) return null

    const urgency = computeUrgency(task.deadline, task.overdue)
    const countdown = formatCountdown(task.deadline, task.overdue)
    const priority = PRIORITY_CONFIG[task.priority ?? 'none'] ?? PRIORITY_CONFIG.none
    const tags = task.tags ?? []
    const completedSubtasks = subtasks.filter((s) => s.status === 'done').length

    /* ── Immediate updates ─────────────────────────────────────── */
    const handlePriorityChange = (p) => updateTask(task.id, projectId, { priority: p })

    const handleStatusCycle = () => {
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
        updateTask(task.id, projectId, { status: next })
    }

    const handleDeadlineChange = (val) => {
        if (!val) return
        updateTask(task.id, projectId, {
            deadline: new Date(val).toISOString(),
            deadline_type: 'manual',
        })
    }

    const handleResetDeadline = () => {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
        updateTask(task.id, projectId, {
            deadline: d.toISOString(),
            deadline_type: 'auto',
        })
    }

    /* ── Subtasks ─────────────────────────────────────────────── */
    const handleAddSubtask = async (e) => {
        e.preventDefault()
        if (!newSubtask.trim()) return
        const columns = useStore.getState().columns[projectId] ?? []
        const col = columns.find((c) => c.name.toLowerCase() === 'todo') ?? columns[0]
        await addTask(projectId, col?.id ?? task.column_id, {
            title: newSubtask.trim(),
            parent_task_id: task.id,
            status: 'todo',
        })
        setNewSubtask('')
    }

    const handleSubtaskToggle = (subtask) => {
        const newStatus = subtask.status === 'done' ? 'todo' : 'done'
        updateTask(subtask.id, projectId, { status: newStatus })
    }

    const handleSubtaskDelete = (subtaskId) => {
        deleteTask(subtaskId, projectId)
    }

    /* ── Tags ─────────────────────────────────────────────────── */
    const handleAddTag = (e) => {
        e.preventDefault()
        const t = newTag.trim().toLowerCase()
        if (!t || tags.includes(t)) return
        updateTask(task.id, projectId, { tags: [...tags, t] })
        setNewTag('')
    }

    const handleRemoveTag = (t) => {
        updateTask(task.id, projectId, { tags: tags.filter((x) => x !== t) })
    }

    /* ── Delete ────────────────────────────────────────────────── */
    const handleDelete = async () => {
        if (!deleteConfirm) { setDeleteConfirm(true); return }
        closeModal()
        await deleteTask(task.id, projectId)
        toast.success('Task deleted')
    }

    /* ── Urgency badge styles ──────────────────────────────────── */
    const urgencyBadge = {
        normal: null,
        warning: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
        critical: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse',
        overdue: 'text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-400 border border-red-300 dark:border-red-700',
    }[urgency]

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
                    visible ? 'opacity-100' : 'opacity-0'
                )}
                onClick={closeModal}
            />

            {/* Panel */}
            <div
                className={cn(
                    'fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none',
                )}
            >
                <div
                    className={cn(
                        'relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl',
                        'bg-white dark:bg-[#0D0D0D] border border-border shadow-2xl',
                        'pointer-events-auto transition-all duration-200',
                        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
                        // Urgency border accent
                        urgency === 'overdue' && 'border-red-500/60',
                        urgency === 'critical' && 'border-red-400/40',
                        urgency === 'warning' && 'border-amber-400/40',
                    )}
                >
                    {/* ── HEADER ────────────────────────────────────────── */}
                    <div className="flex items-start gap-3 p-5 pb-4 border-b border-border">
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                className={cn(
                                    'w-full text-lg font-bold bg-transparent border-0 outline-none resize-none',
                                    'text-[#111111] dark:text-foreground placeholder:text-muted-foreground',
                                    'hover:bg-muted/30 focus:bg-muted/40 rounded-lg px-2 py-1 -mx-2 transition-colors'
                                )}
                                placeholder="Task title…"
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-2 px-1">
                                {/* Status badge — click to cycle */}
                                <button
                                    onClick={handleStatusCycle}
                                    className={cn(
                                        'text-xs font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer',
                                        STATUS_COLORS[task.status] ?? STATUS_COLORS.todo
                                    )}
                                >
                                    {STATUS_LABELS[task.status] ?? task.status}
                                </button>

                                {/* Priority dropdown */}
                                <div className="relative group">
                                    <button
                                        className={cn(
                                            'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors',
                                            priority.color, priority.bg || 'bg-muted/50'
                                        )}
                                    >
                                        <Flag className="w-3 h-3" />
                                        {priority.label}
                                        <ChevronDown className="w-3 h-3 opacity-60" />
                                    </button>
                                    {/* Dropdown */}
                                    <div className="absolute top-full left-0 mt-1 z-10 bg-popover border border-border rounded-xl shadow-xl hidden group-focus-within:block p-1 min-w-[140px]">
                                        {PRIORITY_ORDER.map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => handlePriorityChange(p)}
                                                className={cn(
                                                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted transition-colors',
                                                    PRIORITY_CONFIG[p].color
                                                )}
                                            >
                                                <span className={cn('w-2 h-2 rounded-full', PRIORITY_CONFIG[p].dot)} />
                                                {PRIORITY_CONFIG[p].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Overdue badge */}
                                {urgency === 'overdue' && (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500 text-white tracking-wide">
                                        OVERDUE
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={closeModal}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-5 space-y-6">

                        {/* ── DEADLINE PANEL ──────────────────────────────── */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <AlarmClock className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">Deadline</h3>
                            </div>
                            <div className="bg-muted/30 dark:bg-white/5 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <input
                                        type="datetime-local"
                                        defaultValue={toLocalDatetimeString(task.deadline)}
                                        onChange={(e) => handleDeadlineChange(e.target.value)}
                                        className={cn(
                                            'flex-1 min-w-0 bg-transparent border border-border rounded-lg px-3 py-2',
                                            'text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                                            'dark:[color-scheme:dark]'
                                        )}
                                    />
                                    <button
                                        onClick={handleResetDeadline}
                                        title="Reset to 24h from now"
                                        className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        24h reset
                                    </button>
                                </div>

                                {/* Deadline type badge */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">
                                        {task.deadline_type === 'auto'
                                            ? '⚙️ Auto-set (24h from creation)'
                                            : '✏️ Custom deadline'}
                                    </span>
                                </div>

                                {/* Live countdown */}
                                {countdown && (
                                    <div className={cn(
                                        'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg',
                                        urgencyBadge ?? 'text-muted-foreground bg-muted/50'
                                    )}>
                                        <Clock className="w-3.5 h-3.5" />
                                        {countdown}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ── DESCRIPTION ─────────────────────────────────── */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-muted-foreground text-sm">📝</span>
                                <h3 className="text-sm font-semibold text-foreground">Description</h3>
                            </div>
                            <textarea
                                value={description}
                                onChange={(e) => handleDescChange(e.target.value)}
                                rows={4}
                                placeholder="Add notes, context, or details…"
                                className={cn(
                                    'w-full bg-muted/30 dark:bg-white/5 border border-border rounded-xl px-4 py-3',
                                    'text-sm text-foreground placeholder:text-muted-foreground',
                                    'focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors'
                                )}
                            />
                        </section>

                        {/* ── SUBTASKS ────────────────────────────────────── */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <CheckSquare className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    Subtasks
                                    {subtasks.length > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                                            {completedSubtasks}/{subtasks.length}
                                        </span>
                                    )}
                                </h3>
                            </div>

                            {/* Progress bar */}
                            {subtasks.length > 0 && (
                                <div className="h-1.5 w-full bg-muted rounded-full mb-3 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.round((completedSubtasks / subtasks.length) * 100)}%` }}
                                    />
                                </div>
                            )}

                            <div className="space-y-0.5">
                                {subtasks.map((st) => (
                                    <SubtaskRow
                                        key={st.id}
                                        subtask={st}
                                        onToggle={handleSubtaskToggle}
                                        onDelete={handleSubtaskDelete}
                                    />
                                ))}
                            </div>

                            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newSubtask}
                                    onChange={(e) => setNewSubtask(e.target.value)}
                                    placeholder="Add a subtask…"
                                    className={cn(
                                        'flex-1 bg-muted/30 dark:bg-white/5 border border-border rounded-lg px-3 py-2',
                                        'text-sm text-foreground placeholder:text-muted-foreground',
                                        'focus:outline-none focus:ring-2 focus:ring-ring transition-colors'
                                    )}
                                />
                                <button
                                    type="submit"
                                    disabled={!newSubtask.trim()}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </form>
                        </section>

                        {/* ── TAGS ────────────────────────────────────────── */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Tag className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">Tags</h3>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {tags.map((t) => (
                                    <span
                                        key={t}
                                        className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full"
                                    >
                                        {t}
                                        <button onClick={() => handleRemoveTag(t)} className="hover:text-red-500 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <form onSubmit={handleAddTag} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    placeholder="Add a tag…"
                                    className={cn(
                                        'flex-1 bg-muted/30 dark:bg-white/5 border border-border rounded-lg px-3 py-2',
                                        'text-sm text-foreground placeholder:text-muted-foreground',
                                        'focus:outline-none focus:ring-2 focus:ring-ring transition-colors'
                                    )}
                                />
                                <button
                                    type="submit"
                                    disabled={!newTag.trim()}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </form>
                        </section>

                        {/* ── META FOOTER ─────────────────────────────────── */}
                        <section className="pt-4 border-t border-border">
                            <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-3">
                                <div className="space-y-1">
                                    <p>Created: {new Date(task.created_at).toLocaleString()}</p>
                                    <p>Modified: {new Date(task.updated_at).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={handleDelete}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                                        deleteConfirm
                                            ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                                            : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                    )}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {deleteConfirm ? 'Confirm delete' : 'Delete task'}
                                </button>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </>
    )
}

/**
 * Hook to open the task detail modal for a given task ID.
 * Usage: const openTask = useOpenTask(); onClick={() => openTask(task.id)}
 */
export function useOpenTask() {
    const [, setSearchParams] = useSearchParams()
    return useCallback(
        (taskId) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.set('task', taskId)
                return next
            })
        },
        [setSearchParams]
    )
}
