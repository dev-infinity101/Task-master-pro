/**
 * useAIAnalytics.js — Analytics Narration hook
 *
 * Calls the edge function in 'narrate' mode with analytics metrics.
 * Result is kept fully local — never stored in Zustand.
 */

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`

/**
 * @typedef {{ headline: string, insights: string[] }} NarrateResult
 *
 * @param {object} metricsRef - pass the latest analytics metrics each call
 * @returns {{ result: NarrateResult|null, isLoading: boolean, error: string|null, refresh: (metrics: object) => Promise<void> }}
 */
export function useAIAnalytics() {
    const [result, setResult] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    const refresh = useCallback(async (metrics) => {
        setIsLoading(true)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) throw new Error('Not authenticated')

            const res = await fetch(EDGE_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ mode: 'narrate', payload: metrics }),
            })

            if (res.status === 429) {
                toast.error('Rate limit reached — please wait a moment.')
                return
            }
            if (!res.ok) throw new Error(`Edge function error: ${res.status}`)

            const data = await res.json()

            if (data?.error === 'INSUFFICIENT_DATA') {
                setError('Not enough data to generate insights. Add more tasks and try again.')
                return
            }

            setResult(data)
        } catch (err) {
            console.error('AI analytics narration error:', err)
            setError('AI narration is unavailable. Please try again.')
            toast.error('Could not generate AI analysis.')
        } finally {
            setIsLoading(false)
        }
    }, [])

    return { result, isLoading, error, refresh }
}
