/**
 * CommandPalette.jsx — Cmd+K command palette
 *
 * Features:
 * - Global keyboard shortcut (Cmd/Ctrl + K)
 * - Fuzzy task search (debounced, hits DB via trigram index)
 * - Navigation shortcuts
 * - Quick actions (create task, open AI, etc.)
 * - Arrow key navigation + Enter to select
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Zap,
  LayoutDashboard,
  BarChart2,
  Settings,
  Sparkles,
  Plus,
  ArrowRight,
  Clock,
  Flag,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { searchTasks } from '../../lib/database'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'

const PRIORITY_COLORS = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  medium: 'text-yellow-400',
  low:    'text-blue-400',
  none:   'text-slate-600',
}

const STATIC_ACTIONS = [
  { id: 'nav-dashboard', type: 'nav', icon: LayoutDashboard, label: 'Go to Dashboard', path: '/dashboard', shortcut: 'G D' },
  { id: 'nav-analytics', type: 'nav', icon: BarChart2,       label: 'Go to Analytics',  path: '/analytics',  shortcut: 'G A' },
  { id: 'nav-settings',  type: 'nav', icon: Settings,        label: 'Go to Settings',   path: '/settings',   shortcut: 'G S' },
  { id: 'action-ai',     type: 'action', icon: Sparkles,     label: 'Open AI Assistant', shortcut: 'A I' },
  { id: 'action-add',    type: 'action', icon: Plus,         label: 'Create new task',   shortcut: 'N' },
]

export default function CommandPalette() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  const { commandPaletteOpen, setCommandPaletteOpen, setAIPanelOpen, user } = useStore(useShallow((s) => ({
    commandPaletteOpen: s.commandPaletteOpen,
    setCommandPaletteOpen: s.setCommandPaletteOpen,
    setAIPanelOpen: s.setAIPanelOpen,
    user: s.user,
  })))
  const navigate = useNavigate()

  // Open/close with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandPaletteOpen])

  // Search tasks with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (!query.trim() || query.length < 2) {
      setResults(STATIC_ACTIONS)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      const userId = user?.id
      if (!userId) return

      const { data } = await searchTasks(userId, query)
      const taskResults = (data ?? []).map((task) => ({
        id: task.id,
        type: 'task',
        icon: null,
        label: task.title,
        subtitle: task.projects?.name,
        priority: task.priority,
        due_date: task.due_date,
        task,
      }))

      const filtered = STATIC_ACTIONS.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      )

      setResults([...taskResults, ...filtered])
      setIsSearching(false)
      setSelectedIdx(0)
    }, 200)

    return () => clearTimeout(debounceRef.current)
  }, [query, user])

  // Initialize with static actions
  useEffect(() => {
    setResults(STATIC_ACTIONS)
  }, [])

  const handleSelect = useCallback(
    (item) => {
      setCommandPaletteOpen(false)
      setQuery('')

      if (item.type === 'nav') {
        navigate(item.path)
      } else if (item.type === 'action') {
        if (item.id === 'action-ai') setAIPanelOpen(true)
        if (item.id === 'action-add') {
          // Focus first column's add button
          document.querySelector('[data-add-task]')?.click()
        }
      } else if (item.type === 'task') {
        // TODO: Open task detail modal
      }
    },
    [navigate, setCommandPaletteOpen, setAIPanelOpen]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIdx]) handleSelect(results[selectedIdx])
    }
  }

  if (!commandPaletteOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks or type a command..."
              className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-sm outline-none"
            />
            <kbd className="hidden sm:block text-xs text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No results for &quot;{query}&quot;
              </div>
            ) : (
              <>
                {/* Group tasks if any */}
                {results.some((r) => r.type === 'task') && (
                  <div className="px-3 pb-1">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-2 mb-1">
                      Tasks
                    </p>
                    {results
                      .filter((r) => r.type === 'task')
                      .map((item, idx) => {
                        const globalIdx = results.indexOf(item)
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                              selectedIdx === globalIdx
                                ? 'bg-indigo-500/15 text-white'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <Flag className={`w-3.5 h-3.5 shrink-0 ${PRIORITY_COLORS[item.priority ?? 'none']}`} />
                            <span className="flex-1 text-sm truncate">{item.label}</span>
                            {item.subtitle && (
                              <span className="text-xs text-slate-500">{item.subtitle}</span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          </button>
                        )
                      })}
                  </div>
                )}

                {/* Actions/Nav */}
                {results.some((r) => r.type !== 'task') && (
                  <div className="px-3 pt-1">
                    {results.some((r) => r.type === 'task') && (
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-2 mb-1 mt-2">
                        Actions
                      </p>
                    )}
                    {results
                      .filter((r) => r.type !== 'task')
                      .map((item) => {
                        const globalIdx = results.indexOf(item)
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                              selectedIdx === globalIdx
                                ? 'bg-indigo-500/15 text-white'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
                            </div>
                            <span className="flex-1 text-sm">{item.label}</span>
                            {item.shortcut && (
                              <div className="flex gap-1">
                                {item.shortcut.split(' ').map((k) => (
                                  <kbd
                                    key={k}
                                    className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono"
                                  >
                                    {k}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </button>
                        )
                      })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <kbd className="text-xs bg-slate-800 border border-slate-700 px-1 py-0.5 rounded font-mono">↑↓</kbd>
              <span>navigate</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <kbd className="text-xs bg-slate-800 border border-slate-700 px-1 py-0.5 rounded font-mono">↵</kbd>
              <span>select</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <kbd className="text-xs bg-slate-800 border border-slate-700 px-1 py-0.5 rounded font-mono">ESC</kbd>
              <span>close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
