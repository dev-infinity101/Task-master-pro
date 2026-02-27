import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { signIn, resetPassword, updatePassword } from '../lib/database'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import TaskMasterLogo from '@/components/ui/TaskMasterLogo'

function Surface({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[#E5E7EB] bg-white text-[#111111] shadow-[0_8px_30px_rgba(0,0,0,0.04)]',
        className
      )}
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
    <div className="min-h-screen relative flex items-center justify-center bg-[#F7F8FA] text-[#111111] overflow-hidden selection:bg-[#BFDBFE]">
      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center gap-2.5 mb-12">
            <TaskMasterLogo size={40} variant="auth" />
          </Link>

          <div className="w-full">
            <div className="mb-8 text-center">
              <h2 className="text-[32px] font-bold tracking-tight text-[#111111] leading-tight">
                {mode === 'login'
                  ? 'Sign in'
                  : mode === 'reset'
                    ? 'Reset password'
                    : 'Set new password'}
              </h2>
              <p className="mt-3 text-[16px] text-[#555555] leading-relaxed">
                {mode === 'login'
                  ? 'Welcome back! Please enter your details.'
                  : mode === 'reset'
                    ? 'Enter your email to receive a reset link.'
                    : 'Create a permanent password for your account.'}
              </p>
            </div>

            <Surface className="p-8 sm:p-10">
              {mode === 'login' && (
                <>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[14px] font-medium text-[#111111]">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={cn(
                          "bg-white border-[#E5E7EB] h-12 rounded-lg text-[15px] focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]",
                          errors.email ? "border-destructive focus-visible:ring-destructive" : ""
                        )}
                        {...register('email', {
                          required: 'Email is required',
                          pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                        })}
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[14px] font-medium text-[#111111]">Password</Label>
                        <button
                          type="button"
                          onClick={() => { setMode('reset'); setResetSent(false) }}
                          className="text-[13px] font-medium text-[#888888] hover:text-[#2563EB] transition-colors"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className={cn(
                            "bg-white border-[#E5E7EB] h-12 rounded-lg text-[15px] pr-10 focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]",
                            errors.password ? "border-destructive focus-visible:ring-destructive" : ""
                          )}
                          {...register('password', { required: 'Password is required' })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111]"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[52px] text-[15px] font-semibold bg-[#111111] hover:bg-[#2563EB] text-white rounded-lg transition-colors shadow-sm gap-2"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          Sign in to Workspace
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}

              {mode === 'reset' && (
                <>
                  {resetSent ? (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[14px] text-[#2563EB] leading-relaxed">
                        Check your email! We&apos;ve sent a reset link to your inbox.
                      </div>
                      <Button variant="outline" className="w-full h-12 border-[#E5E7EB] rounded-lg text-[14px] font-medium hover:border-[#111111]" onClick={() => setResetSent(false)}>
                        Try another email
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email" className="text-[14px] font-medium text-[#111111]">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@example.com"
                          className={cn(
                            "bg-white border-[#E5E7EB] h-12 rounded-lg focus-visible:ring-[#2563EB]/20",
                            resetErrors.email ? "border-destructive focus-visible:ring-destructive" : ""
                          )}
                          {...registerReset('email', {
                            required: 'Email is required',
                            pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                          })}
                        />
                        {resetErrors.email && <p className="text-xs text-destructive">{resetErrors.email.message}</p>}
                      </div>
                      <Button type="submit" disabled={isResetting} className="w-full h-[52px] bg-[#111111] hover:bg-[#2563EB] text-white rounded-lg font-semibold shadow-sm">
                        {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                      </Button>
                    </form>
                  )}
                </>
              )}

              {mode === 'update' && (
                <form onSubmit={handleUpdateSubmit(onUpdateSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-[14px] font-medium text-[#111111]">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      className={cn(
                        "bg-white border-[#E5E7EB] h-12 rounded-lg focus-visible:ring-[#2563EB]/20",
                        updateErrors.password ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                      {...registerUpdate('password', {
                        required: 'Password is required',
                        minLength: { value: 6, message: 'At least 6 characters' },
                      })}
                    />
                    {updateErrors.password && <p className="text-xs text-destructive">{updateErrors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-[14px] font-medium text-[#111111]">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      className={cn(
                        "bg-white border-[#E5E7EB] h-12 rounded-lg focus-visible:ring-[#2563EB]/20",
                        updateErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                      {...registerUpdate('confirmPassword', { required: 'Please confirm' })}
                    />
                    {updateErrors.confirmPassword && <p className="text-xs text-destructive">{updateErrors.confirmPassword.message}</p>}
                  </div>
                  <Button type="submit" disabled={isUpdating} className="w-full h-[52px] bg-[#111111] hover:bg-[#2563EB] text-white rounded-lg font-semibold shadow-sm">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
                  </Button>
                </form>
              )}

              {mode !== 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  className="mt-6 w-full text-center text-[13px] font-medium text-[#888888] hover:text-[#111111] transition-colors underline underline-offset-4"
                >
                  Back to login
                </button>
              )}
            </Surface>

            {mode === 'login' && (
              <p className="mt-8 text-center text-[14px] text-[#555555]">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-semibold text-[#111111] hover:text-[#2563EB] transition-colors underline underline-offset-4">
                  Sign up for free
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
