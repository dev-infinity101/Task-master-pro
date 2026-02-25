import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Zap, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { signUp } from '../lib/database'
import useStore from '../store/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async ({ fullName, email, password }) => {
    setIsLoading(true)
    const { error } = await signUp({ email, password, fullName })
    setIsLoading(false)

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('An account with this email already exists.')
      } else if (error.message.includes('Password should be')) {
        toast.error('Password must be at least 6 characters.')
      } else {
        toast.error(error.message)
      }
      return
    }

    setEmailSent(true)
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center bg-[#F7F8FA] text-[#111111] overflow-hidden selection:bg-[#BFDBFE]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center gap-2.5 mb-12">
            <div className="h-10 w-10 bg-[#111111] rounded-xl flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" fill="white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#111111]">
              TaskMaster
            </span>
          </Link>

          {!emailSent ? (
            <div className="w-full">
              <div className="mb-8 text-center">
                <h2 className="text-[32px] font-bold tracking-tight text-[#111111] leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Create account
                </h2>
                <p className="mt-3 text-[16px] text-[#555555] leading-relaxed">
                  Start your 14-day free trial today. No credit card required.
                </p>
              </div>

              <Surface className="p-8 sm:p-10">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-[14px] font-medium text-[#111111]">Full name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Jane Smith"
                      className={cn(
                        "bg-white border-[#E5E7EB] h-12 rounded-lg text-[15px] focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]",
                        errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""
                      )}
                      {...register('fullName', { required: 'Full name is required' })}
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[14px] font-medium text-[#111111]">Email</Label>
                    <Input
                      id="email"
                      type="email"
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
                    <Label htmlFor="password" className="text-[14px] font-medium text-[#111111]">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className={cn(
                          "bg-white border-[#E5E7EB] h-12 rounded-lg text-[15px] pr-10 focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB]",
                          errors.password ? "border-destructive focus-visible:ring-destructive" : ""
                        )}
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Min. 6 characters' },
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-[52px] text-[15px] font-semibold bg-[#111111] hover:bg-[#2563EB] text-white rounded-lg transition-colors shadow-sm gap-2 mt-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        Get Started Now
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Surface>

              <p className="mt-8 text-center text-[14px] text-[#555555]">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-[#111111] hover:text-[#2563EB] transition-colors underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <div className="w-full text-center">
              <Surface className="p-10">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] mb-8">
                  <CheckCircle className="h-8 w-8 text-[#2563EB]" />
                </div>
                <h2 className="text-[28px] font-bold tracking-tight text-[#111111] mb-4">Check your email</h2>
                <p className="text-[#555555] mb-10 leading-relaxed text-[16px]">
                  We sent a confirmation link to your email. Click it to activate your account and start shipping.
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full h-12 border-[#E5E7EB] rounded-lg text-[14px] font-medium hover:border-[#111111]">
                    Back to login
                  </Button>
                </Link>
              </Surface>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
