/**
 * AIFeaturesPanel.jsx — Full-featured AI panel with all 4 AI modes
 *
 * Features:
 *  - Daily Auto-Planning   (mode: plan)
 *  - Smart Task Decompose  (mode: decompose)
 *  - Weekly Review         (mode: review)
 *  + Smart Analytics Narration is exposed via the useAIFeatures hook for Analytics page
 *
 * Design principles:
 *  - No layout shift during load (skeleton matches final layout)
 *  - Defensive rendering (optional chaining, field validation)
 *  - Retry button on every error state
 *  - Clean, minimal SaaS aesthetic
 *  - Accessible: all interactive elements have descriptive labels
 */

import { useState, useCallback, useMemo } from 'react'
import {
    Calendar, ListTodo, BarChart2,
    Loader2, RefreshCw, AlertCircle, ChevronRight,
    CheckCircle2, Clock, AlertTriangle, X,
    TrendingUp, TrendingDown, ArrowRight, Zap,
    BookOpen, ClipboardList,
} from 'lucide-react'
import EnergyCubeIcon from '../ui/EnergyCubeIcon'
import { useAIFeatures } from '../../hooks/useAIFeatures'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPlanPayload(tasks, activeProjectId) {
    const projectTasks = (tasks[activeProjectId] ?? [])
    const todoTasks = projectTasks
        .filter(t => t.status === 'todo' && (t.parent_task_id === null || t.parent_task_id === undefined))
        .map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority ?? 'none',
            due_date: t.due_date ?? null,
            status: t.status,
            estimated_minutes: null,
        }))
    const completedLast7 = projectTasks.filter(t => {
        if (t.status !== 'done' || !t.completed_at) return false
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return new Date(t.completed_at) >= cutoff
    }).length
    return {
        date: new Date().toISOString().split('T')[0],
        tasks: todoTasks,
        completed_last_7_days: completedLast7,
        average_daily_capacity_minutes: 300,
    }
}

function buildWeeklyReviewPayload(tasks, activeProjectId) {
    const projectTasks = (tasks[activeProjectId] ?? [])
    const now = new Date()
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)

    const completedThisWeek = projectTasks.filter(t =>
        t.status === 'done' && t.completed_at && new Date(t.completed_at) >= weekAgo
    ).length
    const completedLastWeek = projectTasks.filter(t =>
        t.status === 'done' && t.completed_at &&
        new Date(t.completed_at) >= twoWeeksAgo && new Date(t.completed_at) < weekAgo
    ).length
    const addedThisWeek = projectTasks.filter(t =>
        t.created_at && new Date(t.created_at) >= weekAgo
    ).length
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
    const overdueCount = projectTasks.filter(t =>
        t.due_date && t.status !== 'done' && new Date(t.due_date) < todayMidnight
    ).length
    const total = projectTasks.filter(t =>
        t.parent_task_id === null || t.parent_task_id === undefined
    ).length
    const completed = projectTasks.filter(t =>
        t.status === 'done' && (t.parent_task_id === null || t.parent_task_id === undefined)
    ).length

    const priorityCounts = projectTasks.reduce((acc, t) => {
        if (t.parent_task_id) return acc
        acc[t.priority ?? 'none'] = (acc[t.priority ?? 'none'] ?? 0) + 1
        return acc
    }, {})

    return {
        period: 'This week',
        tasks_completed_this_week: completedThisWeek,
        tasks_completed_previous_week: completedLastWeek,
        tasks_added_this_week: addedThisWeek,
        overdue_count: overdueCount,
        total_tasks: total,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        priority_distribution: priorityCounts,
    }
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────

function Skeleton({ className }) {
    return (
        <div className={cn('bg-muted/60 rounded animate-pulse', className)} />
    )
}

// ── Error State ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center gap-3 py-6 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
            {onRetry && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="h-8 text-xs gap-1.5"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                </Button>
            )}
        </div>
    )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ message }) {
    return (
        <div className="flex flex-col items-center gap-3 py-6 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
                {message ?? 'Not enough data to generate an AI result. Add more tasks and try again.'}
            </p>
        </div>
    )
}

// ── Section Card Shell ────────────────────────────────────────────────────────

function FeatureCard({ icon: Icon, iconGradient, title, badge, children, onClear, actionSlot }) {
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconGradient)}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold leading-none">{title}</p>
                        {badge && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{badge}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {actionSlot}
                    {onClear && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={onClear}
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    )
}

// ── Priority Badge ────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
    urgent: 'bg-red-500/10 text-red-500 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    none: 'bg-muted text-muted-foreground border-border',
}

function PriorityBadge({ priority }) {
    const p = priority ?? 'none'
    return (
        <span className={cn(
            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
            PRIORITY_STYLES[p] ?? PRIORITY_STYLES.none
        )}>
            {p}
        </span>
    )
}

// ── Daily Plan Card ───────────────────────────────────────────────────────────

function DailyPlanResult({ data }) {
    const must_do = Array.isArray(data?.must_do) ? data.must_do : []
    const should_do = Array.isArray(data?.should_do) ? data.should_do : []
    const optional = Array.isArray(data?.optional) ? data.optional : []
    const focus_message = typeof data?.focus_message === 'string' ? data.focus_message : null

    const Section = ({ label, items, color, dotColor }) => {
        if (!items.length) return null
        return (
            <div className="mb-4">
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-2', color)}>{label}</p>
                <ul className="space-y-1.5">
                    {items.map((item, i) => (
                        <li
                            key={i}
                            className="flex items-start gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5 text-xs"
                        >
                            <span className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', dotColor)} />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground leading-snug">
                                    {typeof item?.task_id === 'string' ? item.task_id : (item?.title ?? '—')}
                                </p>
                                {typeof item?.reason === 'string' && (
                                    <p className="text-muted-foreground mt-0.5 leading-snug">{item.reason}</p>
                                )}
                            </div>
                            {item?.priority && <PriorityBadge priority={item.priority} />}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    const isEmpty = must_do.length === 0 && should_do.length === 0 && optional.length === 0

    if (isEmpty) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                No todo tasks found to plan. Create some tasks first!
            </p>
        )
    }

    return (
        <div>
            <Section label="Must Do" items={must_do} color="text-red-500" dotColor="bg-red-500" />
            <Section label="Should Do" items={should_do} color="text-amber-500" dotColor="bg-amber-500" />
            <Section label="Optional" items={optional} color="text-emerald-500" dotColor="bg-emerald-500" />
            {focus_message && (
                <div className="mt-1 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                        💡 {focus_message}
                    </p>
                </div>
            )}
        </div>
    )
}

// ── Decompose Card ────────────────────────────────────────────────────────────

function DecomposeResult({ data }) {
    const subtasks = Array.isArray(data?.subtasks) ? data.subtasks : []
    const original = typeof data?.original_task === 'string' ? data.original_task : null

    if (subtasks.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                No subtasks generated. Try describing a more specific task.
            </p>
        )
    }

    return (
        <div>
            {original && (
                <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl">
                    <p className="text-[10px] text-primary/70 font-semibold uppercase tracking-widest mb-0.5">Task</p>
                    <p className="text-xs font-medium text-foreground">{original}</p>
                </div>
            )}
            <ol className="space-y-1.5">
                {subtasks.map((subtask, i) => {
                    // Normalise: backend may return string or { title, description } object
                    const title = typeof subtask === 'string'
                        ? subtask
                        : (typeof subtask?.title === 'string' ? subtask.title : null)
                    const description = typeof subtask === 'object' && typeof subtask?.description === 'string'
                        ? subtask.description
                        : null
                    if (!title) return null
                    return (
                        <li
                            key={i}
                            className="flex items-start gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5 text-xs"
                        >
                            <span className="text-[10px] font-bold text-primary/50 w-4 shrink-0 mt-0.5 tabular-nums">
                                {i + 1}.
                            </span>
                            <div className="flex-1 min-w-0">
                                <span className="text-foreground leading-snug font-medium block">{title}</span>
                                {description && (
                                    <span className="text-muted-foreground leading-snug mt-0.5 block">{description}</span>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}

// ── Weekly Review Card ────────────────────────────────────────────────────────

function WeeklyReviewResult({ data }) {
    const summary = typeof data?.summary === 'string' ? data.summary : null
    const highlights = Array.isArray(data?.highlights) ? data.highlights : []
    const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : []

    // Trend badge helper
    const trend = typeof data?.trend === 'string' ? data.trend : null
    const isPositive = trend === 'up'
    const TrendIcon = isPositive ? TrendingUp : TrendingDown

    return (
        <div className="space-y-4">
            {summary && (
                <p className="text-sm text-foreground leading-relaxed font-medium">{summary}</p>
            )}
            {trend && (
                <div className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
                    isPositive
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20'
                        : 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20'
                )}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    {isPositive ? 'Improving' : 'Declining'} this week
                </div>
            )}
            {highlights.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Highlights</p>
                    <ul className="space-y-1.5">
                        {highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground bg-muted/40 rounded-xl px-3 py-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{typeof h === 'string' ? h : JSON.stringify(h)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {recommendations.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recommendations</p>
                    <ul className="space-y-1.5">
                        {recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground bg-primary/5 border border-primary/10 rounded-xl px-3 py-2">
                                <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                <span>{typeof r === 'string' ? r : JSON.stringify(r)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

// ── Decompose Input Modal ─────────────────────────────────────────────────────

function DecomposeInput({ onSubmit, onCancel, isLoading }) {
    const [taskTitle, setTaskTitle] = useState('')
    const [context, setContext] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!taskTitle.trim()) return
        onSubmit({ task_title: taskTitle.trim(), context: context.trim() || undefined })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Task to break down
                </label>
                <textarea
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="e.g. Build user authentication system"
                    className="w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-h-[72px] text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                    required
                />
            </div>
            <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Context / tech stack (optional)
                </label>
                <textarea
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    placeholder="e.g. React frontend, Supabase auth, JWT tokens"
                    className="w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-h-[56px] text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                />
            </div>
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="flex-1 h-9 text-xs"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    size="sm"
                    disabled={!taskTitle.trim() || isLoading}
                    className="flex-1 h-9 text-xs gap-1.5"
                >
                    {isLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Decomposing…</>
                        : <><EnergyCubeIcon size={20} className="mr-1" />Decompose</>}
                </Button>
            </div>
        </form>
    )
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function PlanSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            {[80, 90, 70].map((w, i) => (
                <div key={i} className="bg-muted/40 rounded-xl px-3 py-3 space-y-1.5">
                    <Skeleton className="h-3" style={{ width: `${w}%` }} />
                    <Skeleton className="h-2.5" style={{ width: `${w - 20}%` }} />
                </div>
            ))}
            <Skeleton className="h-3 w-24 mt-4" />
            {[65, 75].map((w, i) => (
                <div key={i} className="bg-muted/40 rounded-xl px-3 py-3">
                    <Skeleton className="h-3" style={{ width: `${w}%` }} />
                </div>
            ))}
        </div>
    )
}

function DecomposeSkeleton() {
    return (
        <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-muted/40 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <Skeleton className="h-3 w-4" />
                    <Skeleton className="h-3 flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
                </div>
            ))}
        </div>
    )
}

function ReviewSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="space-y-2 mt-4">
                {[75, 85, 60].map((w, i) => (
                    <div key={i} className="bg-muted/40 rounded-xl px-3 py-2.5">
                        <Skeleton className="h-3" style={{ width: `${w}%` }} />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Main AIFeaturesPanel ──────────────────────────────────────────────────────

export default function AIFeaturesPanel() {
    const { user, tasks, activeProjectId } = useStore(useShallow(s => ({
        user: s.user,
        tasks: s.tasks,
        activeProjectId: s.activeProjectId,
    })))

    const {
        plan, decompose, review,
        generatePlan, generateDecompose, generateReview,
        clearMode,
    } = useAIFeatures()

    const [decomposeInputOpen, setDecomposeInputOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('plan') // 'plan' | 'decompose' | 'review'

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleGeneratePlan = useCallback(() => {
        if (!activeProjectId) return
        const payload = buildPlanPayload(tasks, activeProjectId)
        generatePlan(payload)
    }, [tasks, activeProjectId, generatePlan])

    const handleGenerateReview = useCallback(() => {
        if (!activeProjectId) return
        const payload = buildWeeklyReviewPayload(tasks, activeProjectId)
        generateReview(payload)
    }, [tasks, activeProjectId, generateReview])

    const handleDecomposeSubmit = useCallback((payload) => {
        // Close input immediately so user sees the loading skeleton right away
        setDecomposeInputOpen(false)
        generateDecompose(payload)
    }, [generateDecompose])

    // ── Runtime analysis of current tab state ─────────────────────────────────

    const activeState = useMemo(() => {
        if (activeTab === 'plan') return plan
        if (activeTab === 'decompose') return decompose
        if (activeTab === 'review') return review
        return plan
    }, [activeTab, plan, decompose, review])

    const hasData = !!activeState.data

    // ── Tab config ─────────────────────────────────────────────────────────────

    const TABS = [
        { id: 'plan', label: 'Daily Plan', icon: Calendar, color: 'bg-blue-500' },
        { id: 'decompose', label: 'Decompose', icon: ListTodo, color: 'bg-orange-500' },
        { id: 'review', label: 'Weekly', icon: BookOpen, color: 'bg-emerald-600' },
    ]

    const currentTab = TABS.find(t => t.id === activeTab)

    return (
        <div className="space-y-3">
            {/* Tab strip */}
            <div className="flex bg-muted/50 rounded-xl p-1 gap-0.5">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                            activeTab === tab.id
                                ? 'bg-card text-foreground shadow-sm border border-border'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Panel content */}
            {activeTab === 'plan' && (
                <PlanPanel
                    state={plan}
                    onGenerate={handleGeneratePlan}
                    onClear={() => clearMode('plan')}
                />
            )}
            {activeTab === 'decompose' && (
                <DecomposePanel
                    state={decompose}
                    inputOpen={decomposeInputOpen}
                    onOpenInput={() => setDecomposeInputOpen(true)}
                    onCancelInput={() => setDecomposeInputOpen(false)}
                    onSubmitInput={handleDecomposeSubmit}
                    onClear={() => { clearMode('decompose'); setDecomposeInputOpen(false) }}
                />
            )}
            {activeTab === 'review' && (
                <ReviewPanel
                    state={review}
                    onGenerate={handleGenerateReview}
                    onClear={() => clearMode('review')}
                />
            )}
        </div>
    )
}

// ── Plan Panel ────────────────────────────────────────────────────────────────

function PlanPanel({ state, onGenerate, onClear }) {
    const { data, isLoading, error, isEmpty } = state

    return (
        <FeatureCard
            icon={Calendar}
            iconGradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            title="Daily Auto-Planning"
            badge="AI-powered execution plan"
            onClear={data || error || isEmpty ? onClear : undefined}
            actionSlot={
                (data || error || isEmpty) && !isLoading ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={onGenerate}
                        title="Regenerate plan"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                ) : null
            }
        >
            {isLoading && <PlanSkeleton />}
            {!isLoading && error && <ErrorState message={error} onRetry={onGenerate} />}
            {!isLoading && isEmpty && <EmptyState />}
            {!isLoading && !error && !isEmpty && data && <DailyPlanResult data={data} />}
            {!isLoading && !error && !isEmpty && !data && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <div className="flex items-center justify-center">
                        <EnergyCubeIcon size={48} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Plan your day with AI</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            AI analyzes your task backlog and generates a realistic execution plan prioritized by urgency and deadline.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={onGenerate}
                        className="gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <EnergyCubeIcon size={20} className="mr-1" />
                        Generate Daily Plan
                    </Button>
                </div>
            )}
        </FeatureCard>
    )
}

// ── Decompose Panel ───────────────────────────────────────────────────────────

function DecomposePanel({ state, inputOpen, onOpenInput, onCancelInput, onSubmitInput, onClear }) {
    const { data, isLoading, error, isEmpty } = state

    return (
        <FeatureCard
            icon={ListTodo}
            iconGradient="bg-gradient-to-br from-orange-500 to-amber-600"
            title="Smart Task Decomposition"
            badge="Break any goal into steps"
            onClear={data || error || isEmpty ? onClear : undefined}
            actionSlot={
                data && !isLoading ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={onOpenInput}
                        title="Decompose another task"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                ) : null
            }
        >
            {isLoading && <DecomposeSkeleton />}
            {!isLoading && error && <ErrorState message={error} onRetry={onOpenInput} />}
            {!isLoading && isEmpty && <EmptyState message="Couldn't decompose this task. Try a more descriptive task title." />}
            {!isLoading && !error && !isEmpty && data && <DecomposeResult data={data} />}
            {!isLoading && !error && !isEmpty && !data && !inputOpen && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <div className="flex items-center justify-center">
                        <EnergyCubeIcon size={48} className="text-orange-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Decompose any task</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Paste a vague or complex task. AI breaks it into 4–8 concrete, sequential subtasks with action verbs.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={onOpenInput}
                        className="gap-1.5 h-9 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        <EnergyCubeIcon size={20} className="mr-1" />
                        Decompose a Task
                    </Button>
                </div>
            )}
            {!isLoading && inputOpen && !data && (
                <DecomposeInput
                    onSubmit={onSubmitInput}
                    onCancel={onCancelInput}
                    isLoading={isLoading}
                />
            )}
        </FeatureCard>
    )
}

// ── Review Panel ──────────────────────────────────────────────────────────────

function ReviewPanel({ state, onGenerate, onClear }) {
    const { data, isLoading, error, isEmpty } = state

    return (
        <FeatureCard
            icon={BookOpen}
            iconGradient="bg-gradient-to-br from-emerald-500 to-teal-700"
            title="Weekly Review"
            badge="Performance analysis"
            onClear={data || error || isEmpty ? onClear : undefined}
            actionSlot={
                (data || error || isEmpty) && !isLoading ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={onGenerate}
                        title="Regenerate review"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                ) : null
            }
        >
            {isLoading && <ReviewSkeleton />}
            {!isLoading && error && <ErrorState message={error} onRetry={onGenerate} />}
            {!isLoading && isEmpty && <EmptyState message="Not enough weekly data for a review. Complete some tasks first." />}
            {!isLoading && !error && !isEmpty && data && <WeeklyReviewResult data={data} />}
            {!isLoading && !error && !isEmpty && !data && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <div className="flex items-center justify-center">
                        <EnergyCubeIcon size={48} className="text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Get your weekly review</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            AI analyzes this week vs last week — highlights wins, spots patterns, and suggests improvements.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={onGenerate}
                        className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <EnergyCubeIcon size={20} className="mr-1" />
                        Generate Review
                    </Button>
                </div>
            )}
        </FeatureCard>
    )
}
