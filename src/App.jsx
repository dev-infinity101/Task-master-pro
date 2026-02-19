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

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import useStore from './store/store'
import { useAuth } from './hooks/useAuth'

// Auth
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Global UI
import CommandPalette from './components/ui/CommandPalette'
import AIAssistant from './components/ai/AIAssistant'

// Pages (lazy-loaded for code splitting)
import { lazy, Suspense } from 'react'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics  = lazy(() => import('./pages/Analytics'))
const Settings   = lazy(() => import('./pages/Settings'))

const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  const { theme, setTheme } = useStore()
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<Navigate to="/dashboard" replace />} />

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

      {/* Global overlays — rendered outside route components */}
      <CommandPalette />
      <AIAssistant />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
        richColors
      />
    </div>
  )
}
