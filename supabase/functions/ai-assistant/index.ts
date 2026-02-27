import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRole = 'system' | 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }
type AiMode = 'chat' | 'plan' | 'decompose' | 'review' | 'narrate'

type RequestBody = {
  messages: ChatMessage[]
  mode?: AiMode
  payload?: Record<string, unknown>      // structured data for non-chat modes
  activeProjectId?: string | null
  context?: unknown
}

type ProjectRow = { id: string; name: string; color: string; position: number }
type ColumnRow = { id: string; project_id: string; name: string; position: number }
type TaskRow = {
  id: string; project_id: string; column_id: string | null
  parent_task_id: string | null; title: string
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'backlog' | 'canceled'
  due_date: string | null; position: number; created_at: string
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Rate Limiter (in-memory, per-instance) ───────────────────────────────────
// Resets when the edge function instance cold-starts. Good enough for free tier abuse prevention.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5       // max requests
const RATE_WINDOW = 60_000  // 1 minute in ms

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const rec = rateLimitMap.get(userId)
  if (!rec || now > rec.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  rec.count++
  if (rec.count > RATE_LIMIT) return true
  return false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEnv(key: string): string | undefined { return Deno.env.get(key) }

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function endOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}

function formatDateUTC(d: Date): string { return d.toISOString().split('T')[0] }

// ─── Workspace Context Builder ────────────────────────────────────────────────

async function buildWorkspaceContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  activeProjectId?: string | null
) {
  const [{ data: projects }, { data: columns }, { data: tasks }] = await Promise.all([
    supabase.from('projects').select('id,name,color,position').eq('archived', false).order('position'),
    supabase.from('columns').select('id,project_id,name,position').order('position'),
    supabase.from('tasks')
      .select('id,project_id,column_id,parent_task_id,title,priority,status,due_date,position,created_at')
      .order('created_at', { ascending: false }).limit(500),
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

  const activeProject =
    (activeProjectId && projectRows.find(p => p.id === activeProjectId)) ?? projectRows[0] ?? null

  const activeColumns = activeProject
    ? columnRows.filter(c => c.project_id === activeProject.id).sort((a, b) => a.position - b.position)
    : []

  const activeTasks = activeProject ? (tasksByProject.get(activeProject.id) ?? []) : []
  const activeOpenTasks = activeTasks.filter(t => t.status !== 'done' && t.status !== 'canceled')
  const activeOverdue = activeOpenTasks.filter(t => t.due_date && new Date(t.due_date) < todayStart)
  const activeDueToday = activeOpenTasks.filter(t => {
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    return due >= todayStart && due <= todayEnd
  })
  const recentActive = [...activeOpenTasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)

  const projectSummaries = projectRows.map(p => {
    const pTasks = tasksByProject.get(p.id) ?? []
    const open = pTasks.filter(t => t.status !== 'done')
    const overdue = open.filter(t => t.due_date && new Date(t.due_date) < todayStart)
    const dueToday = open.filter(t => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d >= todayStart && d <= todayEnd
    })
    return { id: p.id, name: p.name, openCount: open.length, overdueCount: overdue.length, dueTodayCount: dueToday.length }
  })

  return {
    userId, todayStr,
    activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
    activeColumns: activeColumns.map(c => ({ id: c.id, name: c.name })),
    activeCounts: { open: activeOpenTasks.length, overdue: activeOverdue.length, dueToday: activeDueToday.length },
    activeHighlights: {
      overdue: activeOverdue.slice(0, 6).map(t => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
      dueToday: activeDueToday.slice(0, 6).map(t => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
      recent: recentActive.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
    },
    workspace: {
      projects: projectSummaries.slice(0, 20),
      totals: { projects: projectRows.length, tasksLoaded: taskRows.length },
    },
    constraints: { maxCreateSubtaskDepth: 3, priorityValues: ['none', 'low', 'medium', 'high', 'urgent'] },
  }
}

// ─── System Prompts ───────────────────────────────────────────────────────────

type WorkspaceCtx = Awaited<ReturnType<typeof buildWorkspaceContext>>

function buildChatSystemPrompt(workspace: WorkspaceCtx): string {
  const tomorrow = new Date(Date.now() + 86_400_000)
  const activeColumns = workspace.activeColumns.map(c => c.name).join(' → ') || 'None'
  const activeProject = workspace.activeProject?.name ?? 'None'

  return `You are TaskMaster AI, a personal productivity assistant.
Today is ${workspace.todayStr}.

WORKSPACE:
- Active project: "${activeProject}"
- Open tasks: ${workspace.activeCounts.open}
- Overdue: ${workspace.activeCounts.overdue}
- Due today: ${workspace.activeCounts.dueToday}
- Columns: ${activeColumns}

HIGHLIGHTS:
- Overdue: ${workspace.activeHighlights.overdue.length ? workspace.activeHighlights.overdue.map(t => `"${t.title}"`).join(', ') : 'None'}
- Due today: ${workspace.activeHighlights.dueToday.length ? workspace.activeHighlights.dueToday.map(t => `"${t.title}"`).join(', ') : 'None'}
- Recent open: ${workspace.activeHighlights.recent.length ? workspace.activeHighlights.recent.map(t => `"${t.title}" (${t.status})`).join(', ') : 'None'}

RULES:
- Be concise. Use short bullets.
- No fluff or motivational language.
- Redirect off-topic questions gently.
- Suggest max 5 priority tasks for daily plans.
- If the response cannot be generated safely, return: {"error":"INSUFFICIENT_DATA"}

TASK CREATION FORMAT:
When creating tasks, append this EXACT block at the end:
<task_actions>
[
  {
    "type": "create_task",
    "title": "Task title here",
    "description": "Optional description",
    "priority": "none|low|medium|high|urgent",
    "due_date": "${tomorrow.toISOString()}",
    "tags": []
  }
]
</task_actions>`
}

const PLAN_SYSTEM_PROMPT = `You are TaskMaster AI.

Role: Senior productivity strategist.

Objective: Create a realistic daily execution plan using ONLY the provided task data.

STRICT RULES:
- Do not create new tasks.
- Do not modify task titles.
- Use only tasks with status = "todo".
- Select maximum 3 tasks for "must_do".
- Prioritize overdue tasks first.
- Then prioritize high priority tasks.
- Consider due_date and estimated_minutes.
- Total planned effort must not exceed average_daily_capacity_minutes.
- Be concise.
- No motivational language.
- Output must be valid minified JSON.
- No explanation outside JSON.
- If no todo tasks exist, return empty arrays.
- If the response cannot be generated safely, return: {"error":"INSUFFICIENT_DATA"}`

const DECOMPOSE_SYSTEM_PROMPT = `You are TaskMaster AI.

Role: Execution-focused task breakdown specialist.

Objective: Convert a vague task into 4–8 concrete, sequential subtasks.

RULES:
- Each subtask must start with a strong action verb.
- Maximum 15 words per subtask.
- No vague verbs (improve, optimize, handle, work on).
- Subtasks must be logically ordered.
- Do not repeat words unnecessarily.
- Do not include explanations.
- Return valid JSON only.
- No markdown formatting.
- If the response cannot be generated safely, return: {"error":"INSUFFICIENT_DATA"}`

const REVIEW_SYSTEM_PROMPT = `You are TaskMaster AI.

Role: Productivity performance analyst.

Objective: Analyze weekly task metrics and generate structured insights.

RULES:
- Be analytical and concise.
- Base insights strictly on provided metrics.
- Highlight numerical changes.
- Identify productivity distribution trends.
- Provide 2–3 actionable recommendations.
- Avoid emotional or motivational language.
- No assumptions beyond given data.
- Return valid JSON only.
- If the response cannot be generated safely, return: {"error":"INSUFFICIENT_DATA"}`

const NARRATE_SYSTEM_PROMPT = `You are TaskMaster AI.

Role: Data insight analyst.

Objective: Convert analytics metrics into concise narrative insights.

RULES:
- 2–4 sentences maximum.
- Compare current vs previous period numerically.
- Calculate percentage difference when possible.
- Avoid speculation.
- Avoid motivational tone.
- Do not invent metrics.
- Return valid JSON only.
- If the response cannot be generated safely, return: {"error":"INSUFFICIENT_DATA"}`

// ─── OpenRouter Call ──────────────────────────────────────────────────────────

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  stream: boolean,
  temperature = 0.7,
  maxTokens = 1024
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  const referer = getEnv('OPENROUTER_SITE_URL')
  const title = getEnv('OPENROUTER_APP_NAME')
  if (referer) headers['HTTP-Referer'] = referer
  if (title) headers['X-Title'] = title

  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
}

// ─── JSON Parse With Retry ────────────────────────────────────────────────────

function safeParseJSON(text: string): unknown | null {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

async function fetchStructuredJSON(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  temperature: number
): Promise<unknown> {
  const messages: ChatMessage[] = [{ role: 'user', content: userContent }]

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callOpenRouter(apiKey, model, systemPrompt, messages, false, temperature, 800)
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter error: ${res.status} — ${errText}`)
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = json?.choices?.[0]?.message?.content ?? ''
    const parsed = safeParseJSON(raw)
    if (parsed !== null) return parsed
    // Retry with a stricter reminder
    messages.push({ role: 'assistant', content: raw })
    messages.push({ role: 'user', content: 'Your response was not valid JSON. Return ONLY valid JSON, nothing else.' })
  }
  return { error: 'INSUFFICIENT_DATA' }
}

// ─── Streaming Handler (chat mode) ───────────────────────────────────────────

async function streamChatResponse(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<Response> {
  const upstream = await callOpenRouter(apiKey, model, systemPrompt, messages, true, 0.7, 1024)

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

  const readable = new ReadableStream<Uint8Array>({
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
            if (data === '[DONE]') { upstreamDone = true; break }

            let parsed: unknown
            try { parsed = JSON.parse(data) } catch { continue }

            const deltaText =
              (parsed as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta?.content
            if (typeof deltaText === 'string' && deltaText.length > 0) {
              fullContent += deltaText
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: deltaText })}\n\n`))
            }
          }
          if (upstreamDone) break
        }

        // Extract and emit task_actions at end of stream
        const match = fullContent.match(/<task_actions>([\s\S]*?)<\/task_actions>/)
        if (match) {
          try {
            const actions = JSON.parse(match[1].trim())
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'task_actions', actions })}\n\n`))
          } catch { /* ignore parse failure */ }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        try { reader.releaseLock() } catch { /* noop */ }
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limiting
    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = getEnv('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const model = getEnv('OPENROUTER_MODEL') ?? 'arcee-ai/trinity-large-preview:free'
    const body = (await req.json()) as RequestBody
    const mode = (body.mode ?? 'chat') as AiMode

    // ── Structured modes (plan | decompose | review | narrate) ──────────────
    if (mode !== 'chat') {
      const payload = body.payload ?? {}
      const userContent = JSON.stringify(payload)

      let systemPrompt: string
      let temperature: number

      switch (mode) {
        case 'plan': systemPrompt = PLAN_SYSTEM_PROMPT; temperature = 0.2; break
        case 'decompose': systemPrompt = DECOMPOSE_SYSTEM_PROMPT; temperature = 0.2; break
        case 'review': systemPrompt = REVIEW_SYSTEM_PROMPT; temperature = 0.2; break
        case 'narrate': systemPrompt = NARRATE_SYSTEM_PROMPT; temperature = 0.2; break
        default:
          return new Response(JSON.stringify({ error: 'Unknown mode' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
      }

      const result = await fetchStructuredJSON(apiKey, model, systemPrompt, userContent, temperature)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Chat mode (streaming) ────────────────────────────────────────────────
    const messages = (body.messages ?? []).filter(
      m => m && m.role && typeof m.content === 'string'
    ) as ChatMessage[]

    const activeProjectId =
      body.activeProjectId ??
      ((body.context as { activeProjectId?: string | null } | undefined)?.activeProjectId ?? null)

    const workspace = await buildWorkspaceContext(supabase, user.id, activeProjectId)
    const systemPrompt = buildChatSystemPrompt(workspace)

    return await streamChatResponse(apiKey, model, systemPrompt, messages)

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
