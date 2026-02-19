import { useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { signOut as dbSignOut } from '../lib/database'
import useStore from '../store/store'

export function useAuth() {
  const { setSession, setProfile, clearAuth, setAuthLoading } = useStore()

  useEffect(() => {
    if (!supabaseConfigured) {
      clearAuth()
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else clearAuth()
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
      }
      
      if (data) {
        setProfile(data)
      }
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
