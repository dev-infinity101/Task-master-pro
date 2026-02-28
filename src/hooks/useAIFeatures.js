/**
 * useAIFeatures.js — Production-grade AI features hook
 *
 * Covers all 4 structured AI modes:
 *   - plan      → Daily Auto-Planning
 *   - decompose → Smart Task Decomposition
 *   - review    → Weekly Review Generator
 *   - narrate   → Smart Analytics Narration
 *
 * Token strategy (fixes "Authentication error" loop):
 *  1. Read access_token directly from Zustand store (always up-to-date because
 *     useAuth.js writes new session to store on every TOKEN_REFRESHED event)
 *  2. If token is within 90s of expiry, force a refresh before calling
 *  3. If first call returns 401, refresh token and retry ONCE
 *  4. On persistent 401, show clear error message
 *
 * This eliminates the race condition where getSession() returns a cached
 * expired token between when the SDK refreshes it and when it's persisted.
 */

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/store'
import { toast } from 'sonner'

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Token helper ──────────────────────────────────────────────────────────────
// Reads from Zustand store first (populated by onAuthStateChange → always fresh)
// Falls back to getSession() + proactive refresh if store session is stale.

async function getToken() {
    // Primary path: read from Zustand store (always fresh after onAuthStateChange)
    const storeSession = useStore.getState().session
    if (storeSession?.access_token) {
        const nowSeconds = Math.floor(Date.now() / 1000)
        const expiresAt = storeSession.expires_at ?? 0
        // Token is valid for more than 90 more seconds — use it directly
        if (expiresAt - nowSeconds > 90) {
            return storeSession.access_token
        }
    }

    // Fallback: force a refresh to get a guaranteed fresh token
    try {
        const { data: { session }, error } = await supabase.auth.refreshSession()
        if (error || !session) return null
        return session.access_token
    } catch {
        return null
    }
}

// ── Edge function call with 401-retry ────────────────────────────────────────

async function callEdge(mode, payload, signal) {
    const makeRequest = async (token) => {
        return fetch(EDGE_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ mode, payload }),
            signal,
        })
    }

    const token = await getToken()
    if (!token) throw new Error('NOT_AUTHENTICATED')

    let res = await makeRequest(token)

    // On 401: force refresh token and retry exactly once
    if (res.status === 401) {
        try {
            const { data: { session } } = await supabase.auth.refreshSession()
            if (session?.access_token) {
                res = await makeRequest(session.access_token)
            }
        } catch {
            // Refresh failed — fall through, res is still 401
        }
    }

    // Retry once on 5xx transient server errors
    if (!res.ok && res.status >= 500) {
        await new Promise(r => setTimeout(r, 1200))
        const retryToken = await getToken()
        if (retryToken) res = await makeRequest(retryToken)
    }

    return res
}

// ── State factory ─────────────────────────────────────────────────────────────

function makeSlice() {
    return { data: null, isLoading: false, error: null, isEmpty: false }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useAIFeatures() {
    const [plan, setPlan] = useState(makeSlice())
    const [decompose, setDecompose] = useState(makeSlice())
    const [review, setReview] = useState(makeSlice())
    const [narrate, setNarrate] = useState(makeSlice())

    // Per-mode in-flight guards
    const inFlight = useRef({ plan: false, decompose: false, review: false, narrate: false })

    const setters = { plan: setPlan, decompose: setDecompose, review: setReview, narrate: setNarrate }

    // ── Generic runner ──────────────────────────────────────────────────────────

    const run = useCallback(async (mode, payload) => {
        if (inFlight.current[mode]) return
        inFlight.current[mode] = true

        const set = setters[mode]
        set(prev => ({ ...prev, isLoading: true, error: null, isEmpty: false }))

        try {
            const res = await callEdge(mode, payload, undefined)

            if (res.status === 429) {
                toast.error('Rate limit reached — please wait a moment.')
                set(prev => ({ ...prev, isLoading: false, error: 'Rate limit reached. Please wait.' }))
                return
            }

            if (res.status === 401) {
                set(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Session expired. Please sign out and sign back in.',
                }))
                return
            }

            if (!res.ok) throw new Error(`Edge function error ${res.status}`)

            let data
            try { data = await res.json() } catch { throw new Error('JSON_PARSE_FAILED') }

            if (!data || typeof data !== 'object') throw new Error('INVALID_RESPONSE')

            if (data.error === 'INSUFFICIENT_DATA') {
                set(prev => ({ ...prev, isLoading: false, isEmpty: true, data: null }))
                return
            }

            if (data.error) throw new Error(data.error)

            set(prev => ({ ...prev, isLoading: false, data, error: null, isEmpty: false }))
        } catch (err) {
            if (err.name === 'AbortError') return

            const isAuthErr = err.message === 'NOT_AUTHENTICATED'
            const msg = isAuthErr
                ? 'You must be signed in to use AI features.'
                : 'AI request failed. Please try again.'

            if (import.meta.env.DEV) console.error(`[useAIFeatures:${mode}]`, err)
            set(prev => ({ ...prev, isLoading: false, error: msg, data: null }))
        } finally {
            inFlight.current[mode] = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const generatePlan = useCallback((p) => run('plan', p), [run])
    const generateDecompose = useCallback((p) => run('decompose', p), [run])
    const generateReview = useCallback((p) => run('review', p), [run])
    const generateNarrate = useCallback((p) => run('narrate', p), [run])

    const clearMode = useCallback((mode) => {
        const set = setters[mode]
        if (set) set(makeSlice())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        plan, decompose, review, narrate,
        generatePlan, generateDecompose, generateReview, generateNarrate,
        clearMode,
    }
}
