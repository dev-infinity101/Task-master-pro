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
import { Avatar, Badge, Button, IconButton, Surface } from '../components/ui/Primitives'

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

  const taskList = tasks[activeProjectId] ?? []
  const statusCounts = taskList.reduce(
    (acc, t) => {
      acc.total += 1
      if (t.status === 'done') acc.done += 1
      else if (t.status === 'in_progress') acc.inProgress += 1
      else acc.todo += 1
      return acc
    },
    { total: 0, todo: 0, inProgress: 0, done: 0 }
  )
  const progressPct = statusCounts.total > 0 ? Math.round((statusCounts.done / statusCounts.total) * 100) : 0
  const displayName = profile?.full_name ?? user?.email ?? 'Account'

  const handleSignOut = async () => {
    try {
      await dbSignOut()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* ──────────── SIDEBAR ──────────── */}
      <aside
        className={`shrink-0 flex flex-col border-r border-white/10 bg-[#0B1220] transition-all duration-300 ${
          sidebarOpen ? 'w-[240px]' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[60px] border-b border-white/10">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 shadow-[0_10px_30px_rgba(37,99,235,0.25)]">
            <Zap className="h-4 w-4 text-white" fill="currentColor" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">TaskMaster</div>
            <div className="text-xs text-slate-400">Workspace</div>
          </div>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Projects
              </span>
              <IconButton label="New project" className="h-8 w-8" onClick={() => toast('Project creation coming soon')}>
                <Plus className="h-4 w-4" />
              </IconButton>
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
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all mb-1 ${
                  activeProjectId === project.id
                    ? 'bg-white/5 text-white border-l-4 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-4 border-transparent'
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
        <div className="border-t border-white/10 p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Avatar name={displayName} src={profile?.avatar_url} className="h-8 w-8 rounded-lg" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {displayName}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-12 left-0 right-0 z-20 bg-[#0B1220] border border-white/10 rounded-xl shadow-xl py-1">
                  <button
                    onClick={() => { navigate('/settings'); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <div className="h-px bg-white/10 my-1" />
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
        <header className="flex h-[60px] items-center gap-4 px-6 border-b border-white/10 bg-black/60 backdrop-blur-sm shrink-0">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
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
              <Badge tone="red">{overdueTasks.length} overdue</Badge>
            )}
          </div>

          <div className="flex-1" />

          {/* Search shortcut */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 h-10 bg-white/5 border border-white/10 hover:border-white/15 rounded-xl text-slate-400 hover:text-slate-200 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span>Search...</span>
            <kbd className="text-xs bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300">⌘K</kbd>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setActiveView('kanban')}
              className={`p-2 rounded-lg transition-colors ${activeView === 'kanban' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Kanban view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`p-2 rounded-lg transition-colors ${activeView === 'list' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
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
                : 'text-slate-400 bg-white/5 border border-white/10'
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
          <Button
            onClick={() => setAIPanelOpen(true)}
            size="sm"
            className="px-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:block">AI</span>
          </Button>
        </header>

        {/* Board */}
        <main className="flex-1 overflow-hidden">
          {!activeProjectId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <FolderOpen className="w-12 h-12 text-slate-700 mb-3" />
              <h3 className="text-slate-300 font-medium mb-1">No project selected</h3>
              <p className="text-slate-500 text-sm">Choose a project from the sidebar to get started.</p>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Surface className="p-5">
                    <div className="text-xs text-slate-400">Total tasks</div>
                    <div className="mt-2 text-2xl font-bold text-white">{statusCounts.total}</div>
                  </Surface>
                  <Surface className="p-5">
                    <div className="text-xs text-slate-400">In progress</div>
                    <div className="mt-2 text-2xl font-bold text-white">{statusCounts.inProgress}</div>
                  </Surface>
                  <Surface className="p-5">
                    <div className="text-xs text-slate-400">Done</div>
                    <div className="mt-2 text-2xl font-bold text-white">{statusCounts.done}</div>
                  </Surface>
                  <Surface className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-400">Progress</div>
                      <div className="text-xs text-slate-300">{progressPct}%</div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Done
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-white/20" />
                        Remaining
                      </span>
                    </div>
                  </Surface>
                </div>
              </div>

              <div className="h-[calc(100%-136px)] pt-2">
                <KanbanBoard />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
