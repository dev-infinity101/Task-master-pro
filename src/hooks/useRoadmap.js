/**
 * useRoadmap.js  -  Fetches and manages roadmap_months data
 *
 * Fetches all 12 months for the active project in one query.
 * Creates rows on-demand when user edits a month.
 * Subscribes to Supabase Realtime for live updates.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import useStore from '../store/store'
import { supabase } from '../lib/supabase'

export function useRoadmap(projectId, year) {
    const user = useStore((s) => s.user)
    const [months, setMonths] = useState([]) // array of roadmap_month rows
    const [loading, setLoading] = useState(true)

    // Fetch all months for this project+year in one query
    const fetchMonths = useCallback(async () => {
        if (!projectId || !user?.id) return
        setLoading(true)
        const { data, error } = await supabase
            .from('roadmap_months')
            .select('*')
            .eq('user_id', user.id)
            .eq('project_id', projectId)
            .eq('year', year)
            .order('month', { ascending: true })

        if (error) {
            toast.error('Failed to load roadmap')
        } else {
            setMonths(data ?? [])
        }
        setLoading(false)
    }, [projectId, user?.id, year])

    useEffect(() => {
        fetchMonths()
    }, [fetchMonths])

    // Realtime subscription
    useEffect(() => {
        if (!projectId || !user?.id) return
        const channel = supabase
            .channel(`roadmap_${projectId}_${year}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'roadmap_months',
                    filter: `project_id=eq.${projectId}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setMonths((prev) => {
                            const idx = prev.findIndex((m) => m.id === payload.new.id)
                            if (idx !== -1) {
                                const next = [...prev]
                                next[idx] = payload.new
                                return next
                            }
                            return [...prev, payload.new].sort((a, b) => a.month - b.month)
                        })
                    } else if (payload.eventType === 'DELETE') {
                        setMonths((prev) => prev.filter((m) => m.id !== payload.old.id))
                    }
                }
            )
            .subscribe()
        return () => supabase.removeChannel(channel)
    }, [projectId, user?.id, year])

    // Upsert a month row (create if not exist, update if exists)
    const upsertMonth = useCallback(
        async (monthNumber, updates) => {
            if (!user?.id || !projectId) return null

            const existing = months.find((m) => m.month === monthNumber)

            if (existing) {
                // Optimistic update
                setMonths((prev) =>
                    prev.map((m) =>
                        m.month === monthNumber
                            ? { ...m, ...updates, updated_at: new Date().toISOString() }
                            : m
                    )
                )
                const { data, error } = await supabase
                    .from('roadmap_months')
                    .update({ ...updates, updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single()
                if (error) {
                    // Rollback optimistic
                    setMonths((prev) =>
                        prev.map((m) => (m.month === monthNumber ? existing : m))
                    )
                    toast.error('Failed to save roadmap')
                    return null
                }
                return data
            } else {
                // Insert new row
                const newRow = {
                    user_id: user.id,
                    project_id: projectId,
                    year,
                    month: monthNumber,
                    color_accent: '#6366f1',
                    ...updates,
                }
                const { data, error } = await supabase
                    .from('roadmap_months')
                    .insert(newRow)
                    .select()
                    .single()
                if (error) {
                    toast.error('Failed to save roadmap')
                    return null
                }
                setMonths((prev) =>
                    [...prev, data].sort((a, b) => a.month - b.month)
                )
                return data
            }
        },
        [user?.id, projectId, year, months]
    )

    return { months, loading, upsertMonth, refetch: fetchMonths }
}
