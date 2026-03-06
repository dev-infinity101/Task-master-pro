/**
 * Roadmap.jsx â€” Year-Long Roadmap Visualization Page
 *
 * Accessible via:
 *   1. /roadmap route (directly navigated)
 *   2. Clicking the YearProgressBanner in Dashboard
 *   3. "Roadmap" item in the sidebar Views section
 *
 * Architecture:
 * - 12 compact "Month Pill" cards inside a scrolling canvas
 * - Canvas hijacked scroll (hidden native scrollbar + 3px custom scrollbar line)
 * - scroll-snap so the view always settles on exactly one card (scroll-snap-type: y mandatory)
 * - Sidebar clicking uses scrollIntoView({ block: 'center' })
 * - SVG straight-line segmented chain between each pill's bottom-anchor point
 * - Month Detail Modal opens on card click
 */

import {
    useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Edit3, ChevronLeft, ChevronRight,
    Calendar, Check, X, Palette, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useRoadmap } from '../hooks/useRoadmap'
import { cn } from '@/lib/utils'
import HourglassLoader from '../components/ui/HourglassLoader'
import TaskMasterLogo from '../components/ui/TaskMasterLogo'
import { useProjectLoader } from '../hooks/useProjectLoader'
import bgRoadmap from '../assets/bg-roadmap.jpg'

/* Constants  */
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
const WEEK_GOAL_KEYS = ['week_1_goal', 'week_2_goal', 'week_3_goal', 'week_4_goal']
const WEEK_DONE_KEYS = ['week_1_done', 'week_2_done', 'week_3_done', 'week_4_done']

const ACCENT_PRESETS = [
    '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#a855f7', '#f97316',
    '#ec4899', '#14b8a6', '#84cc16', '#8b5cf6',
]

/* â”€â”€â”€ Helper: get week date ranges for a month â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function getWeekRanges(year, month) { // month: 1â€“12
    const ranges = []
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const chunkSize = Math.floor(daysInMonth / 4)

    for (let w = 0; w < 4; w++) {
        const start = w * chunkSize + 1
        const end = w < 3 ? (w + 1) * chunkSize : daysInMonth
        const fmtStart = new Date(year, month - 1, start)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const fmtEnd = new Date(year, month - 1, end)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        ranges.push(`${fmtStart} â€“ ${fmtEnd}`)
    }
    return ranges
}

/* â”€â”€â”€ MonthCard (Semi-Rounded) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MonthCard({ fwdRef, dotRef, monthNum, year, data, isActive, onClick }) {
    const accentColor = data?.color_accent ?? '#6366f1'
    const superGoal = data?.super_goal || ''
    const weekGoals = WEEK_GOAL_KEYS.map((k) => data?.[k] ?? '')
    const hasGoals = Boolean(superGoal.trim() || weekGoals.some((g) => g.trim()))

    return (
        <div
            ref={fwdRef}
            className={cn(
                'flex-shrink-0 cursor-pointer relative flex flex-col justify-center px-8',
                // Size & Semi-Rounded Shape
                'w-[420px] h-[86px] rounded-2xl',
                'transition-all duration-300 border-[2px]',
                'group overflow-hidden',
                // Base border config: solid black light mode, white dark mode
                'border-black dark:border-white bg-background dark:bg-card hover:shadow-xl',
                // Active visual logic on top
                isActive && 'border-[#22c55e] dark:border-[#22c55e] ring-2 ring-[#22c55e]/30'
            )}
            onClick={onClick}
        >
            <div className="flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3.5">
                    {/* Left Dot inside Pill */}
                    <div
                        ref={dotRef}
                        className={cn(
                            "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors",
                            !hasGoals && !isActive && "bg-muted-foreground/30"
                        )}
                        style={hasGoals || isActive ? { backgroundColor: isActive ? '#22c55e' : accentColor } : {}}
                    />
                    <h2 className={cn(
                        "text-[15px] font-black tracking-widest uppercase mt-[0.5px]",
                        isActive || hasGoals ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                        {MONTH_NAMES[monthNum - 1]} {year}
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] font-bold tracking-widest leading-none">
                            NOW
                        </span>
                    )}
                    <Edit3 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* Super Goal with Neon Highlight Animation */}
            {superGoal.trim() && (
                <div className="mt-1 pl-6 overflow-hidden pointer-events-none">
                    <p className="text-[14.5px] text-[#3b82f6] dark:text-blue-400 font-extrabold italic truncate animate-neon-pulse">
                        {'\u2726'} {superGoal}
                    </p>
                </div>
            )}
        </div>
    )
}

/* SVG Connector (Gradient Flow String) */
function SVGConnector({ dotRefs, scrollContainerRef }) {
    const [path, setPath] = useState('')
    const [dots, setDots] = useState([])
    const [pathLength, setPathLength] = useState(0)
    const [scrollPct, setScrollPct] = useState(0)
    const [svgHeight, setSvgHeight] = useState(0)
    const svgRef = useRef(null)
    const pathRef = useRef(null)

    // Read anchor positions relative to the canvas container (including scrollTop offset)
    const readPositions = useCallback(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const containerRect = container.getBoundingClientRect()
        const scrollTop = container.scrollTop

        let d = ''
        const newDots = []

        dotRefs.forEach((ref, i) => {
            const el = ref.current
            if (!el) return
            const elRect = el.getBoundingClientRect()

            // X relative to container left; Y relative to container top + scrollTop correction
            const x = elRect.left - containerRect.left + elRect.width / 2
            const y = elRect.top - containerRect.top + scrollTop + elRect.height / 2
            newDots.push({ x, y, i })

            if (i === 0) {
                d = `M ${x},${y}`
            } else {
                const prev = newDots[i - 1]
                d += ` C ${prev.x + 80},${prev.y} ${x - 80},${y} ${x},${y}`
            }
        })

        setPath(d)
        setDots(newDots)
        // SVG must match full scroll height so path covers all cards
        setSvgHeight(container.scrollHeight)

        requestAnimationFrame(() => {
            if (pathRef.current) setPathLength(pathRef.current.getTotalLength())
        })
    }, [dotRefs, scrollContainerRef])

    // Initial read via useLayoutEffect with 100ms delay (cards must be painted)
    useLayoutEffect(() => {
        const timer = setTimeout(readPositions, 100)
        return () => clearTimeout(timer)
    }, [readPositions])

    // ResizeObserver recalculates when canvas resizes
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return
        const observer = new ResizeObserver(readPositions)
        observer.observe(container)
        return () => observer.disconnect()
    }, [readPositions, scrollContainerRef])

    // Scroll listener on the canvas container (not window)
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        let rafId = null
        const onScroll = () => {
            cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = container
                const maxScroll = scrollHeight - clientHeight
                setScrollPct(maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0)
            })
        }

        container.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            container.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafId)
        }
    }, [scrollContainerRef])

    if (!path) return null

    // Stroke reveal: fully hidden at top, fully drawn at bottom
    const dashoffset = pathLength > 0 ? pathLength * (1 - scrollPct / 100) : 0

    return (
        <svg
            ref={svgRef}
            className="absolute inset-x-0 top-0 w-full pointer-events-none"
            style={{ height: svgHeight || '100%', zIndex: 0 }}
        >
            <defs>
                {/* Animated flowing gradient */}
                <linearGradient id="rm-string-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5ae6f3" stopOpacity="0.4" />
                    <stop offset="35%" stopColor="#16e2f5" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#73f0fc" stopOpacity="1.0" />
                    <stop offset="65%" stopColor="#05ffea" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#07ffd6" stopOpacity="0.4" />
                    <animateTransform
                        attributeName="gradientTransform"
                        type="translate"
                        values="0 -0.6; 0 0.6; 0 -0.6"
                        dur="4s"
                        repeatCount="indefinite"
                    />
                </linearGradient>

                {/* Glow filters */}
                <filter id="rm-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="rm-glow-sm" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>

                <style>{`
                  @keyframes neonPulse {
                    0%, 100% { opacity: 0.9; }
                    50%       { opacity: 1; }
                  }
                  .animate-neon-pulse { animation: neonPulse 2s ease-in-out infinite; }

                  @keyframes travelPulse {
                    from { stroke-dashoffset: ${pathLength}; }
                    to   { stroke-dashoffset: 0; }
                  }
                  @keyframes dotPulse {
                    0%, 100% { r: 5;  opacity: 1; }
                    50%       { r: 7;  opacity: 0.5; }
                  }
                `}</style>
            </defs>

            {/* Shadow glow base */}
            <path
                d={path} fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                style={{ stroke: '#16e2f5', opacity: 0.5, strokeDasharray: pathLength, strokeDashoffset: dashoffset }}
            />

            {/* Main gradient path (scroll-revealed) */}
            <path
                ref={pathRef}
                d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{
                    stroke: 'url(#rm-string-grad)',
                    filter: 'drop-shadow(0 0 5px #16e2f5)',
                    strokeDasharray: pathLength,
                    strokeDashoffset: dashoffset,
                }}
            />

            {/* Traveling bead of light */}
            {pathLength > 0 && path && (
                <circle r="4" fill="white" filter="url(#rm-glow)" style={{ opacity: 0.85 }}>
                    <animateMotion dur="3.5s" repeatCount="indefinite" path={path} />
                </circle>
            )}

            {/* Anchor dots with ripple rings */}
            {dots.map(dot => (
                <g key={dot.i}>
                    <circle cx={dot.x} cy={dot.y} r="5" fill="none" stroke="#16e2f5" strokeWidth="1.5">
                        <animate attributeName="r" values="5;13" dur="2s" begin={`${dot.i * 0.15}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0" dur="2s" begin={`${dot.i * 0.15}s`} repeatCount="indefinite" />
                    </circle>
                    <circle cx={dot.x} cy={dot.y} r="5" fill="#16e2f5" filter="url(#rm-glow-sm)" />
                </g>
            ))}
        </svg>
    )
}

/* â”€â”€â”€ Month Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MonthDetailModal({ monthNum, year, data, tasks, onClose, onSave, accentColor }) {
    const weekRanges = useMemo(() => getWeekRanges(year, monthNum), [year, monthNum])

    // Initial snapshot for dirty-tracking
    const initialDataRef = useRef({
        super_goal: data?.super_goal ?? '',
        week_1_goal: data?.week_1_goal ?? '',
        week_2_goal: data?.week_2_goal ?? '',
        week_3_goal: data?.week_3_goal ?? '',
        week_4_goal: data?.week_4_goal ?? '',
        week_1_done: data?.week_1_done ?? false,
        week_2_done: data?.week_2_done ?? false,
        week_3_done: data?.week_3_done ?? false,
        week_4_done: data?.week_4_done ?? false,
        color_accent: data?.color_accent ?? '#6366f1',
        notes: data?.notes ?? '',
    })

    const [form, setForm] = useState({ ...initialDataRef.current })
    const [status, setStatus] = useState('idle') // idle | saving | success | error
    const [showPicker, setShowPicker] = useState(false)
    const [cancelConfirm, setCancelConfirm] = useState(false)

    // Check dirtiness
    const isDirty = useMemo(() => {
        return JSON.stringify(form) !== JSON.stringify(initialDataRef.current)
    }, [form])

    const handleChange = (key, val) => {
        setForm(prev => ({ ...prev, [key]: val }))
        setCancelConfirm(false)
        setStatus('idle')
    }

    const handleSave = async () => {
        if (status === 'saving' || !isDirty) return
        setStatus('saving')
        try {
            await onSave(monthNum, form)
            setStatus('success')
            initialDataRef.current = { ...form }
            setTimeout(() => {
                onClose()
            }, 1000)
        } catch (err) {
            setStatus('error')
            toast.error("Failed to save. Please try again.")
        }
    }

    const handleCancel = () => {
        if (isDirty) {
            if (!cancelConfirm) {
                setCancelConfirm(true)
                return
            }
            // Discard changes and close
            setForm({ ...initialDataRef.current })
        }
        onClose()
    }

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                handleCancel()
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSave()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleCancel, handleSave])


    return (
        <>
            <div
                className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                onClick={handleCancel}
            />
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className={cn(
                        'pointer-events-auto w-full max-w-2xl max-h-[85vh] flex flex-col',
                        'rounded-3xl bg-card text-foreground',
                        'border border-border shadow-2xl overflow-hidden',
                    )}
                    style={{ borderLeftColor: form.color_accent, borderLeftWidth: 3 }}
                >
                    {/* â”€â”€â”€â”€ Header (Fixed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0 bg-card z-10">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-foreground tracking-tight">
                                {MONTH_NAMES[monthNum - 1]} {year}
                            </h2>
                            {isDirty && (
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Unsaved changes" />
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Accent color picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowPicker(!showPicker)}
                                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                                    style={{ backgroundColor: form.color_accent + '20' }}
                                >
                                    <Palette className="w-4 h-4" style={{ color: form.color_accent }} />
                                </button>
                                {showPicker && (
                                    <div className="absolute right-0 top-10 z-[150] bg-popover border border-border rounded-xl p-3 grid grid-cols-6 gap-2 w-52 shadow-2xl">
                                        {ACCENT_PRESETS.map((c) => (
                                            <button
                                                key={c}
                                                className={cn(
                                                    'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                                                    form.color_accent === c ? 'border-primary scale-110' : 'border-transparent'
                                                )}
                                                style={{ backgroundColor: c }}
                                                onClick={() => { handleChange('color_accent', c); setShowPicker(false) }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleCancel}
                                className="w-8 h-8 rounded-lg bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* â”€â”€â”€â”€ Body (Scrollable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                        {/* Super Goal */}
                        <section>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                                style={{ color: form.color_accent }}>
                                âœ¦ Super Goal
                            </label>
                            <p className="text-xs text-muted-foreground mb-2">The one thing that defines this month's success.</p>
                            <textarea
                                value={form.super_goal}
                                onChange={(e) => handleChange('super_goal', e.target.value)}
                                maxLength={120}
                                rows={2}
                                placeholder="e.g. Ship the MVP and get first 10 users"
                                className={cn(
                                    'w-full bg-muted/50 border border-border rounded-xl px-4 py-3',
                                    'text-sm text-foreground placeholder:text-muted-foreground',
                                    'focus:outline-none focus:ring-2 resize-none transition-all',
                                )}
                                style={{ focusRingColor: form.color_accent }}
                            />
                            <p className="text-[11px] text-muted-foreground text-right mt-1">
                                {form.super_goal.length}/120
                            </p>
                        </section>

                        {/* Weekly Goals */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Weekly Goals
                            </h3>
                            <div className="space-y-3">
                                {WEEK_LABELS.map((label, i) => {
                                    const goalKey = WEEK_GOAL_KEYS[i]
                                    const doneKey = WEEK_DONE_KEYS[i]
                                    return (
                                        <div key={i} className="flex items-center gap-3 group">
                                            {/* Done checkbox */}
                                            <button
                                                onClick={() => handleChange(doneKey, !form[doneKey])}
                                                className={cn(
                                                    'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                                    form[doneKey] ? 'border-transparent' : 'border-border hover:border-primary/50'
                                                )}
                                                style={form[doneKey] ? { backgroundColor: form.color_accent } : {}}
                                            >
                                                {form[doneKey] && <Check className="w-3 h-3 text-white" />}
                                            </button>

                                            {/* Date range label */}
                                            <span className="text-xs text-muted-foreground shrink-0 w-28">
                                                {weekRanges[i]}
                                            </span>

                                            {/* Goal input */}
                                            <input
                                                type="text"
                                                value={form[goalKey]}
                                                onChange={(e) => handleChange(goalKey, e.target.value)}
                                                maxLength={80}
                                                placeholder={`${label} goalâ€¦`}
                                                className={cn(
                                                    'flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2',
                                                    'text-sm text-foreground placeholder:text-muted-foreground',
                                                    'focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all',
                                                    form[doneKey] && 'text-muted-foreground line-through'
                                                )}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                        {/* Notes */}
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Notes
                            </h3>
                            <textarea
                                value={form.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={4}
                                placeholder="Brain dump, planning notes, contextâ€¦"
                                className={cn(
                                    'w-full bg-muted/50 border border-border rounded-xl px-4 py-3',
                                    'text-sm text-foreground placeholder:text-muted-foreground',
                                    'focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none transition-all'
                                )}
                            />
                        </section>
                    </div>

                    {/* â”€â”€â”€â”€ Footer (Fixed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="flex items-center justify-between p-4 border-t border-border shrink-0 bg-card z-10">
                        <button
                            onClick={handleCancel}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                cancelConfirm
                                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            {cancelConfirm ? "Discard changes?" : "Cancel"}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={status === 'saving' || !isDirty}
                            className={cn(
                                "flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 min-w-[130px]",
                                isDirty && status !== 'saving' && status !== 'success'
                                    ? "text-primary-foreground opacity-100 shadow-md transform hover:scale-[1.02]"
                                    : "text-primary-foreground opacity-60",
                                status === 'success' && "bg-green-500 !opacity-100 text-white"
                            )}
                            style={(status !== 'success' && isDirty) ? { backgroundColor: form.color_accent } : (!isDirty && status !== 'success' ? { backgroundColor: form.color_accent } : {})}
                        >
                            {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {status === 'success' && <Check className="w-4 h-4" />}

                            {status === 'saving' ? 'Saving...' :
                                status === 'success' ? 'Saved' :
                                    'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

/* â”€â”€â”€ Main Roadmap Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function Roadmap() {
    const navigate = useNavigate()
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1 // 1-indexed

    const { loading: projectsLoading } = useProjectLoader()

    const {
        activeProjectId, tasks, getActiveProject, projects, setActiveProject
    } = useStore(useShallow((s) => ({
        activeProjectId: s.activeProjectId,
        tasks: s.tasks,
        getActiveProject: s.getActiveProject,
        projects: s.projects,
        setActiveProject: s.setActiveProject,
    })))

    const activeProject = getActiveProject()
    const projectTasks = useMemo(() => Object.values(tasks).flat(), [tasks])

    const [year, setYear] = useState(currentYear)
    const [activeIndex, setActiveIndex] = useState(currentMonth - 1) // 0-based
    const [modalMonth, setModalMonth] = useState(null) // 1-based month number
    const [scrollPct, setScrollPct] = useState(0)

    const { months, upsertMonth } = useRoadmap(activeProjectId, year)

    // Build a lookup: month â†’ data row
    const monthData = useMemo(() => {
        const m = {}
        months.forEach((row) => { m[row.month] = row })
        return m
    }, [months])

    // Specific Refs for card navigation and line anchoring
    const cardRefs = useMemo(() => Array.from({ length: 12 }, () => ({ current: null })), [])
    const dotRefs = useMemo(() => Array.from({ length: 12 }, () => ({ current: null })), [])
    const scrollContainerRef = useRef(null)
    const rafRef = useRef(null)

    /* â”€â”€ Scroll handler (Custom Progress Bar + Snap Detection) â”€â”€â”€ */
    const handleScroll = useCallback(() => {
        if (rafRef.current) return
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            const el = scrollContainerRef.current
            if (!el) return

            const scrollTop = el.scrollTop
            const maxScroll = el.scrollHeight - el.clientHeight

            // Percentage for the custom vertical line
            const pct = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0
            setScrollPct(pct)

            // Map scroll strictly to 12 card points to update active state/active label
            const idx = Math.round(maxScroll > 0 ? (scrollTop / maxScroll) * 11 : 0)
            setActiveIndex(Math.max(0, Math.min(11, idx)))
        })
    }, [])

    useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return
        el.addEventListener('scroll', handleScroll, { passive: true })
        // Initial set based on DOM position
        handleScroll()
        return () => el.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    // Scroll to current month on initial mount
    useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return
        // Use scrollIntoView to the correct card for exact centering
        const targetRef = cardRefs[currentMonth - 1]?.current
        setTimeout(() => {
            if (targetRef) targetRef.scrollIntoView({ block: 'center', behavior: 'instant' })
        }, 50)
    }, [currentMonth, cardRefs])

    /* â”€â”€ Navigate between months using sidebar or nav arrows â”€â”€â”€ */
    const scrollToIndex = useCallback((idx) => {
        const clamped = Math.max(0, Math.min(11, idx))
        const el = cardRefs[clamped]?.current
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [cardRefs])

    if (projectsLoading && projects.length === 0) return <HourglassLoader />

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground relative z-0">
            {/* â”€â”€ Background Image Placeholder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div
                className="absolute inset-0 z-[0] pointer-events-none opacity-[2] dark:opacity-40 transition-opacity"
                style={{
                    backgroundImage: `url(${bgRoadmap})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                }}
            />

            {/* â”€â”€ Left sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <aside className="w-[220px] shrink-0 flex flex-col border-r border-border bg-card/80 backdrop-blur-xl z-20">
                {/* Logo */}
                <div className="flex items-center px-5 h-16 border-b border-border">
                    <TaskMasterLogo size={28} variant="sidebar" />
                </div>

                {/* Back + Year nav */}
                <div className="p-4 border-b border-border">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </button>

                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Year</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setYear(y => y - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="flex-1 text-center text-lg font-black">{year}</span>
                        <button onClick={() => setYear(y => y + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Month list */}
                <div className="flex-1 overflow-y-auto py-3 px-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">Months</p>
                    {MONTH_NAMES.map((name, i) => {
                        const monthNum = i + 1
                        const data = monthData[monthNum]
                        const hasGoal = Boolean(data?.super_goal || WEEK_GOAL_KEYS.some((k) => data?.[k]))
                        const isNow = monthNum === currentMonth && year === currentYear
                        const isActive = i === activeIndex

                        return (
                            <button
                                key={i}
                                onClick={() => scrollToIndex(i)}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left mb-0.5',
                                    isActive
                                        ? 'bg-primary/10 text-primary font-bold'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                                )}
                            >
                                <span className="flex-1 truncate">{name}</span>
                                {isNow && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                                        NOW
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Project selector */}
                {projects.length > 1 && (
                    <div className="p-4 border-t border-border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Project</p>
                        <select
                            value={activeProjectId ?? ''}
                            onChange={(e) => setActiveProject(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </aside>

            {/* â”€â”€ Main area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="flex-1 flex flex-col overflow-hidden z-10">

                {/* Top nav bar */}
                <header className="flex h-16 items-center justify-between px-8 border-b border-border bg-card/80 backdrop-blur-xl shrink-0 z-20">
                    <div>
                        <h1 className="text-xl font-black tracking-tight">
                            {year} Roadmap
                        </h1>
                        {activeProject && (
                            <p className="text-xs text-muted-foreground mt-0.5">{activeProject.name}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => scrollToIndex(currentMonth - 1)}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-muted hover:bg-accent text-foreground transition-colors"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Today
                        </button>
                        <div className="text-xs text-muted-foreground w-28 text-right font-medium">
                            {MONTH_NAMES[activeIndex]} {year}
                        </div>
                    </div>
                </header>

                {/* Scroll Wrapper Container */}
                <div className="flex-1 relative overflow-hidden">

                    {/* â”€â”€â”€â”€ Custom Vertical Scrollbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-muted/20 z-[60] pointer-events-none">
                        <div
                            className="w-full bg-primary origin-top transition-all duration-100 ease-linear"
                            style={{ height: `${scrollPct}%` }}
                        />
                    </div>

                    {/* â”€â”€â”€â”€ Scroll Hijacked Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div
                        ref={scrollContainerRef}
                        className={cn(
                            "absolute inset-0 overflow-y-auto w-full h-full",
                            // Cross-browser hide native scrollbar
                            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                        )}
                        style={{
                            scrollSnapType: 'y mandatory',
                            scrollBehavior: 'smooth',
                        }}
                    >
                        {/* 
                            This relative container scales to the total scrollHeight needed to fit
                            padding and cards. The SVG connects cards across this exact coordinate system.
                        */}
                        <div className="relative flex flex-col items-center w-full pb-[35vh] pt-[35vh]">

                            <SVGConnector
                                dotRefs={dotRefs}
                                scrollContainerRef={scrollContainerRef}
                            />

                            {Array.from({ length: 12 }, (_, i) => {
                                const monthNum = i + 1
                                const data = monthData[monthNum]
                                const isActive = monthNum === currentMonth && year === currentYear

                                // Zigzag staggered layout: odd/even shifting left & right
                                const isLeft = i % 2 === 0
                                const shiftX = isLeft ? -90 : 90

                                return (
                                    <div
                                        key={i}
                                        className="h-[30vh] w-full flex items-center justify-center relative z-10"
                                        style={{ scrollSnapAlign: 'center' }}
                                    >
                                        <div style={{ transform: `translateX(${shiftX}px)` }}>
                                            <MonthCard
                                                fwdRef={(el) => { if (cardRefs[i]) cardRefs[i].current = el }}
                                                dotRef={(el) => { if (dotRefs[i]) dotRefs[i].current = el }}
                                                monthNum={monthNum}
                                                year={year}
                                                data={data}
                                                isActive={isActive}
                                                onClick={() => setModalMonth(monthNum)}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Nav arrows overlay mapped to UI right */}
                    <div className="absolute bottom-6 right-8 flex flex-col gap-2 z-50">
                        <button
                            onClick={() => scrollToIndex(activeIndex - 1)}
                            disabled={activeIndex === 0}
                            className="w-10 h-10 rounded-full bg-card border border-border hover:bg-accent text-foreground flex items-center justify-center transition-all disabled:opacity-30 shadow-md"
                        >
                            <ChevronLeft className="w-5 h-5 -rotate-90" />
                        </button>
                        <button
                            onClick={() => scrollToIndex(activeIndex + 1)}
                            disabled={activeIndex === 11}
                            className="w-10 h-10 rounded-full bg-card border border-border hover:bg-accent text-foreground flex items-center justify-center transition-all disabled:opacity-30 shadow-md"
                        >
                            <ChevronRight className="w-5 h-5 rotate-90" />
                        </button>
                    </div>
                </div>

            </div>

            {/* â”€â”€ Month Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {modalMonth !== null && (
                <MonthDetailModal
                    monthNum={modalMonth}
                    year={year}
                    data={monthData[modalMonth]}
                    tasks={projectTasks}
                    onClose={() => setModalMonth(null)}
                    onSave={upsertMonth}
                    accentColor={monthData[modalMonth]?.color_accent}
                />
            )}
        </div>
    )
}
