import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

type ChatRole = 'system' | 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

type RequestBody = {
  messages: ChatMessage[]
  activeProjectId?: string | null
  context?: unknown
}

type ProjectRow = {
  id: string
  name: string
  color: string
  position: number
}

type ColumnRow = {
  id: string
  project_id: string
  name: string
  position: number
}

type TaskRow = {
  id: string
  project_id: string
  column_id: string | null
  parent_task_id: string | null
  title: string
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'backlog' | 'canceled'
  due_date: string | null
  position: number
  created_at: string
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEnv(key: string): string | undefined {
  return Deno.env.get(key)
}

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

function endOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}

function formatDateUTC(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function buildWorkspaceContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  activeProjectId?: string | null
) {
  const [{ data: projects }, { data: columns }, { data: tasks }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,name,color,position')
      .eq('archived', false)
      .order('position', { ascending: true }),
    supabase
      .from('columns')
      .select('id,project_id,name,position')
      .order('position', { ascending: true }),
    supabase
      .from('tasks')
      .select('id,project_id,column_id,parent_task_id,title,priority,status,due_date,position,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const projectRows = (projects ?? []) as ProjectRow[]
  const columnRows = (columns ?? []) as ColumnRow[]
  const taskRows = (tasks ?? []) as TaskRow[]

  const todayStart = startOfTodayUTC()
  const todayEnd = endOfTodayUTC()
  const todayStr = formatDateUTC(todayStart)

  const tasksByProject = new Map<string, TaskRow[]>()
  for (const t of taskRows) {
    if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, [])
    tasksByProject.get(t.project_id)!.push(t)
  }

  const projectSummaries = projectRows.map((p) => {
    const pTasks = tasksByProject.get(p.id) ?? []
    const openTasks = pTasks.filter((t) => t.status !== 'done')
    const overdue = openTasks.filter((t) => t.due_date && new Date(t.due_date) < todayStart)
    const dueToday = openTasks.filter((t) => {
      if (!t.due_date) return false
      const due = new Date(t.due_date)
      return due >= todayStart && due <= todayEnd
    })
    const urgent = openTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high')
    return {
      id: p.id,
      name: p.name,
      openCount: openTasks.length,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      urgentCount: urgent.length,
    }
  })

  const activeProject =
    (activeProjectId && projectRows.find((p) => p.id === activeProjectId)) ?? projectRows[0] ?? null

  const activeColumns = activeProject
    ? columnRows.filter((c) => c.project_id === activeProject.id).sort((a, b) => a.position - b.position)
    : []

  const activeTasks = activeProject ? (tasksByProject.get(activeProject.id) ?? []) : []
  const activeOpenTasks = activeTasks.filter((t) => t.status !== 'done')
  const activeOverdue = activeOpenTasks.filter((t) => t.due_date && new Date(t.due_date) < todayStart)
  const activeDueToday = activeOpenTasks.filter((t) => {
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    return due >= todayStart && due <= todayEnd
  })

  const recentActive = [...activeOpenTasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)

  return {
    userId,
    todayStr,
    activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
    activeColumns: activeColumns.map((c) => ({ id: c.id, name: c.name })),
    activeCounts: {
      open: activeOpenTasks.length,
      overdue: activeOverdue.length,
      dueToday: activeDueToday.length,
    },
    activeHighlights: {
      overdue: activeOverdue.slice(0, 6).map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
      dueToday: activeDueToday.slice(0, 6).map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
      recent: recentActive.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
    },
    workspace: {
      projects: projectSummaries.slice(0, 20),
      totals: {
        projects: projectRows.length,
        tasksLoaded: taskRows.length,
      },
    },
    constraints: {
      maxCreateSubtaskDepth: 3,
      priorityValues: ['none', 'low', 'medium', 'high', 'urgent'],
    },
  }
}

function buildSystemPrompt(workspace: Awaited<ReturnType<typeof buildWorkspaceContext>>): string {
  const tomorrow = new Date(Date.now() + 86400000)
  const activeColumns = workspace.activeColumns.map((c) => c.name).join(' → ') || 'None'
  const activeProjectName = workspace.activeProject?.name ?? 'None'

  return `You are TaskMaster AI, a highly capable personal productivity assistant.
Today is ${workspace.todayStr}.

GOAL:
Help the user plan their day and manage tasks inside their workspace. Be concise, concrete, and prioritize outcomes.

WORKSPACE OVERVIEW:
- Projects: ${workspace.workspace.totals.projects}
- Active project: "${activeProjectName}"
- Active project open tasks: ${workspace.activeCounts.open}
- Active project overdue: ${workspace.activeCounts.overdue}
- Active project due today: ${workspace.activeCounts.dueToday}
- Active columns: ${activeColumns}

ACTIVE PROJECT HIGHLIGHTS:
- Overdue (top): ${workspace.activeHighlights.overdue.length ? workspace.activeHighlights.overdue.map((t) => `"${t.title}"`).join(', ') : 'None'}
- Due today (top): ${workspace.activeHighlights.dueToday.length ? workspace.activeHighlights.dueToday.map((t) => `"${t.title}"`).join(', ') : 'None'}
- Recent open tasks: ${workspace.activeHighlights.recent.length ? workspace.activeHighlights.recent.map((t) => `"${t.title}" (${t.status})`).join(', ') : 'None'}

DAILY PLANNING RULES:
- Suggest a plan with max 5 priority tasks.
- Start with overdue + due today, then highest priority.
- If user provides time budget, allocate time blocks.
- If user asks for a breakdown, propose subtasks (max nested depth ${workspace.constraints.maxCreateSubtaskDepth}).

TASK CREATION FORMAT:
When you need to create tasks, include this EXACT format at the end of your response:

<task_actions>
[
  {
    "type": "create_task",
    "title": "Task title here",
    "description": "Optional description",
    "priority": "none|low|medium|high|urgent",
    "due_date": "${tomorrow.toISOString()}",
    "tags": ["optional", "tags"]
  }
]
</task_actions>

OUTPUT RULES:
- No fluff. Use short bullets.
- Use the user's language and be direct.
- If user asks something unrelated to tasks/productivity, gently redirect.`
}

async function openRouterStream(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const referer = getEnv('OPENROUTER_SITE_URL')
  const title = getEnv('OPENROUTER_APP_NAME')
  if (referer) headers['HTTP-Referer'] = referer
  if (title) headers['X-Title'] = title

  return await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getEnv('SUPABASE_URL') ?? ''
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData?.user
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as RequestBody
    const messages = (body.messages ?? []).filter((m) => m && m.role && typeof m.content === 'string')
    const activeProjectId =
      body.activeProjectId ??
      ((body.context as { activeProjectId?: string | null } | undefined)?.activeProjectId ?? null)

    const apiKey = getEnv('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const model = getEnv('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini'
    const workspace = await buildWorkspaceContext(supabase, user.id, activeProjectId)
    const systemPrompt = buildSystemPrompt(workspace)

    const upstream = await openRouterStream(apiKey, model, messages, systemPrompt)
    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '')
      return new Response(JSON.stringify({ error: 'Upstream error', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let fullContent = ''

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()
        let buffer = ''
        let upstreamDone = false
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const rawLine of lines) {
              const line = rawLine.trim()
              if (!line.startsWith('data:')) continue
              const data = line.slice('data:'.length).trim()
              if (!data) continue
              if (data === '[DONE]') {
                upstreamDone = true
                break
              }

              let parsed: unknown
              try {
                parsed = JSON.parse(data)
              } catch {
                continue
              }

              const deltaText =
                (parsed as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta?.content
              if (typeof deltaText === 'string' && deltaText.length > 0) {
                fullContent += deltaText
                const sseData = JSON.stringify({ type: 'text_delta', text: deltaText })
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
              }
            }

            if (upstreamDone) break
          }

          const taskActionsMatch = fullContent.match(/<task_actions>([\s\S]*?)<\/task_actions>/)
          if (taskActionsMatch) {
            try {
              const actions = JSON.parse(taskActionsMatch[1].trim()) as unknown
              const actionsData = JSON.stringify({ type: 'task_actions', actions })
              controller.enqueue(encoder.encode(`data: ${actionsData}\n\n`))
            } catch {}
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        } finally {
          try { reader.releaseLock() } catch {}
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
