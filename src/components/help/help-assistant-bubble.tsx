'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import {
  matchAssistantMessage,
  DUPLICATE_QUESTION_REPLY,
} from '@/lib/help/assistant-knowledge'

interface ChatLine {
  role: 'user' | 'assistant'
  text: string
  link?: { href: string; label: string }
}

const STORAGE_KEY = 'pantheon-help-chat-v1'
const STORAGE_VERSION = 1
const MAX_STORED_LINES = 36

const defaultWelcome: ChatLine[] = [
  {
    role: 'assistant',
    text: 'Need a hand? Ask in your own words — I match a small set of platform topics (no AI, nothing leaves your device). Close anytime; your thread stays for this session.',
  },
]

function normalizeQuestion(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function loadStoredLines(): ChatLine[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { v: number; lines: ChatLine[] }
    if (data.v !== STORAGE_VERSION || !Array.isArray(data.lines) || data.lines.length === 0) {
      return null
    }
    return data.lines.length > MAX_STORED_LINES
      ? data.lines.slice(-MAX_STORED_LINES)
      : data.lines
  } catch {
    return null
  }
}

function saveLines(lines: ChatLine[]) {
  if (typeof window === 'undefined') return
  try {
    const trimmed =
      lines.length > MAX_STORED_LINES ? lines.slice(-MAX_STORED_LINES) : lines
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: STORAGE_VERSION, lines: trimmed })
    )
  } catch {
    /* quota / private mode */
  }
}

function lastUserQuestion(lines: ChatLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].role === 'user') return lines[i].text
  }
  return null
}

/** Renders **bold** segments in assistant replies (very small subset of markdown). */
function formatInlineBold(text: string): ReactNode {
  const parts = text.split(/\*\*/)
  if (parts.length === 1) return text
  return parts.map((chunk, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {chunk}
      </strong>
    ) : (
      <span key={i}>{chunk}</span>
    )
  )
}

export function HelpAssistantBubble() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<ChatLine[]>(() => loadStoredLines() ?? defaultWelcome)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveLines(lines)
  }, [lines])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, lines])

  const sendRaw = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const prevUser = lastUserQuestion(lines)
    const isRepeat =
      prevUser !== null && normalizeQuestion(trimmed) === normalizeQuestion(prevUser)

    if (isRepeat) {
      setLines(prev => [
        ...prev,
        { role: 'user', text: trimmed },
        {
          role: 'assistant',
          text: DUPLICATE_QUESTION_REPLY,
          link: { href: '/help', label: 'Open Help' },
        },
      ])
      setInput('')
      return
    }

    const reply = matchAssistantMessage(trimmed)
    setLines(prev => [
      ...prev,
      { role: 'user', text: trimmed },
      {
        role: 'assistant',
        text: reply.answer,
        link: reply.link,
      },
    ])
    setInput('')
  }, [lines])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendRaw(input)
    },
    [input, sendRaw]
  )

  return (
    <>
      {/* Launcher — persistent lower-right; stays put while you navigate */}
      <motion.button
        type="button"
        layout
        onClick={() => setOpen(v => !v)}
        className="fixed z-[100] bottom-5 right-5 md:bottom-6 md:right-6 flex h-11 items-center gap-2 rounded-full border border-border bg-card/95 pl-3.5 pr-4 text-primary shadow-none hover:border-primary/35 hover:bg-secondary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))' }}
        aria-expanded={open}
        aria-controls="help-assistant-panel"
        aria-label={open ? 'Close help' : 'Open quick help'}
        whileTap={{ scale: 0.97 }}
      >
        {open ? (
          <X size={18} strokeWidth={2.25} className="shrink-0" />
        ) : (
          <MessageCircle size={18} strokeWidth={2.25} className="shrink-0" />
        )}
        <span className="text-xs font-medium text-foreground/90 pr-0.5 max-w-[7.5rem] truncate sm:max-w-none">
          {open ? 'Close' : 'Quick help'}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[90] bg-background/55 backdrop-blur-[1px]"
              aria-label="Close help"
              onClick={() => setOpen(false)}
            />

            <motion.div
              id="help-assistant-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-assistant-title"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              className="fixed z-[100] w-[min(22rem,calc(100vw-2rem))] max-h-[min(72vh,30rem)] flex flex-col rounded-2xl border border-border bg-[#101010] overflow-hidden shadow-2xl"
              style={{
                bottom: 'max(5.75rem, calc(env(safe-area-inset-bottom, 0px) + 4.75rem))',
                right: 'max(1.25rem, env(safe-area-inset-right, 0px))',
              }}
            >
              <div className="flex items-start gap-2 px-4 py-3 border-b border-border bg-card/40">
                <Sparkles size={17} className="text-primary shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
                <div className="flex-1 min-w-0">
                  <h2 id="help-assistant-title" className="text-sm font-semibold text-foreground leading-tight">
                    Need a hand?
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    Simple topic matcher — dismiss anytime
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div
                ref={listRef}
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3 min-h-[7.5rem]"
              >
                {lines.map((line, i) => (
                  <div
                    key={`${i}-${line.role}-${line.text.slice(0, 24)}`}
                    className={
                      line.role === 'user'
                        ? 'ml-5 rounded-xl bg-primary/[0.08] border border-primary/15 px-3 py-2 text-xs text-foreground'
                        : 'mr-3 rounded-xl bg-secondary/35 border border-border/80 px-3 py-2 text-xs text-muted-foreground leading-relaxed'
                    }
                  >
                    <p>{formatInlineBold(line.text)}</p>
                    {line.link && (
                      <Link
                        href={line.link.href}
                        className="inline-block mt-2 text-primary text-2xs font-semibold hover:underline underline-offset-2"
                        onClick={() => setOpen(false)}
                      >
                        {line.link.label} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card/25">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type your question…"
                    className="input-field flex-1 text-xs h-9 py-1"
                    aria-label="Your question"
                    maxLength={320}
                  />
                  <button
                    type="submit"
                    className="shrink-0 h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40"
                    disabled={!input.trim()}
                    aria-label="Send"
                  >
                    <Send size={15} strokeWidth={2.5} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/75 mt-2 leading-tight">
                  Stays on this browser tab until you close it. Full guides:{' '}
                  <Link href="/help" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                    Help
                  </Link>
                </p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
