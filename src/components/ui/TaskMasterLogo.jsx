/**
 * TaskMasterLogo — Single-source-of-truth brand logo component.
 *
 * Architecture:
 *  - Single SVG, CSS-variable driven via --logo-bg / --logo-border / --logo-icon
 *  - Adapts automatically to .dark class (Option A — CSS variable based)
 *  - No raster images; pure vector paths
 *  - Pixel-sharp at 16px → 512px
 *  - Accessible: <title> + aria-label
 *
 * Usage:
 *   <TaskMasterLogo size={32} />                   // icon only
 *   <TaskMasterLogo size={32} showWordmark />       // icon + "TaskMaster" text
 *   <TaskMasterLogo size={32} variant="sidebar" />  // sidebar variant (icon + tight wordmark)
 *   <TaskMasterLogo size={40} variant="auth" />     // auth screen variant
 *
 * Variants:
 *   "default"  — icon + optional wordmark side by side
 *   "icon"     — icon only, no text
 *   "auth"     — icon + stacked "TaskMaster" + "Pro" label
 *   "sidebar"  — compact icon + tight wordmark
 */

const LOGO_ID_COUNTER = { current: 0 }

export default function TaskMasterLogo({
    size = 32,
    showWordmark = false,
    variant = 'default',
    className = '',
    style = {},
}) {
    // Unique IDs so multiple instances on the same page don't clash
    const uid = ++LOGO_ID_COUNTER.current

    const titleId = `tm-logo-title-${uid}`

    const iconOnly = variant === 'icon'
    const authMode = variant === 'auth'
    const sidebarMode = variant === 'sidebar'
    const withText = showWordmark || authMode || sidebarMode

    return (
        <span
            className={`tm-logo-root inline-flex items-center gap-2 shrink-0 ${className}`}
            style={style}
            aria-label="TaskMaster Pro Logo"
        >
            {/* ── SVG Icon ───────────────────────────────────── */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                aria-labelledby={titleId}
                role="img"
                style={{
                    display: 'block',
                    flex: 'none',
                    overflow: 'visible',
                }}
            >
                <title id={titleId}>TaskMaster Pro Logo</title>

                {/* ── Outer rounded-square container ── */}
                <rect
                    x="2"
                    y="2"
                    width="60"
                    height="60"
                    rx="14"
                    ry="14"
                    fill="var(--logo-bg)"
                    stroke="var(--logo-border)"
                    strokeWidth="3"
                />

                {/* ── Hourglass icon ──────────────────────────────
            The hourglass is built from 4 key shapes:
            1. Top trapezoid (top half, wide at top)
            2. Bottom trapezoid (bottom half, wide at bottom)
            3. Top flat bar (cap)
            4. Bottom flat bar (cap)
            5. A thin waist connector
            All centered at 32,32 within the 64×64 viewBox.
        ────────────────────────────────────────────────── */}

                {/* Top cap bar */}
                <rect
                    x="14"
                    y="12"
                    width="36"
                    height="5"
                    rx="2.5"
                    fill="var(--logo-icon)"
                />

                {/* Bottom cap bar */}
                <rect
                    x="14"
                    y="47"
                    width="36"
                    height="5"
                    rx="2.5"
                    fill="var(--logo-icon)"
                />

                {/* Top hourglass half — trapezoid pointing down */}
                <path
                    d="M16 17 L48 17 L35 32 L29 32 Z"
                    fill="var(--logo-icon)"
                    opacity="0.95"
                />

                {/* Bottom hourglass half — trapezoid pointing up */}
                <path
                    d="M29 32 L35 32 L48 47 L16 47 Z"
                    fill="var(--logo-icon)"
                    opacity="0.95"
                />

                {/* Waist — tiny circle dot at the neck */}
                <circle
                    cx="32"
                    cy="32"
                    r="2.5"
                    fill="var(--logo-bg)"
                    opacity="0.7"
                />

                {/* Sand particle animation — flows from narrow waist downward */}
                <rect
                    x="30.5"
                    y="32"
                    width="3"
                    height="3"
                    rx="1.5"
                    fill="var(--logo-bg)"
                    opacity="0.6"
                >
                    <animate
                        attributeName="opacity"
                        values="0.6;0.1;0.6"
                        dur="2.4s"
                        repeatCount="indefinite"
                        calcMode="spline"
                        keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                </rect>
            </svg>

            {/* ── Wordmark ───────────────────────────────────── */}
            {withText && !iconOnly && (
                <span
                    className="tm-logo-wordmark leading-none select-none"
                    aria-hidden="true"
                >
                    {authMode ? (
                        /* Stacked layout for auth screens */
                        <span className="flex flex-col items-start">
                            <span
                                className="font-bold tracking-tight text-foreground"
                                style={{ fontSize: size * 0.625, lineHeight: 1.1 }}
                            >
                                TaskMaster
                            </span>
                            <span
                                className="font-semibold tracking-widest uppercase text-primary"
                                style={{ fontSize: size * 0.3, letterSpacing: '0.15em', lineHeight: 1.4 }}
                            >
                                Pro
                            </span>
                        </span>
                    ) : sidebarMode ? (
                        /* Compact sidebar layout */
                        <span className="flex flex-col items-start">
                            <span
                                className="font-bold tracking-tight text-foreground"
                                style={{ fontSize: size * 0.44, lineHeight: 1.15 }}
                            >
                                TaskMaster
                            </span>
                            <span
                                className="font-medium tracking-widest uppercase text-muted-foreground"
                                style={{ fontSize: size * 0.25, letterSpacing: '0.12em', lineHeight: 1.3 }}
                            >
                                Pro Workspace
                            </span>
                        </span>
                    ) : (
                        /* Default inline wordmark */
                        <span
                            className="font-bold tracking-tight text-foreground"
                            style={{ fontSize: size * 0.5, lineHeight: 1 }}
                        >
                            TaskMaster
                        </span>
                    )}
                </span>
            )}
        </span>
    )
}
