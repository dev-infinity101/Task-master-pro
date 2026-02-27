/**
 * AIAssistant.jsx — Sliding AI panel
 *
 * Features:
 * - Chat mode: streaming token-by-token rendering
 * - Plan mode: structured daily plan card
 * - Decompose mode: subtask list card
 * - Suggested prompt chips
 * - Task action confirmation display
 */

import { useState, useRef, useEffect } from 'react'
import {
  Send, StopCircle, Sparkles, Loader2, CheckCircle2,
  RotateCcw, Calendar, ListTodo, Brain, Zap,
  ClipboardList, ChevronRight,
} from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Prompt chips ─────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  {
    icon: Calendar, label: 'Plan my day',
    prompt: 'Based on my current tasks, help me plan what to focus on today.',
    mode: 'chat',
  },
  {
    icon: ClipboardList, label: 'Daily auto-plan',
    prompt: null, // triggers structured plan mode
    mode: 'plan',
  },
  {
    icon: ListTodo, label: 'Break down a task',
    prompt: 'I want to break down this goal into subtasks: ',
    mode: 'chat',
  },
  {
    icon: Brain, label: 'Prioritize tasks',
    prompt: 'Help me prioritize my current tasks based on urgency and importance.',
    mode: 'chat',
  },
  {
    icon: Zap, label: 'Quick add',
    prompt: 'Add a task: ',
    mode: 'chat',
  },
]

// ─── Structured Result Cards ──────────────────────────────────────────────────

function DailyPlanCard({ data, onDismiss }) {
  if (!data) return null
  const { must_do = [], should_do = [], optional = [], focus_message } = data

  const Section = ({ title, items, color }) =>
    items.length > 0 ? (
      <div className="mb-3">
        <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1.5', color)}>{title}</p>
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">
              <ChevronRight className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', color)} />
              <div>
                <span className="font-medium">{item.task_id}</span>
                {item.reason && <span className="text-muted-foreground ml-1">— {item.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Daily Plan</span>
        </div>
        <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Dismiss
        </button>
      </div>
      <Section title="Must Do" items={must_do} color="text-red-500" />
      <Section title="Should Do" items={should_do} color="text-amber-500" />
      <Section title="Optional" items={optional} color="text-emerald-500" />
      {focus_message && (
        <p className="text-xs text-muted-foreground italic border-t border-border pt-3 mt-2">
          {focus_message}
        </p>
      )}
    </div>
  )
}

function DecomposeCard({ data, onDismiss }) {
  if (!data?.subtasks?.length) return null
  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <ListTodo className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Task Breakdown</span>
        </div>
        <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Dismiss
        </button>
      </div>
      <ol className="space-y-1.5">
        {data.subtasks.map((subtask, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-[10px] font-bold text-primary/60 w-4 shrink-0 mt-0.5">{i + 1}.</span>
            <span>{subtask}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming = false, streamingContent = '' }) {
  const isUser = message.role === 'user'
  const content = isStreaming ? streamingContent : message.content
  const display = content.replace(/<task_actions>[\s\S]*?<\/task_actions>/g, '').trim()

  return (
    <div className={cn('flex mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-muted text-foreground rounded-bl-sm'
      )}>
        {display}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/50 rounded-sm ml-0.5 animate-pulse" />
        )}

        {/* Created tasks confirmation */}
        {message.taskActions?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 mb-2 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Created {message.taskActions.length} task{message.taskActions.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-1.5">
              {message.taskActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">{action.title}</p>
                    {action.priority && action.priority !== 'none' && (
                      <p className="text-muted-foreground mt-0.5 capitalize">{action.priority} priority</p>
                    )}
                    {action.due_date && (
                      <p className="text-muted-foreground">Due: {new Date(action.due_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIAssistant() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { aiPanelOpen, setAIPanelOpen, user, tasks, activeProjectId } = useStore(useShallow(s => ({
    aiPanelOpen: s.aiPanelOpen,
    setAIPanelOpen: s.setAIPanelOpen,
    user: s.user,
    tasks: s.tasks,
    activeProjectId: s.activeProjectId,
  })))

  const {
    messages, isStreaming, streamingContent, structuredResult, isLoadingStructured,
    sendMessage, callStructured, cancelStream, clearMessages,
  } = useAI()

  // Dismiss structured result state
  const [dismissedResult, setDismissedResult] = useState(false)
  const visibleResult = dismissedResult ? null : structuredResult

  // Reset dismiss when new result arrives
  useEffect(() => { setDismissedResult(false) }, [structuredResult])

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingContent])

  // Focus on open
  useEffect(() => {
    if (aiPanelOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [aiPanelOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleChip = async (chip) => {
    if (chip.mode === 'plan') {
      // Build payload from current tasks
      const projectTasks = (tasks[activeProjectId] ?? [])
        .filter(t => t.status === 'todo')
        .map(t => ({
          id: t.id, title: t.title, priority: t.priority,
          due_date: t.due_date ?? null, status: t.status,
          estimated_minutes: null,
        }))
      const completedLast7 = (tasks[activeProjectId] ?? [])
        .filter(t => t.status === 'done').length
      await callStructured('plan', {
        date: new Date().toISOString().split('T')[0],
        tasks: projectTasks,
        completed_last_7_days: completedLast7,
        average_daily_capacity_minutes: 300,
      })
    } else if (chip.prompt) {
      setInput(chip.prompt)
      inputRef.current?.focus()
    }
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'
  const isPlanResult = visibleResult && 'must_do' in visibleResult
  const isDecomposeResult = visibleResult && 'subtasks' in visibleResult

  return (
    <Sheet open={aiPanelOpen} onOpenChange={setAIPanelOpen}>
      <SheetContent className="flex flex-col p-0 w-full sm:max-w-md border-l border-border bg-background">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold">TaskMaster AI</SheetTitle>
              <SheetDescription className="text-xs">Powered by OpenRouter</SheetDescription>
            </div>
          </div>
          {(messages.length > 0 || visibleResult) && (
            <Button
              variant="ghost" size="icon"
              onClick={() => { clearMessages(); setDismissedResult(true) }}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Clear conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </SheetHeader>

        {/* Messages + Structured Cards */}
        <ScrollArea className="flex-1 p-4">
          {/* Structured result cards (above chat messages) */}
          {isPlanResult && (
            <DailyPlanCard data={visibleResult} onDismiss={() => setDismissedResult(true)} />
          )}
          {isDecomposeResult && (
            <DecomposeCard data={visibleResult} onDismiss={() => setDismissedResult(true)} />
          )}

          {/* Structured loading */}
          {isLoadingStructured && (
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl mb-4">
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              <p className="text-sm text-muted-foreground">AI is generating your plan…</p>
            </div>
          )}

          {messages.length === 0 && !visibleResult && !isLoadingStructured ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-semibold mb-1 text-foreground">Hey, {firstName}! 👋</h4>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                I can create tasks, plan your day, break down goals, and help you stay on track.
              </p>
              <div className="w-full space-y-2">
                {SUGGESTED_PROMPTS.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => handleChip(chip)}
                    disabled={isLoadingStructured}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent border border-border hover:border-primary/30 rounded-xl text-left transition-all group disabled:opacity-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <chip.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {chip.label}
                    </span>
                    {chip.mode === 'plan' && (
                      <span className="ml-auto text-[10px] font-medium text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-full">
                        AI
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && (
                <MessageBubble
                  message={{ role: 'assistant', content: '' }}
                  isStreaming
                  streamingContent={streamingContent}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="px-4 pb-4 pt-3 border-t bg-background">
          {isStreaming && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">AI is thinking…</span>
              <Button
                variant="ghost" size="sm" onClick={cancelStream}
                className="ml-auto h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1" />Stop
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything…"
              className="min-h-11 max-h-32 pr-10 resize-none bg-muted/50 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary"
              rows={1}
            />
            <Button
              size="icon"
              className="absolute right-1 bottom-1 h-8 w-8"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
