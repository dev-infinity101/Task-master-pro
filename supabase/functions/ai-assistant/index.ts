/**
 * Supabase Edge Function: ai-assistant
 * Runtime: Deno
 *
 * Deploy: supabase functions deploy ai-assistant
 * Set secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * Receives: { messages: Message[], context: TaskContext }
 * Returns: SSE stream of text tokens + optional task_actions JSON
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messages, context } = await req.json()

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    })

    // Build rich system prompt with user context
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const systemPrompt = `You are TaskMaster AI, a highly capable personal productivity assistant.
Today is ${today}.

USER'S CURRENT CONTEXT:
- Active Project: "${context.projectName ?? 'My Tasks'}"
- Active Tasks: ${context.taskCount} tasks in progress
- Overdue Tasks: ${context.overdueTasks?.length > 0 
  ? context.overdueTasks.map(t => `"${t.title}"`).join(', ') 
  : 'None'}
- Due Today: ${context.todaysTasks?.length > 0 
  ? context.todaysTasks.map(t => `"${t.title}"`).join(', ') 
  : 'None'}
- Recent Tasks: ${context.recentTasks?.map(t => `"${t.title}" (${t.status})`).join(', ') ?? 'None'}
- Available Columns: ${context.columns?.map(c => c.name).join(' → ')}

YOUR CAPABILITIES:
1. CREATE TASKS: When the user asks you to add/create tasks, respond naturally AND include a JSON block.
2. BREAK DOWN GOALS: When given a large goal, suggest subtasks.
3. DAILY PLANNING: Help prioritize tasks for today based on due dates and priority.
4. SMART SUGGESTIONS: Suggest priorities and due dates based on context.

TASK CREATION FORMAT:
When you need to create tasks, include this EXACT format at the end of your response:

<task_actions>
[
  {
    "type": "create_task",
    "title": "Task title here",
    "description": "Optional description",
    "priority": "none|low|medium|high|urgent",
    "due_date": "2026-02-15T15:00:00.000Z",
    "tags": ["optional", "tags"]
  }
]
</task_actions>

RULES:
- Be concise and actionable. No fluff.
- For daily planning, list max 5 priority tasks.
- When creating tasks from natural language, parse dates intelligently (e.g., "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}).
- Priority mapping: urgent = today/ASAP, high = this week, medium = this month, low = someday.
- Always confirm what you created in a natural way.
- If the user asks something unrelated to tasks/productivity, gently redirect.`

    // Stream response from Claude
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    // Create SSE stream
    const encoder = new TextEncoder()
    let fullContent = ''

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullContent += event.delta.text

              // Stream text token
              const sseData = JSON.stringify({ type: 'text_delta', text: event.delta.text })
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
            }
          }

          // Parse task actions from full response
          const taskActionsMatch = fullContent.match(/<task_actions>([\s\S]*?)<\/task_actions>/)
          if (taskActionsMatch) {
            try {
              const actions = JSON.parse(taskActionsMatch[1].trim())
              const actionsData = JSON.stringify({ type: 'task_actions', actions })
              controller.enqueue(encoder.encode(`data: ${actionsData}\n\n`))
            } catch {
              // Invalid JSON in task actions — skip
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
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
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
