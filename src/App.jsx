/**
 * App.jsx — Root component
 *
 * Responsibilities:
 * 1. Auth initialization (session check on mount)
 * 2. System theme detection + manual override
 * 3. Global keyboard shortcuts (Cmd+K registered in CommandPalette)
 * 4. Route structure with protected routes
 * 5. Global UI components (Toaster, CommandPalette, AIAssistant)
 *
 * Removed from old App.jsx:
 * - setInterval for "overdue" detection (now done via DB trigger + cron)
 * - setInterval WebSocket simulation (replaced by useRealtimeSync hook)
 * - fake isAuthenticated boolean (replaced by real session)
 */

import { useEffect, Component, lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import useStore from './store/store'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'

// Auth
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Global UI
import CommandPalette from './components/ui/CommandPalette'
import AIAssistant from './components/ai/AIAssistant'

// Pages (lazy-loaded for code splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))

import HourglassLoader from './components/ui/HourglassLoader'

const PageLoader = () => <HourglassLoader />

/**
 * AuthCallback — handles Supabase PKCE email verification redirects.
 *
 * When a user clicks the confirmation link, Supabase redirects them to
 * /auth/callback?code=<pkce_code>. The SDK's detectSessionInUrl=true
 * intercepts this and exchanges the code for a session automatically.
 * We just need to wait for onAuthStateChange to fire, then navigate.
 *
 * If the link is expired or invalid, we show a clear error and send
 * the user back to /signup to try again.
 */
function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // 'verifying' | 'error'

  useEffect(() => {
    const timeout = setTimeout(() => {
      // If session wasn't established within 8 seconds, assume link is bad
      setStatus('error')
    }, 8000)

    // Listen for auth state change — SIGNED_IN means exchange succeeded
    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          clearTimeout(timeout)
          navigate('/dashboard', { replace: true })
        }
        if (event === 'USER_UPDATED') {
          clearTimeout(timeout)
          navigate('/dashboard', { replace: true })
        }
      })
      : { data: { subscription: { unsubscribe: () => { } } } }

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [navigate])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FA] text-[#111111] text-center px-6">
        <div className="max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Verification link expired</h2>
          <p className="text-[#555555] text-sm mb-6 leading-relaxed">
            This confirmation link has expired or is invalid.{' '}
            Sign up again to receive a fresh link — it expires after 24 hours.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2563EB] transition-colors"
          >
            Back to Sign Up
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-[#555555]">Verifying your email…</p>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Error boundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-6">Refresh the page to try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function App() {
  const { theme, setTheme } = useStore(useShallow((s) => ({
    theme: s.theme,
    setTheme: s.setTheme,
  })))
  const location = useLocation()
  const isLanding = location.pathname === '/'
  useAuth() // Initializes session and subscribes to auth changes

  // System theme detection
  useEffect(() => {
    const applyTheme = (isDark) => {
      document.documentElement.classList.toggle('dark', isDark)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)
      const handler = (e) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyTheme(theme === 'dark')
    }
  }, [theme])

  return (
    <ErrorBoundary>
      <div className={`min-h-screen font-sans antialiased ${isLanding ? '' : 'bg-background text-foreground'}`}>
        {!isLanding && (
          <>
            <div className="fixed inset-0 pointer-events-none -z-10 hidden dark:block">
              <div className="absolute inset-0 bg-[#000000]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.02),transparent_40%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(255,255,255,0.015),transparent_45%)]" />
            </div>
            <div className="fixed inset-0 pointer-events-none -z-10 dark:hidden">
              <div className="absolute inset-0 bg-[#ECEEF0]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,0.06),transparent_40%)]" />
            </div>
          </>
        )}
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                  <Analytics />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global overlays */}
        <CommandPalette />
        <AIAssistant />

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--card-foreground)',
              borderRadius: 'var(--radius)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#050505' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#050505' } },
          }}
          richColors
        />
      </div>
    </ErrorBoundary>
  )
}
