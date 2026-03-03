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

function Surface({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-none border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(37,99,235,0.05)] text-white relative',
        className
      )}
      {...props}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {props.children}
    </div>
  )
}

function TerminalInput({ className, error, ...props }) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-none border border-white/10 bg-black/50 px-3 py-2 text-sm text-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-mono",
        error && "border-red-500/50 focus-visible:ring-red-500/50 focus-visible:border-red-500",
        className
      )}
      {...props}
    />
  )
}

function TerminalButton({ className, disabled, loading, children, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "group relative flex items-center justify-center gap-3 w-full h-14 rounded-none bg-white text-black text-[13px] uppercase tracking-[0.15em] font-bold hover:bg-transparent hover:text-white border border-white transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-blue-600 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0" />
      <span className="relative z-10 font-mono flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </button>
  )
}

function Label({ className, ...props }) {
  return (
    <label className={cn("text-[10px] uppercase tracking-widest text-white/50 font-mono mb-2 block", className)} {...props} />
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

  // Force dark background globally to prevent flashes on overscroll
  useEffect(() => {
    document.body.style.backgroundColor = '#030303'
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
      toast.error('NETWORK ERROR: Connection interupted.')
      setAuthLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const onResetSubmit = async ({ email }) => {
    setIsResetting(true)
    const { error } = await resetPassword(email)
    setIsResetting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setResetSent(true)
  }

  const onUpdateSubmit = async ({ password, confirmPassword }) => {
    if (password !== confirmPassword) {
      toast.error('CREDENTIAL MISMATCH.')
      return
    }

    setIsUpdating(true)
    const { error } = await updatePassword(password)
    setIsUpdating(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('CREDENTIALS UPDATED.')
    setMode('login')
    setResetSent(false)
    window.history.replaceState(null, '', window.location.pathname)
  }

  return (
    <>
      <style>{`
        @keyframes horizon-breathe {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50% { opacity: 0.7; transform: scaleY(1.2); }
        }
        .animate-horizon-breathe {
          animation: horizon-breathe 10s ease-in-out infinite;
        }
        .landing-dark-theme {
          --logo-bg: #2563EB;
          --logo-border: #FFFFFF;
          --logo-icon: #FFFFFF;
        }
      `}</style>

      <div className="min-h-screen relative flex items-center justify-center bg-[#030303] text-white overflow-hidden selection:bg-blue-500/30 font-sans">

        {/* Animated background layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-blue-900/10 via-blue-900/5 to-transparent animate-horizon-breathe" />
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -rotate-12 transform-gpu" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] px-6 py-12">
          <div className="flex flex-col items-center">
            <Link to="/" className="landing-dark-theme flex items-center justify-center gap-3 mb-10 group relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <TaskMasterLogo size={40} />
            </Link>

            <div className="w-full">
              <div className="mb-8 text-center flex flex-col items-center">
                <span className='text-[12px] font-mono text-white/40 leading-relaxed uppercase tracking-widest'>Welcome to productivity</span>
                <h2 className="text-[28px] md:text-[32px] font-black tracking-tighter text-white mix-blend-plus-lighter leading-tight uppercase">
                  {mode === 'login'
                    ? 'SIGN_IN'
                    : mode === 'reset'
                      ? 'RESET_PASSWORD'
                      : 'UPDATE_PASSWORD'}
                </h2>
                <p className="mt-3 text-[12px] font-mono text-white/40 leading-relaxed uppercase tracking-widest">
                  {mode === 'login'
                    ? 'Enter your credentials to continue'
                    : mode === 'reset'
                      ? 'Receive a password reset link'
                      : 'Set a new password for your account'}
                </p>
              </div>

              <Surface className="p-8 sm:p-10">
                {/* Decorative Terminal Header */}
                <div className="flex items-center gap-2 mb-8 border-b border-white/10 pb-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                    <div className="w-3 h-3 rounded-full bg-transparent border border-white/20" />
                  </div>
                  <div className="mx-auto text-[10px] font-mono tracking-widest text-white/30 uppercase">// AUTH_MATRIX</div>
                </div>

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
                        {errors.email && <p className="text-[10px] uppercase font-mono mt-1 text-red-400 opacity-90">{errors.email.message}</p>}
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => { setMode('reset'); setResetSent(false) }}
                            className="text-[10px] font-mono uppercase tracking-widest text-white/40 hover:text-blue-400 transition-colors mb-2"
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-[10px] uppercase font-mono mt-1 text-red-400 opacity-90">{errors.password.message}</p>}
                      </div>

                      <TerminalButton type="submit" loading={isLoading} className="mt-8">
                        Sign In
                        {!isLoading && <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                      </TerminalButton>
                    </form>
                  </>
                )}

                {mode === 'reset' && (
                  <>
                    {resetSent ? (
                      <div className="space-y-6">
                        <div className="p-4 rounded-none bg-blue-500/10 border border-blue-500/30 font-mono text-[12px] uppercase text-blue-400 leading-relaxed tracking-widest text-center">
                          UPLINK ESTABLISHED. <br /> AWAITING OPERATOR CONFIRMATION IN INBOX.
                        </div>
                        <button
                          className="w-full h-12 border border-white/20 hover:border-white/50 text-white font-mono text-[11px] uppercase tracking-widest transition-colors"
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
                          {resetErrors.email && <p className="text-[10px] uppercase font-mono mt-1 text-red-400">{resetErrors.email.message}</p>}
                        </div>
                        <TerminalButton type="submit" loading={isResetting} className="mt-8">
                          Send Reset Link
                        </TerminalButton>
                      </form>
                    )}
                  </>
                )}

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
                      {updateErrors.password && <p className="text-[10px] uppercase font-mono mt-1 text-red-400">{updateErrors.password.message}</p>}
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
                      {updateErrors.confirmPassword && <p className="text-[10px] uppercase font-mono mt-1 text-red-400">{updateErrors.confirmPassword.message}</p>}
                    </div>
                    <TerminalButton type="submit" loading={isUpdating} className="mt-8">
                      Update Password
                    </TerminalButton>
                  </form>
                )}

                {mode !== 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setResetSent(false) }}
                    className="mt-8 w-full text-center text-[10px] font-mono uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                  >
                    Abort & Return
                  </button>
                )}
              </Surface>

              {mode === 'login' && (
                <p className="mt-8 text-center text-[11px] font-mono tracking-widest text-white/30 uppercase">
                  UNREGISTERED?{' '}
                  <Link to="/signup" className="font-bold text-white hover:text-blue-400 transition-colors">
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
