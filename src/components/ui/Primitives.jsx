import { forwardRef } from 'react'

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

export function Container({ className, ...props }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-6', className)} {...props} />
}

export function Surface({ className, ...props }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.4)]',
        className
      )}
      {...props}
    />
  )
}

export const Button = forwardRef(function Button(
  { children, className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:
      'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.25)] hover:bg-blue-500',
    secondary:
      'bg-white/5 text-slate-100 border border-white/10 hover:bg-white/10 hover:border-white/15',
    ghost: 'bg-transparent text-slate-200 hover:bg-white/5',
    danger:
      'bg-red-500/15 text-red-200 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30',
  }
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-6 text-sm',
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton(
  { children, className, label, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

export const Input = forwardRef(function Input(
  { className, error, label, id, ...props },
  ref
) {
  const inputId = id ?? (label ? `field-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cx(
          'h-11 w-full rounded-xl border bg-black/30 px-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all',
          error ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-blue-500/50',
          'focus:ring-2 focus:ring-blue-500/30',
          className
        )}
        {...props}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { className, error, label, id, ...props },
  ref
) {
  const inputId = id ?? (label ? `field-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cx(
          'min-h-28 w-full rounded-xl border bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all',
          error ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-blue-500/50',
          'focus:ring-2 focus:ring-blue-500/30',
          className
        )}
        {...props}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  )
})

export function Badge({ className, tone = 'neutral', ...props }) {
  const tones = {
    neutral: 'border-white/10 bg-white/5 text-slate-200',
    blue: 'border-blue-400/20 bg-blue-500/10 text-blue-200',
    green: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    red: 'border-red-400/20 bg-red-500/10 text-red-200',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
        tones[tone],
        className
      )}
      {...props}
    />
  )
}

export function Avatar({ name, src, className }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <div
      className={cx(
        'grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-blue-600/20 text-sm font-semibold text-blue-100',
        className
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full rounded-xl object-cover" /> : initial}
    </div>
  )
}
