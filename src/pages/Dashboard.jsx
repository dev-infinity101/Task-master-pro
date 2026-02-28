import { useState, lazy, Suspense } from 'react'
import {
  LayoutGrid,
  List,
  Wifi,
  WifiOff,
  Plus,
  ChevronDown,
  LogOut,
  Settings,
  FolderOpen,
  Search,
  Loader2,
  BarChart2,
  ChevronRight,
} from 'lucide-react'
import EnergyCubeIcon from '../components/ui/EnergyCubeIcon'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { createProjectWithDefaults, signOut as dbSignOut } from '../lib/database'
import KanbanBoard from '../components/kanban/KanbanBoard'
import TaskListView from '../components/list/TaskListView'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import YearProgressBanner from "@/components/ui/YearProgressBanner"
import { useProjectLoader } from '../hooks/useProjectLoader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const PROJECT_COLORS = [
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#f97316',
]

import HourglassLoader from '../components/ui/HourglassLoader'
import TaskMasterLogo from '../components/ui/TaskMasterLogo'
import { cn } from '@/lib/utils'

// Lazy-load the heavy AI features panel
const AIFeaturesPanel = lazy(() => import('../components/ai/AIFeaturesPanel'))

/* ── AI tab loader skeleton ────────────────────────────────────── */
function AILoader() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading AI features…</p>
      </div>
    </div>
  )
}

/* ── Sidebar nav item ────────────────────────────────────────────── */
function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
        active
          ? 'bg-[#111111] text-white shadow-sm'
          : 'text-[#555555] hover:bg-[#F3F4F6] hover:text-[#111111]'
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-white' : 'text-[#888888] group-hover:text-[#111111]')} />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className={cn(
          'text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center',
          active
            ? 'bg-white/20 text-white'
            : 'bg-[#E5E7EB] text-[#555555]'
        )}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function Dashboard() {
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])
  // Dashboard-level view: 'kanban' | 'list' | 'ai'
  const [dashView, setDashView] = useState('kanban')
  const navigate = useNavigate()

  const {
    user,
    profile,
    projects,
    activeProjectId,
    tasks,
    wsConnected,
    clearAuth,
    setProjects,
    setColumns,
    setActiveProject,
    setCommandPaletteOpen,
    getActiveProject,
  } = useStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    projects: s.projects,
    activeProjectId: s.activeProjectId,
    tasks: s.tasks,
    wsConnected: s.wsConnected,
    clearAuth: s.clearAuth,
    setProjects: s.setProjects,
    setColumns: s.setColumns,
    setActiveProject: s.setActiveProject,
    setCommandPaletteOpen: s.setCommandPaletteOpen,
    getActiveProject: s.getActiveProject,
  })))

  // Load projects + columns + tasks via shared hook
  const { loading: projectsLoading } = useProjectLoader()

  // Real-time sync for active project
  useRealtimeSync(activeProjectId)

  if (projectsLoading && projects.length === 0) {
    return <HourglassLoader />
  }

  const activeProject = getActiveProject()
  const activeTasks = (tasks[activeProjectId] ?? []).filter((t) => t.status !== 'done')
  const overdueTasks = activeTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  )

  const displayName = profile?.full_name ?? user?.email ?? 'Account'
  const initials = displayName.charAt(0).toUpperCase()

  const handleCreateProject = async (e) => {
    e?.preventDefault?.()
    if (!user?.id) return

    const name = newProjectName.trim()
    if (!name) return

    setIsCreatingProject(true)
    try {
      const { data, error } = await createProjectWithDefaults(user.id, {
        name,
        color: newProjectColor,
      })

      if (error || !data?.project) {
        toast.error(error?.message ?? 'Failed to create project')
        return
      }

      const { project, columns } = data
      setProjects([...projects, project])
      setColumns(project.id, [...(columns ?? [])].sort((a, b) => a.position - b.position))
      setActiveProject(project.id)

      setCreateProjectOpen(false)
      setNewProjectName('')
      setNewProjectColor(PROJECT_COLORS[0])
      toast.success('Project created')
    } catch (error) {
      console.error('Project create error:', error)
      toast.error('Failed to create project')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await dbSignOut()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  // View tabs config
  const VIEW_TABS = [
    { id: 'kanban', label: 'Board', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
    { id: 'ai', label: 'AI', icon: EnergyCubeIcon },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA] dark:bg-background text-[#111111] dark:text-foreground">

      {/* ──────────── SIDEBAR (permanent, white) ──────────── */}
      <aside className="w-[260px] shrink-0 flex flex-col border-r border-[#E5E7EB] dark:border-[#1F1F1F] bg-white dark:bg-[#0D0D0D]">

        {/* Logo */}
        <div className="flex items-center px-5 h-16 border-b border-[#E5E7EB] dark:border-border">
          <TaskMasterLogo size={32} variant="sidebar" />
        </div>

        {/* Scrollable nav */}
        <ScrollArea className="flex-1 py-4">

          {/* ── PROJECTS ────────────────────────────────── */}
          <div className="px-4 mb-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-[#9CA3AF] dark:text-muted-foreground uppercase tracking-widest">
                Projects
              </span>
              <Dialog
                open={createProjectOpen}
                onOpenChange={(open) => {
                  setCreateProjectOpen(open)
                  if (open) {
                    setNewProjectName('')
                    setNewProjectColor(PROJECT_COLORS[0])
                  }
                }}
              >
                <DialogTrigger asChild>
                  <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] dark:text-muted-foreground hover:text-[#111111] dark:hover:text-foreground hover:bg-[#F3F4F6] dark:hover:bg-accent transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create project</DialogTitle>
                    <DialogDescription>Add a new project to organize your tasks.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProject} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Name</Label>
                      <Input
                        id="project-name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g. Client work"
                        autoFocus
                        disabled={isCreatingProject}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {PROJECT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-7 w-7 rounded-full border-2 transition-all ${newProjectColor === color
                              ? 'border-[#111111] scale-110'
                              : 'border-transparent'
                              }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewProjectColor(color)}
                            aria-label={`Set project color ${color}`}
                          />
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCreateProjectOpen(false)}
                        disabled={isCreatingProject}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="gap-2"
                        disabled={!newProjectName.trim() || isCreatingProject}
                      >
                        {isCreatingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                        Create
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-0.5">
              {projectsLoading && (
                <HourglassLoader fullScreen={false} className="py-2" />
              )}
              {!projectsLoading && projects.length === 0 && (
                <div className="px-2 py-2 text-xs text-[#9CA3AF]">No projects yet.</div>
              )}
              {!projectsLoading && projects.map((project) => {
                const isActive = activeProjectId === project.id
                const pendingCount = (tasks[project.id] ?? []).filter((t) => t.status !== 'done').length
                return (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left',
                      isActive
                        ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] shadow-sm'
                        : 'text-[#555555] dark:text-muted-foreground hover:bg-[#F3F4F6] dark:hover:bg-accent hover:text-[#111111] dark:hover:text-foreground'
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                        isActive ? 'rotate-90' : 'opacity-40 group-hover:opacity-100'
                      )}
                      style={{ color: project.color }}
                    />
                    <span className="truncate flex-1">{project.name}</span>
                    {isActive && pendingCount > 0 && (
                      <span className="text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 dark:bg-black/20 text-white dark:text-[#111111] flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── VIEWS ───────────────────────────────────── */}
          <div className="px-4 mt-5 pb-2">
            <span className="text-[11px] font-bold text-[#9CA3AF] dark:text-muted-foreground uppercase tracking-widest px-2 block mb-2">
              Views
            </span>
            <div className="space-y-0.5">
              <NavItem
                icon={BarChart2}
                label="Analytics"
                active={false}
                onClick={() => navigate('/analytics')}
              />
            </div>
          </div>

        </ScrollArea>

        {/* Sidebar footer — user account */}
        <div className="border-t border-[#E5E7EB] dark:border-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#F3F4F6] dark:hover:bg-accent transition-colors group">
                <Avatar className="h-8 w-8 rounded-full border border-[#E5E7EB] shrink-0">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="rounded-full text-xs font-bold bg-[#111111] dark:bg-white text-white dark:text-[#111111]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-[#111111] dark:text-foreground truncate leading-none mb-0.5">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] dark:text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-[#9CA3AF] dark:text-muted-foreground group-hover:text-[#555555] dark:group-hover:text-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ──────────── MAIN CONTENT ──────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex h-16 items-center gap-4 px-6 border-b border-[#E5E7EB] dark:border-[#1F1F1F] bg-white dark:bg-[#0D0D0D] shrink-0 z-10">

          {/* Project title + color dot */}
          <div className="flex items-center gap-3 min-w-0">
            {activeProject && (
              <ChevronRight
                className="w-4 h-4 shrink-0 opacity-50"
                style={{ color: activeProject.color }}
              />
            )}
            <h1 className="font-bold text-[17px] tracking-tight text-[#111111] dark:text-foreground truncate">
              {activeProject?.name ?? 'Select a Project'}
            </h1>
            {overdueTasks.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-100 dark:border-red-500/20 shrink-0">
                {overdueTasks.length} overdue
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* View tab switcher */}
          <div className="flex items-center bg-[#F3F4F6] dark:bg-secondary p-1 rounded-xl gap-0.5">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setDashView(tab.id)}
                title={tab.label}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  dashView === tab.id
                    ? 'bg-white dark:bg-accent text-[#111111] dark:text-foreground shadow-sm border border-[#E5E7EB] dark:border-border'
                    : 'text-[#888888] dark:text-muted-foreground hover:text-[#555555] dark:hover:text-foreground'
                )}
              >
                <tab.icon className={cn(
                  'w-3.5 h-3.5',
                  tab.id === 'ai' && dashView === tab.id && 'text-primary'
                )} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search shortcut */}
          <div className="hidden sm:flex items-center relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
            <Input
              placeholder="Search tasks…"
              className="pl-8 h-9 bg-[#F3F4F6] dark:bg-secondary border-transparent dark:border-border text-sm placeholder:text-[#9CA3AF] dark:placeholder:text-muted-foreground focus-visible:bg-white dark:focus-visible:bg-accent focus-visible:border-[#E5E7EB] transition-all"
              onClick={() => setCommandPaletteOpen(true)}
              readOnly
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center rounded border border-[#E5E7EB] dark:border-border bg-white dark:bg-card px-1.5 font-mono text-[10px] text-[#9CA3AF] dark:text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          {/* WebSocket status */}
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium transition-colors shrink-0',
              wsConnected
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                : 'bg-[#F3F4F6] dark:bg-secondary text-[#9CA3AF] dark:text-muted-foreground border border-[#E5E7EB] dark:border-border'
            )}
            title={wsConnected ? 'Live sync active' : 'Connecting...'}
          >
            {wsConnected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">{wsConnected ? 'Live' : 'Connecting'}</span>
          </div>
        </header>

        {/* ── Board area ─────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden relative bg-[#F7F8FA] dark:bg-[#0F0F0F]">
          {!activeProjectId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-[#F3F4F6] dark:bg-secondary border border-[#E5E7EB] dark:border-border flex items-center justify-center mb-5">
                <FolderOpen className="w-10 h-10 text-[#D1D5DB] dark:text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-[#111111] dark:text-foreground mb-2">No project selected</h3>
              <p className="text-[#9CA3AF] dark:text-muted-foreground max-w-sm text-sm leading-relaxed">
                Choose a project from the sidebar to start managing your tasks.
              </p>
            </div>
          ) : (
            <>
              {/* Kanban view */}
              {dashView === 'kanban' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <YearProgressBanner displayName={displayName} />
                  <div className="flex-1 overflow-hidden pt-2">
                    <KanbanBoard />
                  </div>
                </div>
              )}

              {/* List view */}
              {dashView === 'list' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <YearProgressBanner displayName={displayName} />
                  <div className="flex-1 overflow-hidden pt-2">
                    <TaskListView />
                  </div>
                </div>
              )}

              {/* AI view */}
              {dashView === 'ai' && (
                <div className="h-full overflow-y-auto">
                  <div className="max-w-2xl mx-auto px-6 py-6 space-y-2">

                    {/* AI tab header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex items-center justify-center overflow-hidden">
                        <EnergyCubeIcon size={32} className="text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[#111111] dark:text-foreground leading-none">AI Intelligence</h2>
                        <p className="text-xs text-[#9CA3AF] dark:text-muted-foreground mt-0.5">Powered by OpenRouter</p>
                      </div>
                    </div>

                    {/* AI Features Panel (lazy) */}
                    <Suspense fallback={<AILoader />}>
                      <AIFeaturesPanel />
                    </Suspense>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
