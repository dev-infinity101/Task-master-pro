import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { signUp } from '../lib/database'
import useStore from '../store/store'
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

  useEffect(() => {
    document.body.style.backgroundColor = '#030303'
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

      <div className="min-h-screen relative flex items-center justify-center bg-[#030303] text-white overflow-hidden selection:bg-blue-500/30 font-sans py-12">

        {/* Animated background layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-blue-900/10 via-blue-900/5 to-transparent animate-horizon-breathe" />
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -rotate-12 transform-gpu" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] px-6">
          <div className="flex flex-col items-center">
            <Link to="/" className="landing-dark-theme flex items-center justify-center gap-3 mb-10 group relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <TaskMasterLogo size={40} />
            </Link>

            {!emailSent ? (
              <div className="w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                  <span className='text-[12px] font-mono text-white/40 leading-relaxed uppercase tracking-widest'>Increase your productivity </span>
                  <h2 className="text-[28px] md:text-[32px] font-black tracking-tighter text-white mix-blend-plus-lighter leading-tight uppercase">
                    SIGN UP
                  </h2>
                  <p className="mt-3 text-[12px] font-mono text-white/40 leading-relaxed uppercase tracking-widest">
                    Create your account to get started
                  </p>
                </div>

                <Surface className="p-8 sm:p-10">
                  <div className="flex items-center gap-2 mb-8 border-b border-white/10 pb-4">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-transparent border border-white/20" />
                    </div>
                    <div className="mx-auto text-[10px] font-mono tracking-widest text-white/30 uppercase">// UPLINK_MATRIX</div>
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
                      {errors.fullName && <p className="text-[10px] uppercase font-mono mt-1 text-red-400 opacity-90">{errors.fullName.message}</p>}
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
                      {errors.email && <p className="text-[10px] uppercase font-mono mt-1 text-red-400 opacity-90">{errors.email.message}</p>}
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-[10px] uppercase font-mono mt-1 text-red-400 opacity-90">{errors.password.message}</p>}
                    </div>

                    <TerminalButton type="submit" loading={isLoading} className="mt-8">
                      Sign Up
                      {!isLoading && <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                    </TerminalButton>
                  </form>
                </Surface>

                <p className="mt-8 text-center text-[11px] font-mono tracking-widest text-white/30 uppercase">
                  ACTIVE REGISTRATION?{' '}
                  <Link to="/login" className="font-bold text-white hover:text-blue-400 transition-colors">
                    SIGN IN
                  </Link>
                </p>
              </div>
            ) : (
              <div className="w-full text-center">
                <Surface className="p-10">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-none bg-emerald-500/10 border border-emerald-500/30 mb-8">
                    <CheckCircle className="h-8 w-8 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  </div>
                  <h2 className="text-[24px] font-black tracking-tighter text-white mix-blend-plus-lighter mb-4 uppercase">
                    SIGN UP SUCCESSFUL
                  </h2>
                  <p className="text-white/40 mb-10 leading-relaxed text-[12px] font-mono tracking-widest uppercase">
                    Verification link sent to your inbox. Please check your email to activate your account.
                  </p>
                  <Link to="/login">
                    <button className="w-full h-12 border border-white/20 hover:border-white/50 text-white font-mono text-[11px] uppercase tracking-widest transition-colors">
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
