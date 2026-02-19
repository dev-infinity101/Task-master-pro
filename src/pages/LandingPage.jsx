import { Link, Navigate } from 'react-router-dom'
import { CheckCircle2, Sparkles, ShieldCheck, Zap } from 'lucide-react'
import useStore from '../store/store'

export default function LandingPage() {
  const session = useStore((s) => s.session)

  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Zap className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="text-sm tracking-[0.3em] text-slate-300">TASKMASTER PRO</span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm text-slate-200 hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-sm font-medium bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors"
              >
                Get started
              </Link>
            </div>
          </header>

          <section className="mt-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300/80">
                Task orchestration for teams
              </p>
              <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight">
                Keep every project aligned from plan to delivery
              </h1>
              <p className="mt-4 text-lg text-slate-300 leading-relaxed">
                Organize tasks, stay in sync with real-time updates, and focus your team
                with a workflow built for clarity and speed.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signup"
                  className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-semibold text-center transition-colors"
                >
                  Sign up for free
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold text-center transition-colors"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Supabase-ready auth
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Protected routes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Realtime sync
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-indigo-500/10">
              <div className="grid gap-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Secure access</p>
                    <p className="text-xs text-slate-400">Session-based protection across every route.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Guided workflow</p>
                    <p className="text-xs text-slate-400">Landing to auth to dashboard in one flow.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Fast onboarding</p>
                    <p className="text-xs text-slate-400">Launch ready for Supabase user data.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-16 flex flex-col sm:hidden gap-3">
            <Link
              to="/login"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold text-center transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-semibold text-center transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
