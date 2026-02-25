/**
 * AIAssistant.jsx — Sliding AI panel
 *
 * Features:
 * - Streaming text rendering (token by token)
 * - Suggested prompt chips for quick access
 * - Task action confirmation cards
 * - Conversation history within session
 */

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  StopCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Calendar,
  ListTodo,
  Brain,
  Zap,
} from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const SUGGESTED_PROMPTS = [
  { icon: Calendar, label: 'Plan my day', prompt: 'Based on my current tasks, help me plan what to focus on today.' },
  { icon: ListTodo, label: 'Break down a goal', prompt: 'I want to ' },
  { icon: Brain, label: 'Prioritize tasks', prompt: 'Help me prioritize my current tasks based on urgency and importance.' },
  { icon: Zap, label: 'Quick add', prompt: 'Add a task: ' },
]

function MessageBubble({ message, isStreaming = false, streamingContent = '' }) {
  const isUser = message.role === 'user'
  const content = isStreaming ? streamingContent : message.content

  // Strip task_actions XML from displayed content
  const displayContent = content.replace(/<task_actions>[\s\S]*?<\/task_actions>/g, '').trim()

  return (
    <div className={cn("flex mb-4", isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {displayContent}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/50 rounded-sm ml-0.5 animate-pulse" />
        )}

        {/* Task actions created */}
        {message.taskActions?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 mb-2 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Created {message.taskActions.length} task{message.taskActions.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-1.5">
              {message.taskActions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">{action.title}</p>
                    {action.priority && action.priority !== 'none' && (
                      <p className="text-muted-foreground mt-0.5 capitalize">{action.priority} priority</p>
                    )}
                    {action.due_date && (
                      <p className="text-muted-foreground">
                        Due: {new Date(action.due_date).toLocaleDateString()}
                      </p>
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

export default function AIAssistant() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { aiPanelOpen, setAIPanelOpen, user } = useStore(useShallow((s) => ({
    aiPanelOpen: s.aiPanelOpen,
    setAIPanelOpen: s.setAIPanelOpen,
    user: s.user,
  })))
  const { messages, isStreaming, streamingContent, sendMessage, cancelStream, clearMessages } =
    useAI()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input when panel opens
  useEffect(() => {
    if (aiPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aiPanelOpen])

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

  const handleSuggestedPrompt = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <Sheet open={aiPanelOpen} onOpenChange={setAIPanelOpen}>
      <SheetContent className="flex flex-col p-0 w-full sm:max-w-md border-l border-border bg-background">
        <SheetHeader className="px-5 py-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0 text-left">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold">TaskMaster AI</SheetTitle>
              <SheetDescription className="text-xs">Powered by Claude</SheetDescription>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearMessages}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Clear conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-semibold mb-1 text-foreground">Hey, {firstName}! 👋</h4>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                I can create tasks, plan your day, break down goals, and help you stay on track.
              </p>

              {/* Suggested prompts */}
              <div className="w-full space-y-2">
                {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent border border-border hover:border-primary/30 rounded-xl text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((msg) => (
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
              <span className="text-xs text-muted-foreground">AI is thinking...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelStream}
                className="ml-auto h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1" />
                Stop
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
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
