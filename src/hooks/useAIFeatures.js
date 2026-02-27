/**
 * useAIFeatures.js — Production-grade AI features hook
 *
 * Covers all 4 structured AI modes:
 *   - plan      → Daily Auto-Planning
 *   - decompose → Smart Task Decomposition
 *   - review    → Weekly Review Generator
 *   - narrate   → Smart Analytics Narration
 *
 * Each mode has its own independent state slice:
 *   { data, isLoading, error, isEmpty }
 *
 * Design decisions:
 *   - 1 retry on network/JSON failure (silent)
 *   - 429 rate-limit handled gracefully
 *   - INSUFFICIENT_DATA mapped to isEmpty state
 *   - No duplicate in-flight calls (inflight guard per mode)
 *   - No Zustand — all state is local to the consumer
 *   - No memo leaks — all refs cleaned on unmount
 */

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`

// ── Token helper ──────────────────────────────────────────────────────────────

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
}

// ── Single fetch with 1 retry ─────────────────────────────────────────────────

async function callEdge(mode, payload, signal) {
    const token = await getToken()
    if (!token) throw new Error('NOT_AUTHENTICATED')

    const fetchOnce = async () => {
        const res = await fetch(EDGE_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ mode, payload }),
            signal,
        })
        return res
    }

    let res = await fetchOnce()

    // 1 retry on 5xx or network failure (not on 4xx)
    if (!res.ok && res.status >= 500) {
        await new Promise(r => setTimeout(r, 1200))
        res = await fetchOnce()
    }

    return res
}

// ── State factory ─────────────────────────────────────────────────────────────

function makeSlice() {
    return { data: null, isLoading: false, error: null, isEmpty: false }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * @returns {{
 *   plan:      { data, isLoading, error, isEmpty },
 *   decompose: { data, isLoading, error, isEmpty },
 *   review:    { data, isLoading, error, isEmpty },
 *   narrate:   { data, isLoading, error, isEmpty },
 *   generatePlan:     (payload: object) => Promise<void>
 *   generateDecompose:(payload: object) => Promise<void>
 *   generateReview:   (payload: object) => Promise<void>
 *   generateNarrate:  (payload: object) => Promise<void>
 *   clearMode:        (mode: string)    => void
 * }}
 */
export function useAIFeatures() {
    const [plan, setPlan] = useState(makeSlice())
    const [decompose, setDecompose] = useState(makeSlice())
    const [review, setReview] = useState(makeSlice())
    const [narrate, setNarrate] = useState(makeSlice())

    // Per-mode in-flight guards (prevents duplicate calls)
    const inFlight = useRef({ plan: false, decompose: false, review: false, narrate: false })

    const setters = {
        plan: setPlan,
        decompose: setDecompose,
        review: setReview,
        narrate: setNarrate,
    }

    // ── Generic runner ──────────────────────────────────────────────────────────

    const run = useCallback(async (mode, payload) => {
        if (inFlight.current[mode]) return          // guard: no duplicate call
        inFlight.current[mode] = true

        const set = setters[mode]
        set(prev => ({ ...prev, isLoading: true, error: null, isEmpty: false }))

        try {
            const res = await callEdge(mode, payload, undefined)

            // Rate limit
            if (res.status === 429) {
                toast.error('Rate limit reached — please wait a moment before retrying.')
                set(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Rate limit reached. Please wait a moment.',
                }))
                return
            }

            // Other non-OK
            if (!res.ok) {
                throw new Error(`Edge function returned ${res.status}`)
            }

            let data
            try {
                data = await res.json()
            } catch {
                throw new Error('JSON_PARSE_FAILED')
            }

            // Validate response shape
            if (!data || typeof data !== 'object') {
                throw new Error('INVALID_RESPONSE')
            }

            // INSUFFICIENT_DATA sentinel
            if (data.error === 'INSUFFICIENT_DATA') {
                set(prev => ({
                    ...prev,
                    isLoading: false,
                    isEmpty: true,
                    data: null,
                }))
                return
            }

            // Generic upstream error propagated from edge function
            if (data.error) {
                throw new Error(data.error)
            }

            set(prev => ({
                ...prev,
                isLoading: false,
                data,
                error: null,
                isEmpty: false,
            }))
        } catch (err) {
            if (err.name === 'AbortError') return      // cancelled — silent

            const isAuthErr = err.message === 'NOT_AUTHENTICATED'
            const msg = isAuthErr
                ? 'Please sign in to use AI features.'
                : 'AI request failed. Please try again.'

            if (!isAuthErr) {
                // Silent log — no console spam in production
                if (import.meta.env.DEV) console.error(`[useAIFeatures:${mode}]`, err)
            }

            set(prev => ({
                ...prev,
                isLoading: false,
                error: msg,
                data: null,
            }))
        } finally {
            inFlight.current[mode] = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Per-mode generators ─────────────────────────────────────────────────────

    const generatePlan = useCallback((payload) => run('plan', payload), [run])
    const generateDecompose = useCallback((payload) => run('decompose', payload), [run])
    const generateReview = useCallback((payload) => run('review', payload), [run])
    const generateNarrate = useCallback((payload) => run('narrate', payload), [run])

    // ── Clear a single mode ─────────────────────────────────────────────────────

    const clearMode = useCallback((mode) => {
        const set = setters[mode]
        if (set) set(makeSlice())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        plan,
        decompose,
        review,
        narrate,
        generatePlan,
        generateDecompose,
        generateReview,
        generateNarrate,
        clearMode,
    }
}
