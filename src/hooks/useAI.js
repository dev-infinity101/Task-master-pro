/**
 * useAI.js — AI Assistant hook
 *
 * Calls Supabase Edge Function which:
 * 1. Reads user's task context from DB
 * 2. Calls Anthropic API with streaming
 * 3. Streams tokens back to frontend
 * 4. Returns structured JSON when AI wants to create tasks
 *
 * Streaming pattern: fetch() with ReadableStream reader
 * Token-by-token rendering for perceived performance.
 */

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bulkCreateTasks } from '../lib/database'
import useStore from '../store/store'
import { toast } from 'sonner'

export function useAI() {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortControllerRef = useRef(null)
  const store = useStore()

  const sendMessage = useCallback(
    async (userMessage, conversationId = null) => {
      if (isStreaming) return

      const userId = store.user?.id
      const activeProjectId = store.activeProjectId
      if (!userId) return

      // Add user message to local state immediately
      const newUserMsg = { role: 'user', content: userMessage, id: Date.now() }
      const updatedMessages = [...messages, newUserMsg]
      setMessages(updatedMessages)
      setIsStreaming(true)
      setStreamingContent('')

      // Build context for AI
      const projectTasks = store.tasks[activeProjectId] ?? []
      const columns = store.columns[activeProjectId] ?? []
      const activeProject = store.getActiveProject()

      const context = {
        userId,
        activeProjectId,
        projectName: activeProject?.name,
        columns: columns.map((c) => ({ id: c.id, name: c.name })),
        taskCount: projectTasks.filter((t) => t.status !== 'done').length,
        overdueTasks: projectTasks
          .filter(
            (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
          )
          .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }))
          .slice(0, 5),
        todaysTasks: projectTasks
          .filter((t) => {
            if (!t.due_date || t.status === 'done') return false
            const due = new Date(t.due_date)
            const today = new Date()
            return due.toDateString() === today.toDateString()
          })
          .map((t) => ({ id: t.id, title: t.title, priority: t.priority }))
          .slice(0, 10),
        recentTasks: projectTasks
          .filter((t) => t.status !== 'done')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10)
          .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
      }

      abortControllerRef.current = new AbortController()

      try {
        // Get fresh JWT token for Edge Function auth
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              messages: updatedMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              context,
            }),
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          throw new Error(`Edge function error: ${response.status}`)
        }

        // Stream response token by token
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let taskActions = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Parse SSE format: "data: {token}\n\n"
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === 'text_delta') {
                  fullContent += parsed.text
                  setStreamingContent(fullContent)
                }

                if (parsed.type === 'task_actions') {
                  taskActions = parsed.actions
                }
              } catch {
                // Non-JSON line, skip
              }
            }
          }
        }

        // Build final assistant message
        const assistantMsg = {
          role: 'assistant',
          content: fullContent,
          id: Date.now(),
          taskActions,
        }

        setMessages((prev) => [...prev, assistantMsg])
        setStreamingContent('')

        // Execute task actions if AI created tasks
        if (taskActions?.length > 0) {
          await executeTaskActions(taskActions, userId, activeProjectId, columns)
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // User cancelled — keep partial content
          if (streamingContent) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: streamingContent + ' _(cancelled)_', id: Date.now() },
            ])
          }
        } else {
          console.error('AI error:', err)
          toast.error('AI assistant is unavailable. Please try again.')
          setMessages((prev) => prev.slice(0, -1)) // Remove failed user message
        }
        setStreamingContent('')
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [messages, isStreaming, store, streamingContent]
  )

  /**
   * Execute structured task creation actions from AI
   */
  const executeTaskActions = useCallback(
    async (actions, userId, projectId, columns) => {
      const todoColumn = columns.find((c) => c.name.toLowerCase() === 'todo')
      if (!todoColumn) return

      const tasksToCreate = actions
        .filter((a) => a.type === 'create_task')
        .map((a, idx) => ({
          user_id: userId,
          project_id: projectId,
          column_id: todoColumn.id,
          title: a.title,
          description: a.description ?? null,
          priority: a.priority ?? 'none',
          status: 'todo',
          due_date: a.due_date ?? null,
          tags: a.tags ?? [],
          position: (idx + 1) * 1000 + Date.now(),
        }))

      if (tasksToCreate.length === 0) return

      const { data, error } = await bulkCreateTasks(tasksToCreate)

      if (error) {
        toast.error(`Failed to create ${tasksToCreate.length} task(s)`)
        return
      }

      store.bulkAddTasks(projectId, data)
      toast.success(
        `✨ Created ${data.length} task${data.length > 1 ? 's' : ''} from AI`
      )
    },
    [store]
  )

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingContent('')
  }, [])

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStream,
    clearMessages,
  }
}
