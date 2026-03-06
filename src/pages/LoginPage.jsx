import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { signIn, resetPassword, updatePassword } from '../lib/database'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import TaskMasterLogo from '@/components/ui/TaskMasterLogo'

/* ── Light Surface card ───────────────────────────────── */
function Surface({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-none border border-gray-200 bg-white shadow-[0_4px_30px_rgba(0,0,0,0.06)] text-gray-900 relative',
        className
      )}
      {...props}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      {props.children}
    </div>
  )
}

/* ── Input component ──────────────────────────────────── */
function TerminalInput({ className, error, ...props }) {
  return (
    <input
      className={cn(
        'flex h-12 w-full rounded-none border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-gray-400',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all font-mono',
        error && 'border-red-400 focus-visible:ring-red-400 focus-visible:border-red-400',
        className
      )}
      {...props}
    />
  )
}

/* ── Primary button ───────────────────────────────────── */
function TerminalButton({ className, disabled, loading, children, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'group relative flex items-center justify-center gap-3 w-full h-14 rounded-none',
        'bg-gray-900 text-white text-[13px] uppercase tracking-[0.15em] font-bold',
        'hover:bg-blue-600 border border-gray-900 hover:border-blue-600',
        'transition-all duration-300 overflow-hidden',
        'disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
        className
      )}
      {...props}
    >
      <span className="relative z-10 font-mono flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </button>
  )
}

/* ── Field label ──────────────────────────────────────── */
function Label({ className, ...props }) {
  return (
    <label
      className={cn('text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2 block', className)}
      {...props}
    />
  )
}

export default function LoginPage() {
  const { isAuthenticated: _, session, setSession, setAuthLoading } = useStore(useShallow((s) => ({
    isAuthenticated: !!s.session,
    session: s.session,
    setSession: s.setSession,
    setAuthLoading: s.setAuthLoading,
  })))
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [resetSent, setResetSent] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm()

  const {
    register: registerUpdate,
    handleSubmit: handleUpdateSubmit,
    formState: { errors: updateErrors },
  } = useForm()

  // Set light background on mount
  useEffect(() => {
    document.body.style.backgroundColor = '#F8F9FB'
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setMode('update')
    }
  }, [])

  if (session && mode !== 'update') return <Navigate to="/dashboard" replace />

  const onSubmit = async ({ email, password }) => {
    setIsLoading(true)
    setAuthLoading(true)
    try {
      const { data, error } = await signIn({ email, password })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('ACCESS DENIED: Invalid credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('ACCESS DENIED: Email not confirmed.')
        } else {
          toast.error(error.message)
        }
        setAuthLoading(false)
        return
      }

      if (data?.session) {
        setSession(data.session)
        setAuthLoading(false)
        navigate('/dashboard', { replace: true })
        return
      }

      toast.error('Check your email to confirm your account before signing in.')
      setAuthLoading(false)
    } catch (error) {
      toast.error('NETWORK ERROR: Connection interrupted.')
      setAuthLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const onResetSubmit = async ({ email }) => {
    setIsResetting(true)
    const { error } = await resetPassword(email)
    setIsResetting(false)
    if (error) { toast.error(error.message); return }
    setResetSent(true)
  }

  const onUpdateSubmit = async ({ password, confirmPassword }) => {
    if (password !== confirmPassword) { toast.error('CREDENTIAL MISMATCH.'); return }
    setIsUpdating(true)
    const { error } = await updatePassword(password)
    setIsUpdating(false)
    if (error) { toast.error(error.message); return }
    toast.success('CREDENTIALS UPDATED.')
    setMode('login')
    setResetSent(false)
    window.history.replaceState(null, '', window.location.pathname)
  }

  return (
    <>
      <style>{`
        @keyframes horizon-breathe {
          0%, 100% { opacity: 0.5; transform: scaleY(1); }
          50% { opacity: 0.9; transform: scaleY(1.15); }
        }
        .animate-horizon-breathe {
          animation: horizon-breathe 10s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen relative flex items-center justify-center bg-[#F8F9FB] text-gray-900 overflow-hidden selection:bg-blue-500/20 font-sans">

        {/* Ambient background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-blue-100/50 via-blue-50/30 to-transparent animate-horizon-breathe" />
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent -rotate-12 transform-gpu" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] px-6 py-12">
          <div className="flex flex-col items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center justify-center gap-3 mb-10 group relative">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <TaskMasterLogo size={40} />
            </Link>

            <div className="w-full">
              {/* Header */}
              <div className="mb-8 text-center flex flex-col items-center">
                <span className="text-[12px] font-mono text-gray-400 leading-relaxed uppercase tracking-widest">
                  Welcome to productivity
                </span>
                <h2 className="text-[28px] md:text-[32px] font-black tracking-tighter text-gray-900 leading-tight uppercase mt-1">
                  {mode === 'login'
                    ? 'SIGN_IN'
                    : mode === 'reset'
                      ? 'RESET_PASSWORD'
                      : 'UPDATE_PASSWORD'}
                </h2>
                <p className="mt-2 text-[12px] font-mono text-gray-400 leading-relaxed uppercase tracking-widest">
                  {mode === 'login'
                    ? 'Enter your credentials to continue'
                    : mode === 'reset'
                      ? 'Receive a password reset link'
                      : 'Set a new password for your account'}
                </p>
              </div>

              <Surface className="p-8 sm:p-10">
                {/* Terminal-style header bar */}
                <div className="flex items-center gap-2 mb-8 border-b border-gray-100 pb-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                    <div className="w-3 h-3 rounded-full bg-transparent border border-gray-300" />
                  </div>
                  <div className="mx-auto text-[10px] font-mono tracking-widest text-gray-400 uppercase">// AUTH_MATRIX</div>
                </div>

                {/* Login Form */}
                {mode === 'login' && (
                  <>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div>
                        <Label htmlFor="email">Email address</Label>
                        <TerminalInput
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="your@email.com"
                          error={errors.email}
                          {...register('email', {
                            required: 'EMAIL REQUIRED',
                            pattern: { value: /\S+@\S+\.\S+/, message: 'INVALID FORMAT' },
                          })}
                        />
                        {errors.email && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{errors.email.message}</p>}
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => { setMode('reset'); setResetSent(false) }}
                            className="text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors mb-2"
                          >
                            Lost Key?
                          </button>
                        </div>
                        <div className="relative">
                          <TerminalInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            error={errors.password}
                            {...register('password', { required: 'PASSWORD REQUIRED' })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{errors.password.message}</p>}
                      </div>

                      <TerminalButton type="submit" loading={isLoading} className="mt-8">
                        Sign In
                        {!isLoading && <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                      </TerminalButton>
                    </form>
                  </>
                )}

                {/* Reset Password Form */}
                {mode === 'reset' && (
                  <>
                    {resetSent ? (
                      <div className="space-y-6">
                        <div className="p-4 bg-blue-50 border border-blue-200 font-mono text-[12px] uppercase text-blue-600 leading-relaxed tracking-widest text-center">
                          UPLINK ESTABLISHED. <br /> AWAITING OPERATOR CONFIRMATION IN INBOX.
                        </div>
                        <button
                          className="w-full h-12 border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900 font-mono text-[11px] uppercase tracking-widest transition-colors"
                          onClick={() => setResetSent(false)}
                        >
                          Retry Uplink
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-6">
                        <div>
                          <Label htmlFor="reset-email">Email address</Label>
                          <TerminalInput
                            id="reset-email"
                            type="email"
                            placeholder="OPERATOR IDENTIFIER"
                            error={resetErrors.email}
                            {...registerReset('email', {
                              required: 'EMAIL REQUIRED',
                              pattern: { value: /\S+@\S+\.\S+/, message: 'INVALID FORMAT' },
                            })}
                          />
                          {resetErrors.email && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{resetErrors.email.message}</p>}
                        </div>
                        <TerminalButton type="submit" loading={isResetting} className="mt-8">
                          Send Reset Link
                        </TerminalButton>
                      </form>
                    )}
                  </>
                )}

                {/* Update Password Form */}
                {mode === 'update' && (
                  <form onSubmit={handleUpdateSubmit(onUpdateSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <TerminalInput
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        error={updateErrors.password}
                        {...registerUpdate('password', {
                          required: 'PASSWORD REQUIRED',
                          minLength: { value: 6, message: 'MIN 6 CHARACTERS' },
                        })}
                      />
                      {updateErrors.password && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{updateErrors.password.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <TerminalInput
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        error={updateErrors.confirmPassword}
                        {...registerUpdate('confirmPassword', { required: 'CONFIRMATION REQUIRED' })}
                      />
                      {updateErrors.confirmPassword && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{updateErrors.confirmPassword.message}</p>}
                    </div>
                    <TerminalButton type="submit" loading={isUpdating} className="mt-8">
                      Update Password
                    </TerminalButton>
                  </form>
                )}

                {/* Back to login */}
                {mode !== 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setResetSent(false) }}
                    className="mt-8 w-full text-center text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    Abort &amp; Return
                  </button>
                )}
              </Surface>

              {/* Footer link */}
              {mode === 'login' && (
                <p className="mt-8 text-center text-[11px] font-mono tracking-widest text-gray-400 uppercase">
                  UNREGISTERED?{' '}
                  <Link to="/signup" className="font-bold text-gray-700 hover:text-blue-600 transition-colors">
                    SIGN UP
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
