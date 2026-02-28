/**
 * ProtectedRoute.jsx
 *
 * Safety change: added a hard 4-second timeout on the loading state.
 * If authLoading is still true after 4s (e.g. network hung during
 * getSession()), we treat it as "no session" and redirect to login.
 * This prevents the dashboard from getting permanently stuck on the
 * "Synchronizing data" hourglass.
 */

import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import HourglassLoader from '../ui/HourglassLoader'

const MAX_LOAD_MS = 4000  // never show loader for more than 4 seconds

export default function ProtectedRoute({ children }) {
  const { session, authLoading } = useStore(useShallow((s) => ({
    session: s.session,
    authLoading: s.authLoading,
  })))

  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!authLoading) { setTimedOut(false); return }

    const t = setTimeout(() => setTimedOut(true), MAX_LOAD_MS)
    return () => clearTimeout(t)
  }, [authLoading])

  // Still checking auth — show loader (but limited to MAX_LOAD_MS)
  if (authLoading && !timedOut) return <HourglassLoader />

  // Session confirmed → render the protected page
  if (session) return children

  // No session (or timed out waiting) → send to login
  return <Navigate to="/login" replace />
}
