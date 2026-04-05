'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: string
  content: string
  message_type: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const TYPE_STYLES: Record<string, { label: string; labelColor: string; contentColor: string; bg: string }> = {
  system:         { label: 'system',   labelColor: 'text-[#333]',     contentColor: 'text-[#444]',        bg: 'transparent' },
  event:          { label: 'event',    labelColor: 'text-[#525252]',  contentColor: 'text-[#606060]',     bg: 'transparent' },
  chat:           { label: '',         labelColor: '',                contentColor: 'text-foreground/90', bg: 'transparent' },
  decision:       { label: 'decision', labelColor: 'text-[#facc15]',  contentColor: 'text-foreground/80', bg: 'transparent' },
  conflict:       { label: 'conflict', labelColor: 'text-red-400',    contentColor: 'text-foreground/80', bg: 'transparent' },
  meeting:        { label: 'meeting',  labelColor: 'text-[#60a5fa]',  contentColor: 'text-foreground/80', bg: 'transparent' },
  approval:       { label: 'approved', labelColor: 'text-[#4ade80]',  contentColor: 'text-foreground/80', bg: 'transparent' },
  rejection:      { label: 'rejected', labelColor: 'text-red-400',    contentColor: 'text-foreground/80', bg: 'transparent' },
  budget_warning: { label: 'budget',   labelColor: 'text-[#fb923c]',  contentColor: 'text-foreground/80', bg: 'transparent' },
}

const ROLE_COLORS: Record<string, string> = {
  controller: '#CBF43A',
  auditor:    '#60a5fa',
  banker:     '#fb923c',
  coder:      '#a3a3a3',
  architect:  '#c084fc',
  reviewer:   '#34d399',
  system:     '#333',
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

interface MsgProps { message: Message }

const ChatMessage = ({ message }: MsgProps) => {
  const style   = TYPE_STYLES[message.message_type] ?? TYPE_STYLES['chat']
  const isSystem = message.message_type === 'system'
  const isEvent  = message.message_type === 'event'
  const roleColor = ROLE_COLORS[message.role] ?? '#525252'

  if (isSystem) {
    return (
      <div className="py-3 flex items-center gap-3 px-6">
        <div className="flex-1 h-px bg-[#1f1f1f]" />
        <span className="text-2xs text-[#333] font-mono">{message.content}</span>
        <div className="flex-1 h-px bg-[#1f1f1f]" />
      </div>
    )
  }

  if (isEvent) {
    return (
      <div className="px-6 py-1.5 flex items-start gap-3 animate-fade-in">
        <span className="text-2xs font-mono text-[#2a2a2a] mt-0.5 w-10 text-right flex-shrink-0">
          {formatTime(message.created_at)}
        </span>
        <span className="text-2xs text-[#3a3a3a] font-mono leading-relaxed">{message.content}</span>
      </div>
    )
  }

  return (
    <div className="px-6 py-3 group animate-fade-in hover:bg-[#0a0a0a] transition-colors duration-100">
      <div className="flex items-baseline gap-3 mb-1.5">
        {/* Role name */}
        <span
          className="text-xs font-semibold flex-shrink-0"
          style={{ color: roleColor }}
        >
          {message.role}
        </span>

        {/* Message type badge */}
        {style.label && (
          <span className={cn('text-2xs font-mono', style.labelColor)}>
            [{style.label}]
          </span>
        )}

        {/* Timestamp — visible on hover */}
        <span className="text-2xs font-mono text-[#2a2a2a] group-hover:text-[#3a3a3a] transition-colors ml-auto">
          {formatTime(message.created_at)}
        </span>
      </div>

      <p className={cn('text-sm leading-relaxed pl-0', style.contentColor)}>
        {message.content}
      </p>
    </div>
  )
}

interface PageProps { params: { id: string } }

export default function ChatPage({ params }: PageProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
      setLoading(false)
      setTimeout(scrollToBottom, 50)
    }

    fetchMessages()

    const channel = supabase
      .channel(`chat-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `project_id=eq.${params.id}` },
        payload => {
          setMessages(prev => [...prev, payload.new as Message])
          setTimeout(scrollToBottom, 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [params.id])

  return (
    <div className="flex flex-col h-[calc(100dvh-52px-160px)]">
      {/* Feed header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <span className="text-label text-muted-foreground/40">Live Feed</span>
        {messages.length > 0 && (
          <span className="text-2xs font-mono text-muted-foreground/30">
            {messages.length} messages
          </span>
        )}
        <span className="flex items-center gap-1.5 text-2xs text-[#4ade80]">
          <span className="live-dot relative flex h-1.5 w-1.5">
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
          </span>
          live
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs text-muted-foreground">Loading feed...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <div className="text-sm text-muted-foreground/40 mb-2">No messages yet</div>
            <div className="text-xs text-muted-foreground/25">
              Messages will appear here as agents work
            </div>
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="py-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  )
}
