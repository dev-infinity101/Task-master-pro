import { useState } from 'react'
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
} from 'lucide-react'
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

export default function Dashboard() {
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])
  const navigate = useNavigate()

  const {
    user,
    profile,
    projects,
    activeProjectId,
    tasks,
    wsConnected,
    sidebarOpen,
    activeView,
    clearAuth,
    setProjects,
    setColumns,
    setActiveProject,
    setCommandPaletteOpen,
    setActiveView,
    setSidebarOpen,
    getActiveProject,
  } = useStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    projects: s.projects,
    activeProjectId: s.activeProjectId,
    tasks: s.tasks,
    wsConnected: s.wsConnected,
    sidebarOpen: s.sidebarOpen,
    activeView: s.activeView,
    clearAuth: s.clearAuth,
    setProjects: s.setProjects,
    setColumns: s.setColumns,
    setActiveProject: s.setActiveProject,
    setCommandPaletteOpen: s.setCommandPaletteOpen,
    setActiveView: s.setActiveView,
    setSidebarOpen: s.setSidebarOpen,
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

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-foreground">
      {/* ──────────── SIDEBAR ──────────── */}
      <aside
        className={`shrink-0 flex flex-col border-r bg-card/50 transition-all duration-300 ${sidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center px-5 h-16 border-b">
          <TaskMasterLogo size={32} variant="sidebar" />
        </div>

        {/* Projects */}
        <ScrollArea className="flex-1 py-4">
          <div className="px-4 mb-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-3 w-3" />
                  </Button>
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
                            className={`h-7 w-7 rounded-full border ${newProjectColor === color
                              ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                              : ''
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

            <div className="space-y-1">
              {projectsLoading && (
                <HourglassLoader fullScreen={false} className="py-2" />
              )}
              {!projectsLoading && projects.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">No projects yet.</div>
              )}
              {!projectsLoading && projects.map((project) => (
                <Button
                  key={project.id}
                  variant="ghost"
                  onClick={() => setActiveProject(project.id)}
                  className={`w-full justify-start gap-3 px-3 font-normal ${activeProjectId === project.id
                    ? 'bg-accent text-accent-foreground border-l-2 border-primary rounded-l-none'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate flex-1 text-left">{project.name}</span>
                  {activeProjectId === project.id && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 min-w-5 justify-center">
                      {(tasks[project.id] ?? []).filter((t) => t.status !== 'done').length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Nav shortcuts */}
          <div className="px-4 mt-4 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 block mb-2">Views</span>
            <Button
              variant="ghost"
              onClick={() => navigate('/analytics')}
              className="w-full justify-start gap-3 px-3 font-normal text-muted-foreground hover:text-foreground"
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Analytics</span>
            </Button>
          </div>
        </ScrollArea>

        {/* Sidebar footer — user */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-2 h-12 hover:bg-accent">
                <Avatar className="h-8 w-8 rounded-full border">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate leading-none mb-1">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 px-6 border-b bg-card shrink-0 z-10">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          {/* Project title */}
          <div className="flex items-center gap-3">
            {activeProject && (
              <div
                className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-background"
                style={{ backgroundColor: activeProject.color }}
              />
            )}
            <h1 className="font-semibold text-lg tracking-tight">
              {activeProject?.name ?? 'Select a Project'}
            </h1>
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overdueTasks.length} overdue
              </Badge>
            )}
          </div>

          <div className="flex-1" />

          {/* View Switcher */}
          <div className="hidden md:flex items-center bg-muted/20 p-1 rounded-lg border border-border mr-4">
            <Button
              variant={activeView === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('kanban')}
              className="h-8 w-8 p-0"
              title="Board View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={activeView === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveView('list')}
              className="h-8 w-8 p-0"
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Search shortcut */}
          <div className="hidden sm:flex items-center relative max-w-md w-full mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 h-9 bg-secondary/50 border-transparent focus-visible:bg-background focus-visible:border-ring transition-all"
              onClick={() => setCommandPaletteOpen(true)}
              readOnly
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-secondary/50 rounded-lg p-1 border">
              <Button
                variant={activeView === 'kanban' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={() => setActiveView('kanban')}
                title="Kanban view"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={activeView === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={() => setActiveView('list')}
                title="List view"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* WebSocket status */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium transition-colors ${wsConnected
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-muted text-muted-foreground'
                }`}
              title={wsConnected ? 'Live sync active' : 'Connecting...'}
            >
              {wsConnected ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
        </header>

        {/* Board */}
        <main className="flex-1 overflow-hidden relative">
          {!activeProjectId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-6 bg-muted/30 rounded-full mb-4">
                <FolderOpen className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No project selected</h3>
              <p className="text-muted-foreground max-w-sm">Choose a project from the sidebar to start managing your tasks.</p>
            </div>
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              <YearProgressBanner displayName={displayName} />
              <div className="flex-1 overflow-hidden pt-2">
                {activeView === 'list' ? (
                  <TaskListView />
                ) : (
                  <KanbanBoard />
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
