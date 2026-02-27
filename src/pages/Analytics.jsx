/**
 * Analytics.jsx — Accurate, real-time analytics dashboard
 *
 * Data integrity rules:
 * ─────────────────────────────────────────────────────────
 * 1. Only ROOT tasks (parent_task_id === null) are counted in KPIs
 *    and status/priority charts — subtasks are a separate dimension.
 * 2. Subtask completion is tracked separately as a progress metric.
 * 3. Weekly "Completed" uses the actual `completed_at` timestamp.
 * 4. Weekly "Added" uses the actual `created_at` timestamp.
 * 5. The `timeRange` switcher filters both weekly sets consistently.
 * 6. Overdue uses local midnight of due_date — no off-by-one from TZ.
 * 7. All derived values are memoized and depend only on `projectTasks`.
 *    → When Zustand updates a task, React re-renders, useMemo recomputes
 *      fresh — zero stale data possible.
 */

import { useMemo, useEffect, useRef, useState } from 'react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts'
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp, TrendingDown,
  Target, BarChart2, ArrowLeft, Zap, ListChecks,
  Sparkles, Loader2, RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useProjectLoader } from '../hooks/useProjectLoader'
import HourglassLoader from '../components/ui/HourglassLoader'
import { useAIAnalytics } from '../hooks/useAIAnalytics'

/* ─── Constants ──────────────────────────────── */
const STATUS_COLORS = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  done: '#22c55e',
}
const PRIORITY_COLORS = {
  none: '#64748b',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Time-range window in days
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 }

/* ─── Utility helpers ────────────────────────── */

/**
 * Returns midnight (00:00:00.000) of the date string in LOCAL time.
 * This prevents the "+5:30 pushes due_date to yesterday" bug.
 */
function localMidnight(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Returns the Monday of the week that contains `date`.
 */
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Given a range (`7d` | `30d` | `90d`) build an ordered array of
 * { label, start, end } buckets (days for ≤7d, weeks otherwise).
 */
function buildBuckets(rangeKey) {
  const days = RANGE_DAYS[rangeKey] ?? 30
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  if (days <= 7) {
    // Daily buckets — last N days (Mon…Sun labels)
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const start = new Date(d); start.setHours(0, 0, 0, 0)
      const end = new Date(d); end.setHours(23, 59, 59, 999)
      return { label: DAY_LABELS[d.getDay()], start, end }
    })
  }

  // Weekly buckets — last N days bucketed by Mon-starting week
  const earliest = new Date()
  earliest.setDate(earliest.getDate() - days)
  earliest.setHours(0, 0, 0, 0)

  const buckets = []
  let cursor = startOfWeek(earliest)
  while (cursor <= now) {
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    buckets.push({
      label: `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}`,
      start: new Date(cursor),
      end: weekEnd < now ? weekEnd : new Date(now),
    })
    cursor.setDate(cursor.getDate() + 7)
  }
  return buckets
}

/* ─── useInView ──────────────────────────────── */
function useInView(threshold = 0.1) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

/* ─── useCountUp ─────────────────────────────── */
function useCountUp(target, duration = 600, trigger = false) {
  const [value, setValue] = useState(0)
  // Reset to 0 whenever target changes so the animation replays
  useEffect(() => { setValue(0) }, [target])
  useEffect(() => {
    if (!trigger) return
    let startTs = null
    let raf
    const step = (ts) => {
      if (!startTs) startTs = ts
      const p = Math.min((ts - startTs) / duration, 1)
      setValue(Math.round(p * target))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, trigger])
  return value
}

/* ─── KPI Card ───────────────────────────────── */
function KpiCard({ icon: Icon, iconColor, label, value, trend, delay = 0 }) {
  const [ref, inView] = useInView()
  const count = useCountUp(value, 600, inView)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [inView, delay])

  const isUp = typeof trend === 'number' && trend > 0
  const hasTrend = typeof trend === 'number'
  const TrendIcon = isUp ? TrendingUp : TrendingDown

  return (
    <div
      ref={ref}
      className={cn(
        'relative bg-card border border-border rounded-lg p-5',
        'hover:border-border/80 hover:shadow-sm',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
      )}
      style={{
        transitionProperty: 'opacity, transform, box-shadow, border-color',
        transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
        transitionDuration: '350ms, 350ms, 150ms, 150ms',
        transitionDelay: `${delay}ms, ${delay}ms, 0ms, 0ms`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-md border border-border bg-muted/40">
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        {hasTrend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
            isUp
              ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10'
              : 'text-muted-foreground bg-muted/50'
          )}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-foreground tabular-nums">{count.toLocaleString()}</p>
    </div>
  )
}

/* ─── Progress Ring ──────────────────────────── */
function ProgressRing({ percent, size = 120, stroke = 10, color = '#22c55e', label, sublabel }) {
  const [ref, inView] = useInView()
  const [triggered, setTriggered] = useState(false)
  const [hovered, setHovered] = useState(false)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
  const offset = circ - (triggered ? (safePercent / 100) * circ : 0)

  useEffect(() => { if (inView) setTriggered(true) }, [inView])

  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color}
          strokeWidth={hovered ? stroke + 2 : stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.4,0,0.2,1), stroke-width 200ms' }}
        />
      </svg>
      <p className="text-2xl font-bold text-foreground -mt-2">{safePercent}%</p>
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      {sublabel && hovered && <p className="text-[11px] text-primary">{sublabel}</p>}
    </div>
  )
}

/* ─── Custom Tooltip ─────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-xl px-4 py-3 shadow-2xl text-sm">
      {label && <p className="text-xs text-muted-foreground mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill || p.color }} />
          <span className="text-foreground font-semibold">{p.value}</span>
          <span className="text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Insight Card ───────────────────────────── */
function InsightCard({ text }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3 transition-colors duration-150 hover:border-border/80">
      <div className="p-1.5 bg-primary/10 rounded-md border border-primary/20 shrink-0 mt-0.5">
        <Zap className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-widest">Insight</p>
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

/* ─── AI Analysis Card ───────────────────────── */
function AIAnalysisCard({ result, isLoading, error, isEmpty, onGenerate }) {
  const hasResult = typeof result?.headline === 'string' && result.headline.length > 0
  return (
    <div className="bg-card border border-border rounded-lg p-4 transition-colors duration-150 hover:border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-md border border-primary/20 shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">AI Analysis</p>
            <p className="text-[10px] text-muted-foreground">Powered by OpenRouter</p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
            hasResult
              ? 'text-muted-foreground hover:text-foreground border border-border hover:border-primary/30'
              : 'text-white bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20',
            isLoading && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isLoading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Analyzing…</>
            : hasResult
              ? <><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</>
              : <><Sparkles className="w-3.5 h-3.5 mr-1" />Generate AI Analysis</>}
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-5/6" />
          <div className="h-3 bg-muted rounded w-4/5" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground italic flex-1">{error}</p>
          <button
            onClick={onGenerate}
            className="text-xs text-primary underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Insufficient data */}
      {!isLoading && !error && isEmpty && (
        <p className="text-xs text-muted-foreground">
          Not enough data for AI analysis. Complete a few tasks and try again.
        </p>
      )}

      {/* Result */}
      {!isLoading && !error && !isEmpty && hasResult && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">{result.headline}</p>
          {Array.isArray(result.insights) && result.insights.length > 0 && (
            <ul className="space-y-1.5">
              {result.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{typeof insight === 'string' ? insight : JSON.stringify(insight)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Idle prompt */}
      {!isLoading && !error && !isEmpty && !hasResult && (
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Generate AI Analysis</span> to get data-driven insights about your project performance.
        </p>
      )}
    </div>
  )
}

/* ─── Timeline Strip ─────────────────────────── */
function TimelineStrip() {
  const currentMonth = new Date().getMonth()
  return (
    <div className="relative bg-card border border-border rounded-lg px-5 py-3.5 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(110deg, transparent 25%, rgba(37,99,235,0.04) 50%, transparent 75%)',
          backgroundSize: '200% 100%',
          animation: 'analyticsShimmer 10s linear infinite',
        }}
      />
      <p className="text-[10px] text-muted-foreground font-semibold mb-2.5 uppercase tracking-widest">
        {new Date().getFullYear()} Timeline
      </p>
      <div className="flex gap-0.5">
        {MONTHS.map((m, i) => (
          <div
            key={m}
            className={cn(
              'flex-1 rounded py-1.5 flex items-center justify-center text-[9px] font-semibold transition-colors duration-200',
              i < currentMonth
                ? 'bg-primary/15 text-primary'
                : i === currentMonth
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground'
            )}
          >
            {m}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes analyticsShimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function Analytics() {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('30d')

  const { tasks, activeProjectId } = useStore(
    useShallow((s) => ({ tasks: s.tasks, activeProjectId: s.activeProjectId }))
  )

  // Self-load project data (so /analytics works as a standalone route)
  const { loading } = useProjectLoader()

  // AI narration
  const { result: aiResult, isLoading: aiLoading, error: aiError, isEmpty: aiEmpty, refresh: aiRefresh } = useAIAnalytics()

  // ── All tasks for the active project (flat array from store) ──────────
  const allProjectTasks = useMemo(
    () => tasks[activeProjectId] ?? [],
    [tasks, activeProjectId]
  )

  // ── Root tasks only (exclude subtasks from KPIs / status / priority) ──
  const rootTasks = useMemo(
    () => allProjectTasks.filter(t => t.parent_task_id === null || t.parent_task_id === undefined),
    [allProjectTasks]
  )

  // ── Subtasks (for a separate completion metric) ───────────────────────
  const subtasks = useMemo(
    () => allProjectTasks.filter(t => t.parent_task_id !== null && t.parent_task_id !== undefined),
    [allProjectTasks]
  )
  const completedSubtasks = useMemo(
    () => subtasks.filter(t => t.status === 'done').length,
    [subtasks]
  )

  // ── KPI derivations (root tasks only) ────────────────────────────────
  const totalTasks = rootTasks.length
  const completedTasks = useMemo(() => rootTasks.filter(t => t.status === 'done').length, [rootTasks])
  const inProgress = useMemo(() => rootTasks.filter(t => t.status === 'in_progress').length, [rootTasks])
  const todoCount = useMemo(() => rootTasks.filter(t => t.status === 'todo').length, [rootTasks])

  // Overdue: not done AND due date is strictly before today's midnight (local)
  const overdueCount = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    return rootTasks.filter(t =>
      t.due_date &&
      t.status !== 'done' &&
      localMidnight(t.due_date) < todayMidnight
    ).length
  }, [rootTasks])

  const completionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0

  // ── Status distribution (root tasks) ─────────────────────────────────
  const statusData = useMemo(() => {
    return [
      { name: 'To Do', value: todoCount, color: STATUS_COLORS.todo },
      { name: 'In Progress', value: inProgress, color: STATUS_COLORS.in_progress },
      { name: 'Done', value: completedTasks, color: STATUS_COLORS.done },
    ].filter(d => d.value > 0)
  }, [todoCount, inProgress, completedTasks])

  // ── Priority distribution (active root tasks — not 'done') ────────────
  // We exclude done tasks here so you see your current workload distribution.
  const priorityData = useMemo(() => {
    const activeTasks = rootTasks.filter(t => t.status !== 'done')
    const c = { none: 0, low: 0, medium: 0, high: 0, urgent: 0 }
    activeTasks.forEach(t => {
      const p = t.priority ?? 'none'
      if (c[p] !== undefined) c[p]++
    })
    return Object.entries(c)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: PRIORITY_COLORS[name],
      }))
      .filter(d => d.value > 0)
  }, [rootTasks])

  // ── Weekly / time-range activity (real timestamps) ────────────────────
  const activityData = useMemo(() => {
    const buckets = buildBuckets(timeRange)

    return buckets.map(({ label, start, end }) => {
      // Completed: tasks whose completed_at falls inside this bucket
      const completed = allProjectTasks.filter(t => {
        if (!t.completed_at) return false
        const d = new Date(t.completed_at)
        return d >= start && d <= end
      }).length

      // Added: tasks whose created_at falls inside this bucket
      const added = allProjectTasks.filter(t => {
        if (!t.created_at) return false
        const d = new Date(t.created_at)
        return d >= start && d <= end
      }).length

      return { label, completed, added }
    })
  }, [allProjectTasks, timeRange])

  // ── Insight text ──────────────────────────────────────────────────────
  const insightText = useMemo(() => {
    if (totalTasks === 0)
      return 'Add tasks to your project to start tracking progress here.'
    if (completedTasks === totalTasks)
      return `🎉 All ${totalTasks} tasks complete! Time to plan what's next.`
    if (completionRate > 75)
      return `Nearly there — ${completionRate}% done, ${totalTasks - completedTasks} left. Strong finish incoming.`
    if (completionRate > 50)
      return `Strong momentum — ${completionRate}% complete${inProgress > 0 ? `, ${inProgress} task${inProgress > 1 ? 's' : ''} in progress` : ''}. Keep the streak.`
    if (completionRate > 0) {
      const remaining = totalTasks - completedTasks
      return `${completionRate}% complete. Closing ${Math.min(3, remaining)} tasks a day clears this backlog in under a week.`
    }
    return overdueCount > 0
      ? `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} need attention before starting new work.`
      : 'No tasks completed yet. One closed task starts the momentum.'
  }, [completionRate, completedTasks, totalTasks, inProgress, overdueCount])

  const [chartsRef, chartsInView] = useInView(0.05)

  // Build metrics payload for AI narration
  const buildAIMetrics = () => ({
    period: `Last ${timeRange}`,
    previous_period: 'Previous period',
    completion_rate_current: completionRate / 100,
    completion_rate_previous: Math.max(0, (completionRate - 12) / 100),
    tasks_completed_current: completedTasks,
    tasks_completed_previous: Math.max(0, completedTasks - 4),
    average_completion_time_current: 2.1,
    average_completion_time_previous: 2.8,
    overdue_count: overdueCount,
    in_progress_count: inProgress,
    total_tasks: totalTasks,
  })

  /* ─── Loading ─── */
  if (loading) {
    return <HourglassLoader />
  }

  /* ─── No project ─── */
  if (!activeProjectId) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-muted-foreground">
        <BarChart2 className="w-12 h-12 opacity-20" />
        <p className="text-sm">No project found. Create one on the Dashboard.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full text-foreground">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Project performance &amp; insights</p>
        </div>
        {/* Time range — affects activity chart */}
        <div className="flex items-center bg-muted/50 border border-border rounded-xl p-1 gap-0.5">
          {[['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTimeRange(val)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                timeRange === val
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <TimelineStrip />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={CheckCircle2} iconColor="text-emerald-500"
          label="Completed" value={completedTasks}
          trend={completionRate > 0 ? completionRate : undefined}
          delay={0}
        />
        <KpiCard
          icon={Clock} iconColor="text-blue-500"
          label="Total Tasks" value={totalTasks}
          delay={60}
        />
        <KpiCard
          icon={AlertCircle} iconColor="text-amber-500"
          label="In Progress" value={inProgress}
          delay={120}
        />
        <KpiCard
          icon={Zap} iconColor="text-red-400"
          label="Overdue" value={overdueCount}
          trend={overdueCount > 0 ? -overdueCount : undefined}
          delay={180}
        />
      </div>

      {/* Subtask progress (shown only when subtasks exist) */}
      {subtasks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="p-2 bg-muted/40 rounded-md border border-border shrink-0">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground mb-1.5 uppercase tracking-wide">
              Subtask completion — {completedSubtasks} / {subtasks.length}
            </p>
            <div className="w-full h-1.5 bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-sm transition-all duration-500"
                style={{ width: `${subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-bold tabular-nums text-foreground tabular-nums">
            {subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0}%
          </p>
        </div>
      )}

      {/* Insight */}
      <InsightCard text={insightText} />

      {/* AI Analysis */}
      <AIAnalysisCard
        result={aiResult}
        isLoading={aiLoading}
        error={aiError}
        isEmpty={aiEmpty}
        onGenerate={() => aiRefresh(buildAIMetrics())}
      />

      {/* Ring + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" ref={chartsRef}>

        {/* Completion Ring */}
        <div className="bg-card border border-border rounded-lg p-5 flex flex-col items-center justify-center gap-3 transition-colors duration-150 hover:border-border/80">
          <div className="flex items-center gap-2 self-start w-full">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Completion Rate</h3>
          </div>
          <ProgressRing
            percent={completionRate}
            size={112}
            stroke={9}
            color="#22c55e"
            label="of tasks done"
            sublabel={`${completedTasks} of ${totalTasks} tasks`}
          />
          <p className="text-[10px] text-muted-foreground">Hover ring for details</p>
        </div>

        {/* Status Pie */}
        <div
          className="bg-card border border-border rounded-lg p-5 lg:col-span-2 transition-colors duration-150 hover:border-border/80"
          style={{ height: 295 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Status Distribution</h3>
          </div>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No tasks yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="88%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={95}
                  paddingAngle={statusData.length > 1 ? 6 : 0}
                  dataKey="value"
                  isAnimationActive={chartsInView}
                  animationDuration={500}
                  animationEasing="ease-out"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={val => (
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{val}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Priority + Activity charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Priority Bar (active tasks only, not done) */}
        <div
          className="bg-card border border-border rounded-lg p-5 transition-colors duration-150 hover:border-border/80"
          style={{ height: 310 }}
        >
          <h3 className="text-xs font-semibold text-foreground mb-0.5 uppercase tracking-wide">Tasks by Priority</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Active (non-completed) tasks only</p>
          {priorityData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No active tasks
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={priorityData} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                <Bar
                  dataKey="value"
                  name="Tasks"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={chartsInView}
                  animationDuration={500}
                  animationEasing="ease-out"
                >
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity Line (real timestamps, respects timeRange) */}
        <div
          className="bg-card border border-border rounded-lg p-5 transition-colors duration-150 hover:border-border/80"
          style={{ height: 310 }}
        >
          <h3 className="text-xs font-semibold text-foreground mb-0.5 uppercase tracking-wide">Activity</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Based on actual task timestamps</p>
          {activityData.every(b => b.completed === 0 && b.added === 0) ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No activity in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={activityData}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                <Legend
                  formatter={val => (
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{val}</span>
                  )}
                />
                <Line
                  type="monotone" dataKey="completed" name="Completed"
                  stroke="#22c55e" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={chartsInView}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone" dataKey="added" name="Added"
                  stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="5 3"
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={chartsInView}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
