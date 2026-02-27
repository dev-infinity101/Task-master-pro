import { cn } from "@/lib/utils"

/**
 * HourglassLoader — A premium, tech-focused animated loader.
 * Designed to be used globally across the app for a consistent look.
 */
export default function HourglassLoader({ className, fullScreen = true }) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-5 mx-auto",
                fullScreen ? "min-h-[90vh]" : "h-full py-12",
                className
            )}
            style={{ animation: 'analyticsFadeIn 300ms ease-out both' }}
        >
            {/* GPU-accelerated rotation wrapper */}
            <div style={{ animation: 'hourglassSpin 2.4s linear infinite', willChange: 'transform' }}>
                <svg
                    width="52"
                    height="52"
                    viewBox="0 0 52 52"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Loading..."
                    role="img"
                >
                    {/* outer silhouette */}
                    <path
                        d="M10 4h32v8l-12 12 12 12v8H10v-8l12-12L10 12V4z"
                        fill="hsl(var(--muted))"
                        opacity="0.35"
                    />
                    {/* top sand — drains */}
                    <clipPath id="topSandGlobal">
                        <rect x="12" y="6" width="28" height="16">
                            <animate
                                attributeName="height"
                                values="16;0;16"
                                dur="2.4s"
                                repeatCount="indefinite"
                                calcMode="spline"
                                keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                            />
                        </rect>
                    </clipPath>
                    <path
                        d="M10 4h32v8l-12 12H22L10 12V4z"
                        fill="hsl(var(--primary))"
                        clipPath="url(#topSandGlobal)"
                        opacity="0.8"
                    />
                    {/* bottom sand — fills */}
                    <clipPath id="botSandGlobal">
                        <rect x="12" y="30" width="28" height="0">
                            <animate
                                attributeName="height"
                                values="0;16;0"
                                dur="2.4s"
                                repeatCount="indefinite"
                                calcMode="spline"
                                keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                            />
                            <animate
                                attributeName="y"
                                values="46;30;46"
                                dur="2.4s"
                                repeatCount="indefinite"
                                calcMode="spline"
                                keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                            />
                        </rect>
                    </clipPath>
                    <path
                        d="M10 44v-8l12-12h8l12 12v8H10z"
                        fill="hsl(var(--primary))"
                        clipPath="url(#botSandGlobal)"
                        opacity="0.8"
                    />
                    {/* border strokes */}
                    <path
                        d="M10 4h32v8l-12 12 12 12v8H10v-8l12-12L10 12V4z"
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    <line x1="8" y1="4" x2="44" y2="4" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                    <line x1="8" y1="48" x2="44" y2="48" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                    <circle cx="26" cy="26" r="1.5" fill="hsl(var(--primary))">
                        <animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                </svg>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-bold"
                style={{ animation: 'analyticsPulse 2.4s ease-in-out infinite' }}>
                Synchronizing data
            </p>

            <style>{`
        @keyframes hourglassSpin   { to { transform: rotate(360deg) } }
        @keyframes analyticsFadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes analyticsPulse  { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
      `}</style>
        </div>
    )
}
