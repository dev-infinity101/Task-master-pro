import { Navigate } from 'react-router-dom'
import useStore from '../../store/store'

export default function ProtectedRoute({ children }) {
  const { session, authLoading } = useStore((s) => ({
    session: s.session,
    authLoading: s.authLoading,
  }))

  // Show nothing during initial session check (prevents flash of login screen)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}
