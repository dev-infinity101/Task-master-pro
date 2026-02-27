/**
 * YearProgressBanner.jsx
 *
 * A compact motivational banner showing how much of the current year has passed.
 * Features:
 * - Dynamic year percentage & days remaining (computed on mount only)
 * - Subtle shimmer animation on the green progress fill
 * - Month divider markers inside the track
 * - Hover glow + tooltip ("Today is Day X of Y")
 * - Theme-aware: dark surface on dark mode, soft card on light mode
 */

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

const MOTIVATIONAL_LINES = [
    'Time compounds. So does progress.',
    'Small steps daily.',
    'Make this year count.',
    'Focus today. The rest follows.',
    'Consistency beats intensity.',
]

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date - start
    return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Approximate day of year at which each month starts */
const MONTH_START_DAYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

export default function YearProgressBanner({ displayName }) {
    const [hovered, setHovered] = useState(false)

    const { dayOfYear, totalDays, daysRemaining, percent, year, motivational } = useMemo(() => {
        const now = new Date()
        const year = now.getFullYear()
        const totalDays = isLeapYear(year) ? 366 : 365
        const dayOfYear = getDayOfYear(now)
        const daysRemaining = totalDays - dayOfYear
        const percent = Math.round((dayOfYear / totalDays) * 100)
        const motivational = MOTIVATIONAL_LINES[dayOfYear % MOTIVATIONAL_LINES.length]
        return { dayOfYear, totalDays, daysRemaining, percent, year, motivational }
    }, [])

    const firstName = displayName?.split(' ')[0] ?? 'there'

    const greetingEmoji = (() => {
        const h = new Date().getHours()
        if (h < 12) return '☀️'
        if (h < 18) return '👋'
        return '🌙'
    })()

    return (
        <div
            className={cn(
                'relative mx-6 mt-6 mb-2 rounded-2xl border px-6 py-5 overflow-hidden transition-all duration-300',
                /* Dark mode: deep navy card */
                'dark:bg-[#0B1220] dark:border-white/6 dark:text-white',
                /* Light mode: white card */
                'bg-white border-border text-[#111111]'
            )}
        >
            {/* Faint background texture — dark only */}
            <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top_left,rgba(34,197,94,0.06),transparent_60%)] pointer-events-none" />

            {/* Greeting */}
            <p className="text-[18px] font-semibold mb-4 dark:text-white text-[#111111]">
                Hi {firstName}, good to see you {greetingEmoji}
            </p>

            {/* Progress bar */}
            <div
                className="relative group/bar cursor-default"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Track */}
                <div className="relative h-3.5 w-full rounded-full dark:bg-[#1F2937] bg-[#E5E7EB] overflow-hidden">
                    {/* Month divider markers */}
                    {MONTH_START_DAYS.slice(1).map((day, i) => {
                        const pos = (day / totalDays) * 100
                        return (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 w-px dark:bg-white/10 bg-black/10 z-20"
                                style={{ left: `${pos}%` }}
                            />
                        )
                    })}

                    {/* Fill */}
                    <div
                        className={cn(
                            'absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700 z-10',
                            hovered && 'brightness-110'
                        )}
                        style={{
                            width: `${percent}%`,
                            background: 'linear-gradient(90deg, #16A34A, #22C55E, #4ADE80)',
                        }}
                    >
                        {/* Shimmer overlay */}
                        <span
                            className="absolute inset-0 rounded-full"
                            style={{
                                background:
                                    'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.22) 50%, transparent 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 8s linear infinite',
                            }}
                        />
                    </div>
                </div>

                {/* Hover tooltip */}
                {hovered && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] bg-[#111111] text-white px-3 py-1.5 rounded-lg shadow-lg z-30 pointer-events-none">
                        Today is Day {dayOfYear} of {totalDays}
                    </div>
                )}
            </div>

            {/* Percentage line */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[14px] dark:text-[#A0AEC0] text-[#555555]">
                    <span className="font-bold text-[#22C55E]">{percent}%</span>{' '}
                    of {year} complete —{' '}
                    <span className="font-semibold dark:text-white text-[#111111]">{daysRemaining} days</span>{' '}
                    remaining
                </span>
            </div>

            {/* Motivational subtext */}
            <p className="mt-1.5 text-[13px] dark:text-[#6B7280] text-[#888888]">
                {motivational}
            </p>

            {/* Shimmer keyframe injected inline */}
            <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
        </div>
    )
}
