import { useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { signOut as dbSignOut } from '../lib/database'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'

export function useAuth() {
  const { setSession, setProfile, clearAuth, setAuthLoading } = useStore(useShallow((s) => ({
    setSession: s.setSession,
    setProfile: s.setProfile,
    clearAuth: s.clearAuth,
    setAuthLoading: s.setAuthLoading,
  })))

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      clearAuth()
      return
    }

    let mounted = true
    const initSession = async () => {
      setAuthLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) {
          clearAuth()
          return
        }
        const session = data?.session ?? null
        setSession(session)
        if (session) fetchProfile(session.user.id)
        else setAuthLoading(false)
      } catch (error) {
        if (!mounted) return
        clearAuth()
      }
    }

    initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthLoading(true)
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else clearAuth()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116' && error.status !== 406) {
        console.error('Error fetching profile:', error)
      }
      
      setProfile(data ?? null)
    } catch (error) {
      console.error('Profile fetch error:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  const signOut = async () => {
    await dbSignOut()
    clearAuth()
  }

  return { signOut }
}
