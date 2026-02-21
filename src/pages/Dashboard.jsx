/**
 * Dashboard.jsx — Main application view
 *
 * Replaces old Dashboard.jsx entirely.
 * - Loads projects + tasks on mount
 * - Activates Realtime WebSocket subscription for active project
 * - Renders Kanban board (or list view when added)
 * - Sidebar with project navigation
 * - Header with search/AI/user menu
 */

import { useEffect, useState } from 'react'
import {
  LayoutGrid,
  List,
  Sparkles,
  Wifi,
  WifiOff,
  Plus,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Zap,
  FolderOpen,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../hooks/useTasks'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { getProjects, getColumns, signOut as dbSignOut } from '../lib/database'
import KanbanBoard from '../components/kanban/KanbanBoard'
import { toast } from 'sonner'

export default function Dashboard() {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const navigate = useNavigate()

  const {
    user,
    profile,
    projects,
    activeProjectId,
    columns,
    tasks,
    wsConnected,
    sidebarOpen,
    activeView,
    clearAuth,
    setProjects,
    setColumns,
    setActiveProject,
    setCommandPaletteOpen,
    setAIPanelOpen,
    setActiveView,
    setSidebarOpen,
    getActiveProject,
  } = useStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    projects: s.projects,
    activeProjectId: s.activeProjectId,
    columns: s.columns,
    tasks: s.tasks,
    wsConnected: s.wsConnected,
    sidebarOpen: s.sidebarOpen,
    activeView: s.activeView,
    clearAuth: s.clearAuth,
    setProjects: s.setProjects,
    setColumns: s.setColumns,
    setActiveProject: s.setActiveProject,
    setCommandPaletteOpen: s.setCommandPaletteOpen,
    setAIPanelOpen: s.setAIPanelOpen,
    setActiveView: s.setActiveView,
    setSidebarOpen: s.setSidebarOpen,
    getActiveProject: s.getActiveProject,
  })))

  const { loadTasks } = useTasks()

  // Activate real WebSocket for active project
  useRealtimeSync(activeProjectId)

  // Load projects on mount
  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    ;(async () => {
      setProjectsLoading(true)
      try {
        const { data, error } = await getProjects(user.id)
        if (!mounted) return
        
        if (error) {
          toast.error('Failed to load projects')
        } else if (data && data.length > 0) {
          setProjects(data)
          // Ensure active project is set if not already
          if (!activeProjectId) {
            setActiveProject(data[0].id)
          }
        } else {
          setProjects([])
        }
      } catch (error) {
        if (!mounted) return
        console.error('Project load error:', error)
        toast.error('Failed to load projects')
      } finally {
        if (mounted) setProjectsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.id, setProjects, activeProjectId, setActiveProject])

  // Load columns + tasks when active project changes
  useEffect(() => {
    if (!activeProjectId) return
    let mounted = true
    ;(async () => {
      try {
        const [colResult] = await Promise.all([getColumns(activeProjectId)])
        if (!mounted) return
        
        if (colResult.error) {
          toast.error('Failed to load columns')
        }
        if (colResult.data) setColumns(activeProjectId, colResult.data)
        await loadTasks(activeProjectId)
      } catch (error) {
        if (!mounted) return
        console.error('Column/Task load error:', error)
        toast.error('Failed to load board data')
      }
    })()
    return () => { mounted = false }
  }, [activeProjectId, setColumns, loadTasks])

  const activeProject = getActiveProject()
  const activeTasks = (tasks[activeProjectId] ?? []).filter((t) => t.status !== 'done')
  const overdueTasks = activeTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  )

  const avatarText = profile?.full_name
    ? profile.full_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? '?'

  const handleSignOut = async () => {
    try {
      await dbSignOut()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* ──────────── SIDEBAR ──────────── */}
      <aside
        className={`shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-white text-sm">TaskMaster</span>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Projects
              </span>
              <button className="p-0.5 rounded text-slate-600 hover:text-slate-400 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {projectsLoading && (
              <div className="px-3 py-2 text-xs text-slate-500">Loading projects...</div>
            )}
            {!projectsLoading && projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">No projects yet.</div>
            )}
            {!projectsLoading && projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProject(project.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all mb-0.5 ${
                  activeProjectId === project.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate flex-1 text-left">{project.name}</span>
                {activeProjectId === project.id && (
                  <span className="text-xs text-slate-500">
                    {(tasks[project.id] ?? []).filter((t) => t.status !== 'done').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar footer — user */}
        <div className="border-t border-slate-800 p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0">
                {avatarText}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {profile?.full_name ?? user?.email}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-12 left-0 right-0 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1">
                  <button
                    onClick={() => { navigate('/settings'); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <div className="h-px bg-slate-700 my-1" />
                  <button
                    onClick={() => { handleSignOut(); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ──────────── MAIN CONTENT ──────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm shrink-0">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Project title */}
          <div className="flex items-center gap-2">
            {activeProject && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeProject.color }}
              />
            )}
            <h1 className="font-semibold text-white text-sm">
              {activeProject?.name ?? 'Select a Project'}
            </h1>
            {overdueTasks.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full">
                {overdueTasks.length} overdue
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* Search shortcut */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-500 hover:text-slate-300 text-xs transition-all"
          >
            <span>Search...</span>
            <kbd className="text-xs bg-slate-700 border border-slate-600 px-1 py-0.5 rounded font-mono">⌘K</kbd>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setActiveView('kanban')}
              className={`p-1.5 rounded-md transition-colors ${activeView === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Kanban view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`p-1.5 rounded-md transition-colors ${activeView === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* WebSocket status */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${
              wsConnected
                ? 'text-emerald-400 bg-emerald-400/10'
                : 'text-slate-500 bg-slate-800'
            }`}
            title={wsConnected ? 'Live sync active' : 'Connecting...'}
          >
            {wsConnected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="hidden sm:block">{wsConnected ? 'Live' : 'Offline'}</span>
          </div>

          {/* AI button */}
          <button
            onClick={() => setAIPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium transition-all shadow-sm shadow-indigo-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:block">AI</span>
          </button>
        </header>

        {/* Board */}
        <main className="flex-1 overflow-hidden">
          {!activeProjectId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <FolderOpen className="w-12 h-12 text-slate-700 mb-3" />
              <h3 className="text-slate-400 font-medium mb-1">No project selected</h3>
              <p className="text-slate-600 text-sm">Choose a project from the sidebar to get started.</p>
            </div>
          ) : (
            <div className="h-full pt-4">
              <KanbanBoard />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
