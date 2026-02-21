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
  X,
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-md'
        }`}
      >
        {displayContent}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-indigo-400 rounded-sm ml-0.5 animate-pulse" />
        )}

        {/* Task actions created */}
        {message.taskActions?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Created {message.taskActions.length} task{message.taskActions.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-1.5">
              {message.taskActions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-200 font-medium">{action.title}</p>
                    {action.priority && action.priority !== 'none' && (
                      <p className="text-slate-400 mt-0.5 capitalize">{action.priority} priority</p>
                    )}
                    {action.due_date && (
                      <p className="text-slate-400">
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

  if (!aiPanelOpen) return null

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
        onClick={() => setAIPanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-slate-950 border-l border-slate-800 z-40 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">TaskMaster AI</h3>
              <p className="text-xs text-slate-500">Powered by Claude</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
                title="Clear conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setAIPanelOpen(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-indigo-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">Hey, {firstName}! 👋</h4>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                I can create tasks, plan your day, break down goals, and help you stay on track.
              </p>

              {/* Suggested prompts */}
              <div className="w-full space-y-2">
                {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
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
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-800">
          {isStreaming && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-500">AI is thinking...</span>
              <button
                onClick={cancelStream}
                className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-slate-900 border border-slate-700 focus-within:border-indigo-500 rounded-xl p-2 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything... or try 'Plan my day'"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none resize-none py-1 px-1 max-h-32 disabled:opacity-50"
              style={{ minHeight: '36px' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-600 mt-2">
            Powered by Claude · Press Enter to send
          </p>
        </div>
      </div>
    </>
  )
}
