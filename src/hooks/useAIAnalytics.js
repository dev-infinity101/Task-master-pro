/**
 * useAIAnalytics.js — Analytics page narration hook
 *
 * Thin wrapper around useAIFeatures({ narrate }) so the
 * Analytics page doesn't need to import useAIFeatures directly.
 * Keeps the API surface identical to what Analytics.jsx already expects:
 *   { result, isLoading, error, isEmpty, refresh }
 */

import { useCallback } from 'react'
import { useAIFeatures } from './useAIFeatures'

export function useAIAnalytics() {
    const { narrate, generateNarrate, clearMode } = useAIFeatures()

    const refresh = useCallback((metrics) => {
        return generateNarrate(metrics)
    }, [generateNarrate])

    const clear = useCallback(() => clearMode('narrate'), [clearMode])

    return {
        result: narrate.data,
        isLoading: narrate.isLoading,
        error: narrate.error,
        isEmpty: narrate.isEmpty,
        refresh,
        clear,
    }
}
