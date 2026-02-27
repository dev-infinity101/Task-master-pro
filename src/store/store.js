/**
 * store.js — Global Zustand store
 *
 * Architecture:
 * - Auth slice: real Supabase session, not a boolean flag
 * - Tasks slice: server-synced with optimistic updates + rollback
 * - UI slice: theme, sidebar, active project — NOT persisted (session-only)
 * - Projects/Columns: cached from DB, invalidated on Realtime events
 *
 * Persistence: only auth token is persisted (Supabase handles this internally).
 * Tasks are NOT persisted in localStorage — they come from the DB.
 * This prevents stale data bugs across devices/sessions.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    immer((set, get) => ({
      // ─────────────────────────────────────────
      // AUTH SLICE
      // ─────────────────────────────────────────
      session: null,        // Supabase session object
      user: null,           // auth.users row
      profile: null,        // profiles table row (full_name, avatar, timezone)
      authLoading: true,    // true during initial session check

      setSession: (session) =>
        set((state) => {
          state.session = session
          state.user = session?.user ?? null
          state.authLoading = false
        }),

      setProfile: (profile) =>
        set((state) => {
          state.profile = profile
        }),

      setAuthLoading: (loading) =>
        set((state) => {
          state.authLoading = loading
        }),

      clearAuth: () =>
        set((state) => {
          state.session = null
          state.user = null
          state.profile = null
          state.authLoading = false
        }),

      // ─────────────────────────────────────────
      // PROJECTS SLICE
      // ─────────────────────────────────────────
      projects: [],
      activeProjectId: null,
      projectsLoading: false,

      setProjects: (projects) =>
        set((state) => {
          state.projects = projects
          // Auto-select first project if none selected
          if (!state.activeProjectId && projects.length > 0) {
            state.activeProjectId = projects[0].id
          }
        }),

      setActiveProject: (projectId) =>
        set((state) => {
          state.activeProjectId = projectId
        }),

      addProject: (project) =>
        set((state) => {
          state.projects.push(project)
        }),

      updateProject: (projectId, updates) =>
        set((state) => {
          const idx = state.projects.findIndex((p) => p.id === projectId)
          if (idx !== -1) Object.assign(state.projects[idx], updates)
        }),

      removeProject: (projectId) =>
        set((state) => {
          state.projects = state.projects.filter((p) => p.id !== projectId)
          if (state.activeProjectId === projectId) {
            state.activeProjectId = state.projects[0]?.id ?? null
          }
        }),

      // ─────────────────────────────────────────
      // COLUMNS SLICE
      // ─────────────────────────────────────────
      // columns[projectId] = Column[]
      columns: {},
      columnsLoading: false,

      setColumns: (projectId, columns) =>
        set((state) => {
          state.columns[projectId] = columns
        }),

      addColumn: (projectId, column) =>
        set((state) => {
          if (!state.columns[projectId]) state.columns[projectId] = []
          state.columns[projectId].push(column)
        }),

      updateColumn: (projectId, columnId, updates) =>
        set((state) => {
          const cols = state.columns[projectId]
          if (!cols) return
          const idx = cols.findIndex((c) => c.id === columnId)
          if (idx !== -1) Object.assign(cols[idx], updates)
        }),

      removeColumn: (projectId, columnId) =>
        set((state) => {
          if (state.columns[projectId]) {
            state.columns[projectId] = state.columns[projectId].filter(
              (c) => c.id !== columnId
            )
          }
        }),

      // ─────────────────────────────────────────
      // TASKS SLICE
      // ─────────────────────────────────────────
      // tasks[projectId] = Task[]  (flat array, tree reconstructed in selectors)
      tasks: {},
      tasksLoading: false,
      // Snapshot for optimistic rollback: { [taskId]: Task }
      _taskSnapshots: {},

      setTasks: (projectId, tasks) =>
        set((state) => {
          state.tasks[projectId] = tasks
        }),

      setTasksLoading: (loading) =>
        set((state) => {
          state.tasksLoading = loading
        }),

      // Optimistic add — caller provides a temp task with a temp id
      optimisticAddTask: (projectId, task) =>
        set((state) => {
          if (!state.tasks[projectId]) state.tasks[projectId] = []
          state.tasks[projectId].push(task)
        }),

      // Confirm add — replace temp task with server response
      confirmAddTask: (projectId, tempId, serverTask) =>
        set((state) => {
          const tasks = state.tasks[projectId]
          if (!tasks) return
          const idx = tasks.findIndex((t) => t.id === tempId)
          if (idx !== -1) tasks[idx] = serverTask
          else tasks.push(serverTask)
        }),

      // Rollback add on error
      rollbackAddTask: (projectId, tempId) =>
        set((state) => {
          if (state.tasks[projectId]) {
            state.tasks[projectId] = state.tasks[projectId].filter(
              (t) => t.id !== tempId
            )
          }
        }),

      // Optimistic update — snapshot original, apply update immediately
      optimisticUpdateTask: (projectId, taskId, updates) =>
        set((state) => {
          const tasks = state.tasks[projectId]
          if (!tasks) return
          const idx = tasks.findIndex((t) => t.id === taskId)
          if (idx === -1) return
          // Save snapshot for rollback
          state._taskSnapshots[taskId] = { ...tasks[idx] }
          Object.assign(tasks[idx], updates)
        }),

      // Confirm update — clear snapshot
      confirmUpdateTask: (taskId) =>
        set((state) => {
          delete state._taskSnapshots[taskId]
        }),

      // Rollback update — restore from snapshot
      rollbackUpdateTask: (projectId, taskId) =>
        set((state) => {
          const snapshot = state._taskSnapshots[taskId]
          const tasks = state.tasks[projectId]
          if (!snapshot || !tasks) return
          const idx = tasks.findIndex((t) => t.id === taskId)
          if (idx !== -1) tasks[idx] = snapshot
          delete state._taskSnapshots[taskId]
        }),

      // Optimistic delete
      optimisticDeleteTask: (projectId, taskId) =>
        set((state) => {
          const tasks = state.tasks[projectId]
          if (!tasks) return
          const task = tasks.find((t) => t.id === taskId)
          if (task) state._taskSnapshots[taskId] = { ...task }
          state.tasks[projectId] = tasks.filter((t) => t.id !== taskId)
          // Also remove subtasks
          state.tasks[projectId] = state.tasks[projectId].filter(
            (t) => t.parent_task_id !== taskId
          )
        }),

      rollbackDeleteTask: (projectId, taskId) =>
        set((state) => {
          const snapshot = state._taskSnapshots[taskId]
          if (!snapshot) return
          if (!state.tasks[projectId]) state.tasks[projectId] = []
          state.tasks[projectId].push(snapshot)
          delete state._taskSnapshots[taskId]
        }),

      // Realtime sync — upsert a task received from WebSocket
      realtimeUpsertTask: (projectId, task) =>
        set((state) => {
          if (!state.tasks[projectId]) state.tasks[projectId] = []
          const idx = state.tasks[projectId].findIndex((t) => t.id === task.id)
          if (idx !== -1) {
            state.tasks[projectId][idx] = task
          } else {
            state.tasks[projectId].push(task)
          }
        }),

      // Realtime delete — remove a task from WebSocket DELETE event
      realtimeDeleteTask: (projectId, taskId) =>
        set((state) => {
          if (state.tasks[projectId]) {
            state.tasks[projectId] = state.tasks[projectId].filter(
              (t) => t.id !== taskId
            )
          }
        }),

      // Bulk insert (AI assistant creating multiple tasks)
      bulkAddTasks: (projectId, tasks) =>
        set((state) => {
          if (!state.tasks[projectId]) state.tasks[projectId] = []
          state.tasks[projectId].push(...tasks)
        }),

      // ─────────────────────────────────────────
      // UI SLICE (theme persisted to localStorage)
      // ─────────────────────────────────────────
      theme: (() => {
        try { return localStorage.getItem('tm-theme') || 'light' } catch { return 'light' }
      })(),
      sidebarOpen: true,
      activeView: 'kanban',      // 'kanban' | 'list' | 'analytics'
      commandPaletteOpen: false,
      aiPanelOpen: false,
      wsConnected: false,

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme
          try { localStorage.setItem('tm-theme', theme) } catch { }
        }),

      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open
        }),

      setActiveView: (view) =>
        set((state) => {
          state.activeView = view
        }),

      setCommandPaletteOpen: (open) =>
        set((state) => {
          state.commandPaletteOpen = open
        }),

      setAIPanelOpen: (open) =>
        set((state) => {
          state.aiPanelOpen = open
        }),

      setWsConnected: (connected) =>
        set((state) => {
          state.wsConnected = connected
        }),

      // ─────────────────────────────────────────
      // SELECTORS (derived state — computed on access)
      // ─────────────────────────────────────────

      // Get tasks for active project grouped by column
      getTasksByColumn: () => {
        const state = get()
        const { activeProjectId, tasks, columns } = state
        if (!activeProjectId) return {}

        const projectTasks = tasks[activeProjectId] ?? []
        const projectColumns = columns[activeProjectId] ?? []

        const result = {}
        projectColumns.forEach((col) => {
          result[col.id] = projectTasks
            .filter((t) => t.column_id === col.id && !t.parent_task_id)
            .sort((a, b) => a.position - b.position)
        })
        return result
      },

      // Get subtasks for a given task
      getSubtasks: (taskId) => {
        const state = get()
        const { activeProjectId, tasks } = state
        if (!activeProjectId) return []
        return (tasks[activeProjectId] ?? [])
          .filter((t) => t.parent_task_id === taskId)
          .sort((a, b) => a.position - b.position)
      },

      // Get active project object
      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return projects.find((p) => p.id === activeProjectId) ?? null
      },

      // Get active project's columns
      getActiveColumns: () => {
        const { columns, activeProjectId } = get()
        return activeProjectId ? (columns[activeProjectId] ?? []) : []
      },
    })),
    { name: 'TaskMasterStore' }
  )
)

export default useStore
