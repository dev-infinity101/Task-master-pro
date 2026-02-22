import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Zap, Loader2 } from 'lucide-react'
import { signIn, signInWithGoogle, resetPassword, updatePassword } from '../lib/database'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Button, Container, Input, Surface } from '../components/ui/Primitives'

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
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
          toast.error('Invalid email or password.')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email before logging in.')
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
      toast.error('Network error. Please try again.')
      setAuthLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error('Google sign-in failed. Please try again.')
      setIsGoogleLoading(false)
    }
    // Redirect handled by Supabase OAuth flow
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
      toast.error('Passwords do not match.')
      return
    }

    setIsUpdating(true)
    const { error } = await updatePassword(password)
    setIsUpdating(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password updated successfully.')
    setMode('login')
    setResetSent(false)
    window.history.replaceState(null, '', window.location.pathname)
  }

  return (
    <div className="min-h-screen text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0F1E3A_0%,#0B1220_40%,#000000_100%)]" />
      <div className="absolute -top-24 -left-28 h-96 w-96 rounded-[32px] bg-linear-to-br from-cyan-300/20 to-blue-500/20 blur-2xl" />
      <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-[32px] bg-linear-to-br from-blue-500/20 to-cyan-300/10 blur-2xl" />

      <Container className="relative py-12">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 shadow-[0_10px_30px_rgba(37,99,235,0.25)]">
              <Zap className="h-5 w-5 text-white" fill="currentColor" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">TaskMaster</div>
              <div className="text-xs text-slate-400">Production-Grade Task System</div>
            </div>
          </Link>
          <div className="text-sm text-slate-300">
            New here?{' '}
            <Link to="/signup" className="text-blue-300 hover:text-blue-200 transition-colors font-medium">
              Create an account
            </Link>
          </div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="hidden lg:block pt-12">
            <h1 className="text-5xl font-extrabold leading-[1.08]">
              Keep every project
              <br />
              aligned from plan to delivery
            </h1>
            <p className="mt-5 max-w-md text-slate-300">
              Sign in to access your dashboard, realtime updates, and AI planning workflow.
            </p>
          </div>

          <Surface className="w-full max-w-md lg:ml-auto p-8">
            <h2 className="text-xl font-semibold text-white">
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'reset'
                  ? 'Reset your password'
                  : 'Set a new password'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login'
                ? 'Sign in to your workspace.'
                : mode === 'reset'
                  ? 'We’ll email you a secure reset link.'
                  : 'Choose a strong password to continue.'}
            </p>

          {mode === 'login' && (
            <>
              <div className="mt-6">
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  variant="secondary"
                  size="lg"
                  className="w-full justify-center"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </Button>
              </div>

              <div className="relative mt-6 flex items-center">
                <div className="grow border-t border-white/10" />
                <span className="mx-4 text-xs text-slate-500 uppercase tracking-wider">or</span>
                <div className="grow border-t border-white/10" />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  label="Email"
                  error={errors.email?.message}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                  })}
                />

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 pr-11 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30"
                      {...register('password', { required: 'Password is required' })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setResetSent(false) }}
                    className="text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-md"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="w-full justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-400 mt-6">
                Don&apos;t have an account?{' '}
                <Link
                  to="/signup"
                  className="text-blue-300 hover:text-blue-200 font-medium transition-colors"
                >
                  Sign up free
                </Link>
              </p>
            </>
          )}

          {mode === 'reset' && (
            <>
              {resetSent ? (
                <div className="mt-6 text-sm text-slate-300">
                  Check your email for a reset link.
                </div>
              ) : (
                <form onSubmit={handleResetSubmit(onResetSubmit)} className="mt-6 space-y-4">
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    label="Email"
                    error={resetErrors.email?.message}
                    {...registerReset('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                    })}
                  />

                  <Button
                    type="submit"
                    disabled={isResetting}
                    size="lg"
                    className="w-full justify-center"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </Button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setMode('login'); setResetSent(false) }}
                className="mt-6 text-sm text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-md"
              >
                Back to sign in
              </button>
            </>
          )}

          {mode === 'update' && (
            <>
              <form onSubmit={handleUpdateSubmit(onUpdateSubmit)} className="mt-6 space-y-4">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  label="New password"
                  error={updateErrors.password?.message}
                  {...registerUpdate('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  })}
                />

                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  label="Confirm password"
                  error={updateErrors.confirmPassword?.message}
                  {...registerUpdate('confirmPassword', { required: 'Please confirm your password' })}
                />

                <Button
                  type="submit"
                  disabled={isUpdating}
                  size="lg"
                  className="w-full justify-center"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            </>
          )}
          </Surface>
        </div>
      </Container>
    </div>
  )
}
