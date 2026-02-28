/**
 * useAuth.js — Global auth initializer (runs once in App.jsx)
 *
 * KEY FIX vs previous version:
 *  - authLoading is set to false by setSession() itself (store reducer)
 *    so it can NEVER get stuck. fetchProfile is now fire-and-forget AFTER
 *    authLoading is cleared — profile missing just means avatar shows initials.
 *  - SIGNED_IN and TOKEN_REFRESHED both just call setSession() — no spinner.
 *  - SIGNED_OUT calls clearAuth() — authLoading goes false immediately.
 *  - No complex event-type branching that can deadlock.
 */

import { useEffect, useRef } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { signOut as dbSignOut } from '../lib/database'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'

export function useAuth() {
  const { setSession, setProfile, clearAuth } = useStore(
    useShallow((s) => ({
      setSession: s.setSession,
      setProfile: s.setProfile,
      clearAuth: s.clearAuth,
    }))
  )
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    if (!supabaseConfigured || !supabase) {
      clearAuth()
      return
    }

    // One-time cleanup of the stale custom storageKey session
    try {
      localStorage.removeItem('taskmaster-auth')
      localStorage.removeItem('taskmaster-auth-code-verifier')
    } catch { /* private browsing */ }

    // ── 1. Restore persisted session immediately ─────────────────────────
    // setSession() already sets authLoading = false in the store reducer,
    // so the loader clears as soon as we have a definitive answer.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mountedRef.current) return
      if (error) { clearAuth(); return }

      const session = data?.session ?? null
      setSession(session)                     // <-- authLoading = false here
      if (session?.user) fetchProfile(session.user)  // fire-and-forget
    }).catch(() => { if (mountedRef.current) clearAuth() })

    // ── 2. Live listener for all subsequent auth changes ─────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mountedRef.current) return
        if (session) {
          setSession(session)                  // authLoading stays false
          fetchProfile(session.user)           // fire-and-forget
        } else {
          clearAuth()                          // SIGNED_OUT
        }
      }
    )

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Profile fetch / auto-create ──────────────────────────────────────────
  async function fetchProfile(user) {
    try {
      if (!user?.id) return

      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()

      if (!mountedRef.current) return

      if (data) { setProfile(data); return }

      // Profile row doesn't exist yet — create it
      const fullName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ?? 'Account'

      const { data: created } = await supabase
        .from('profiles').insert({ id: user.id, full_name: fullName })
        .select().single()

      if (mountedRef.current && created) setProfile(created)
    } catch {
      // Non-fatal — profile missing just means no avatar name, dashboard still works
    }
  }

  return { signOut: async () => { await dbSignOut(); clearAuth() } }
}
