/**
 * useProjectLoader.js
 *
 * Shared hook that loads projects, columns, and tasks into the Zustand store.
 * Call this from any page that needs project data (Dashboard, Analytics).
 * It's safe to call from multiple places — the store deduplicates state.
 */

import { useEffect, useState } from 'react'
import { getProjects, getColumns } from '../lib/database'
import { useTasks } from './useTasks'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'

export function useProjectLoader() {
    const [loading, setLoading] = useState(false)

    const { user, activeProjectId, setProjects, setColumns, setActiveProject } = useStore(
        useShallow((s) => ({
            user: s.user,
            activeProjectId: s.activeProjectId,
            setProjects: s.setProjects,
            setColumns: s.setColumns,
            setActiveProject: s.setActiveProject,
        }))
    )

    const { loadTasks } = useTasks()

    // Load projects list on mount / user change
    useEffect(() => {
        if (!user?.id) return
        let mounted = true
            ; (async () => {
                setLoading(true)
                try {
                    const { data, error } = await getProjects(user.id)
                    if (!mounted) return
                    if (error) {
                        toast.error('Failed to load projects')
                        return
                    }
                    if (data && data.length > 0) {
                        setProjects(data)
                        if (!activeProjectId) setActiveProject(data[0].id)
                    } else {
                        setProjects([])
                    }
                } catch (err) {
                    if (!mounted) return
                    console.error('Project load error:', err)
                } finally {
                    if (mounted) setLoading(false)
                }
            })()
        return () => { mounted = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])

    // Load columns + tasks when active project changes
    useEffect(() => {
        if (!activeProjectId) return
        let mounted = true
            ; (async () => {
                try {
                    const { data, error } = await getColumns(activeProjectId)
                    if (!mounted) return
                    if (error) {
                        toast.error('Failed to load columns')
                        return
                    }
                    if (data) setColumns(activeProjectId, data)
                    await loadTasks(activeProjectId)
                } catch (err) {
                    if (!mounted) return
                    console.error('Column/task load error:', err)
                }
            })()
        return () => { mounted = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId])

    return { loading }
}
