/**
 * AIAssistant.jsx — Sliding AI panel
 *
 * Two top-level modes (tabs):
 *  1. "Chat"     — streaming chat with the AI assistant
 *  2. "Features" — Daily Plan / Decompose / Weekly Review cards
 *
 * The panel is a global Sheet overlay rendered in App.jsx.
 */

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import {
  Send, StopCircle, Sparkles, Loader2, CheckCircle2,
  RotateCcw, MessageSquare, Zap,
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

// Lazy-load the AI features panel for bundle efficiency
const AIFeaturesPanel = lazy(() => import('./AIFeaturesPanel'))

// ── Suggested Chat Prompts ────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: 'Plan my day', prompt: 'Based on my current tasks, help me plan what to focus on today.' },
  { label: "What's overdue?", prompt: 'Which tasks are overdue and need urgent attention?' },
  { label: 'Add a task', prompt: 'Add a task: ' },
  { label: 'Prioritize my work', prompt: 'Help me prioritize my current tasks based on urgency and impact.' },
]

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming = false, streamingContent = '' }) {
  const isUser = message.role === 'user'
  const content = isStreaming ? streamingContent : (message.content ?? '')
  // Strip task_actions XML block from visible text
  const display = content.replace(/<task_actions>[\s\S]*?<\/task_actions>/g, '').trim()

  return (
    <div className={cn('flex mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
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

        {/* Task creation confirmations */}
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

// ── Chat Empty State ──────────────────────────────────────────────────────────

function ChatEmptyState({ firstName, onChipClick }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-primary/20 flex items-center justify-center mb-4">
        <MessageSquare className="w-7 h-7 text-primary" />
      </div>
      <h4 className="font-semibold mb-1 text-foreground">Hey, {firstName}! 👋</h4>
      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
        Ask me anything about your tasks — I can create tasks, prioritize your day, or answer questions.
      </p>
      <div className="w-full space-y-2">
        {SUGGESTED_PROMPTS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onChipClick(chip.prompt)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent border border-border hover:border-primary/30 rounded-xl text-left transition-all group"
          >
            <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {chip.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Features Empty (loader) ───────────────────────────────────────────────────

function FeaturesLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'features'
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { aiPanelOpen, setAIPanelOpen, user } = useStore(useShallow(s => ({
    aiPanelOpen: s.aiPanelOpen,
    setAIPanelOpen: s.setAIPanelOpen,
    user: s.user,
  })))

  const {
    messages, isStreaming, streamingContent,
    sendMessage, cancelStream, clearMessages,
  } = useAI()

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input when panel opens on chat tab
  useEffect(() => {
    if (aiPanelOpen && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [aiPanelOpen, activeTab])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChipClick = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <Sheet open={aiPanelOpen} onOpenChange={setAIPanelOpen}>
      <SheetContent className="flex flex-col p-0 w-full sm:max-w-md border-l border-border bg-background">

        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="px-4 pt-4 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-sm font-bold leading-none">TaskMaster AI</SheetTitle>
                <SheetDescription className="text-[11px] mt-0.5">Powered by OpenRouter</SheetDescription>
              </div>
            </div>
            {/* Clear chat button — only in chat mode when there are messages */}
            {activeTab === 'chat' && messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearMessages}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Clear conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* ── Tab strip ─────────────────────────────────────── */}
          <div className="flex bg-muted/50 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                activeTab === 'chat'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                activeTab === 'features'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              AI Features
              <span className="ml-1 text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">3</span>
            </button>
          </div>
        </SheetHeader>

        {/* ── Chat Tab ───────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <>
            <ScrollArea className="flex-1 px-4 pt-4">
              {messages.length === 0 && !isStreaming ? (
                <ChatEmptyState firstName={firstName} onChipClick={handleChipClick} />
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

            {/* Input bar */}
            <div className="px-4 pb-4 pt-2 border-t bg-background shrink-0">
              {isStreaming && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground flex-1">AI is thinking…</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelStream}
                    className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
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
                  className="min-h-11 max-h-32 pr-11 resize-none bg-muted/50 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary"
                  rows={1}
                  disabled={isStreaming}
                />
                <Button
                  size="icon"
                  className="absolute right-1 bottom-1 h-8 w-8 shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Features Tab ───────────────────────────────────────── */}
        {activeTab === 'features' && (
          <ScrollArea className="flex-1 px-4 pt-4 pb-4">
            <Suspense fallback={<FeaturesLoader />}>
              <AIFeaturesPanel />
            </Suspense>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
