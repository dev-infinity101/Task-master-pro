import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { signUp } from '../lib/database'
import useStore from '../store/store'
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

export default function SignupPage() {
  const session = useStore((s) => s.session)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  // Set light background on mount
  useEffect(() => {
    document.body.style.backgroundColor = '#F8F9FB'
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async ({ fullName, email, password }) => {
    setIsLoading(true)
    const { error } = await signUp({ email, password, fullName })
    setIsLoading(false)

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('ACCESS DENIED: Operator already registered.')
      } else if (error.message.includes('Password should be')) {
        toast.error('INVALID KEY: Minimum 6 characters required.')
      } else {
        toast.error(error.message)
      }
      return
    }

    setEmailSent(true)
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

      <div className="min-h-screen relative flex items-center justify-center bg-[#F8F9FB] text-gray-900 overflow-hidden selection:bg-blue-500/20 font-sans py-12">

        {/* Ambient background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-blue-100/50 via-blue-50/30 to-transparent animate-horizon-breathe" />
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent -rotate-12 transform-gpu" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] px-6">
          <div className="flex flex-col items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center justify-center gap-3 mb-10 group relative">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <TaskMasterLogo size={40} />
            </Link>

            {!emailSent ? (
              <div className="w-full">
                {/* Header */}
                <div className="mb-8 text-center flex flex-col items-center">
                  <span className="text-[12px] font-mono text-gray-400 leading-relaxed uppercase tracking-widest">
                    Increase your productivity
                  </span>
                  <h2 className="text-[28px] md:text-[32px] font-black tracking-tighter text-gray-900 leading-tight uppercase mt-1">
                    SIGN UP
                  </h2>
                  <p className="mt-2 text-[12px] font-mono text-gray-400 leading-relaxed uppercase tracking-widest">
                    Create your account to get started
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
                    <div className="mx-auto text-[10px] font-mono tracking-widest text-gray-400 uppercase">// UPLINK_MATRIX</div>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="fullName">User Name</Label>
                      <TerminalInput
                        id="fullName"
                        type="text"
                        placeholder="YOUR NAME"
                        error={errors.fullName}
                        {...register('fullName', { required: 'DESIGNATION REQUIRED' })}
                      />
                      {errors.fullName && <p className="text-[10px] uppercase font-mono mt-1 text-red-500">{errors.fullName.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="email">Email address</Label>
                      <TerminalInput
                        id="email"
                        type="email"
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
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <TerminalInput
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          error={errors.password}
                          {...register('password', {
                            required: 'PASSWORD REQUIRED',
                            minLength: { value: 6, message: 'MIN 6 CHARACTERS' },
                          })}
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
                      Sign Up
                      {!isLoading && <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                    </TerminalButton>
                  </form>
                </Surface>

                <p className="mt-8 text-center text-[11px] font-mono tracking-widest text-gray-400 uppercase">
                  ACTIVE REGISTRATION?{' '}
                  <Link to="/login" className="font-bold text-gray-700 hover:text-blue-600 transition-colors">
                    SIGN IN
                  </Link>
                </p>
              </div>
            ) : (
              /* Email sent success state */
              <div className="w-full text-center">
                <Surface className="p-10">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-none bg-emerald-50 border border-emerald-200 mb-8">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h2 className="text-[24px] font-black tracking-tighter text-gray-900 mb-4 uppercase">
                    SIGN UP SUCCESSFUL
                  </h2>
                  <p className="text-gray-400 mb-10 leading-relaxed text-[12px] font-mono tracking-widest uppercase">
                    Verification link sent to your inbox. Please check your email to activate your account.
                  </p>
                  <Link to="/login">
                    <button className="w-full h-12 border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900 font-mono text-[11px] uppercase tracking-widest transition-colors">
                      Return to Sign In
                    </button>
                  </Link>
                </Surface>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
