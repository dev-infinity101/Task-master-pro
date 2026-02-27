import { Navigate } from 'react-router-dom'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import HourglassLoader from '../ui/HourglassLoader'

export default function ProtectedRoute({ children }) {
  const { session, authLoading } = useStore(useShallow((s) => ({
    session: s.session,
    authLoading: s.authLoading,
  })))

  // Show nothing during initial session check (prevents flash of login screen)
  if (authLoading) {
    return <HourglassLoader />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}
