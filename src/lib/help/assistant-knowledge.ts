/**
 * Rule-based help assistant — no LLM, no API keys.
 * Matches user text against keywords and short question phrases.
 */

export interface AssistantEntry {
  id: string
  /** Lowercase tokens; more hits = stronger match */
  keywords: string[]
  /** Optional display label for suggested chips */
  chip: string
  /** Reply shown in the assistant (plain text, short paragraphs ok) */
  answer: string
  /** Optional deep link into Help center */
  link?: { href: string; label: string }
}

export const ASSISTANT_ENTRIES: AssistantEntry[] = [
  {
    id: 'what-is',
    chip: 'What is Pantheon?',
    keywords: [
      'what is', 'what does', 'pantheon', 'overview', 'product', 'platform', 'describe',
      'chatbot', 'chat bot', 'difference',
    ],
    answer:
      'Pantheon is an AI project platform — not a generic chatbot. You create a project with a spec; agents plan sprints and tasks, run them in order, and you follow progress in Chat, Team, and Budget. See the full overview in Help.',
    link: { href: '/help/overview', label: 'What is Pantheon?' },
  },
  {
    id: 'start-project',
    chip: 'How do I start?',
    keywords: [
      'start', 'create', 'new project', 'begin', 'run', 'launch', 'first', 'how do i',
      'submit', 'spec',
    ],
    answer:
      'Use **New** in the top bar or go to Projects → New. Paste your spec and submit. When the project opens, use **Start** or **Continue** on the overview to run the next batch of work.',
    link: { href: '/help/projects-and-sprints', label: 'Projects and sprints' },
  },
  {
    id: 'pause',
    chip: 'Pause and resume',
    keywords: ['pause', 'resume', 'stop', 'halt', 'frozen', 'stuck running'],
    answer:
      'Use **Pause** in the project header to stop new agent work safely. **Resume** when you are ready. Paused projects will not run tasks until you continue.',
    link: { href: '/help/projects-and-sprints', label: 'Projects and sprints' },
  },
  {
    id: 'agents-skills',
    chip: 'Agents & skills',
    keywords: [
      'agent', 'agents', 'role', 'coder', 'controller', 'reviewer', 'skill', 'skills',
      'roster', 'custom', 'instructions', 'prompt',
    ],
    answer:
      'Each agent has a **role** (Controller, Coder, etc.). Built-in behavior comes from **Skills** (product-defined). You can add **your own notes** per role under Settings → Agent Roster — they apply to all your projects for that role.',
    link: { href: '/help/agents-and-skills', label: 'Agents and skills' },
  },
  {
    id: 'budget',
    chip: 'Budget & cost',
    keywords: [
      'budget', 'cost', 'token', 'tokens', 'dollar', 'dollars', 'money', 'spend', 'banker',
      'warning', 'limit', 'overage',
    ],
    answer:
      'Pantheon tracks **tokens** and **estimated dollars**. You may see **warnings** in Chat as usage rises; near the cap, a **hard stop** can block further work. Raise the project budget in project settings if needed, or pause first.',
    link: { href: '/help/budget-and-usage', label: 'Budget and usage' },
  },
  {
    id: 'chat-realtime',
    chip: 'Chat & updates',
    keywords: ['chat', 'message', 'feed', 'realtime', 'real time', 'live', 'empty'],
    answer:
      '**Chat** shows agent and system messages. Updates are usually live; if the screen looks stale, refresh once. Long runs may pause between server **run** batches — that is normal.',
    link: { href: '/help/using-the-app', label: 'Using the app' },
  },
  {
    id: 'report',
    chip: 'Completion report',
    keywords: ['report', 'summary', 'completed', 'finish', 'export'],
    answer:
      'When a project completes, open the **Report** tab for a structured summary. If it is empty, your workspace may need the database migration for the report field — check with whoever runs your Supabase.',
    link: { href: '/help/troubleshooting', label: 'Troubleshooting' },
  },
  {
    id: 'settings-where',
    chip: 'Where is Settings?',
    keywords: [
      'settings', 'api key', 'keys', 'configuration', 'agent roster', 'where',
      'nav', 'navigation',
    ],
    answer:
      '**Settings** in the top nav is platform-wide (keys, defaults, Agent Roster). Each **project** also has **Settings** in its own tabs for name, budget, and per-agent models.',
    link: { href: '/help/using-the-app', label: 'Using the app' },
  },
  {
    id: 'troubleshoot',
    chip: 'Something broke',
    keywords: [
      'error', 'broken', 'not working', 'fail', 'failed', 'bug', 'stuck', 'help me',
      'troubleshoot', 'issue', 'problem',
    ],
    answer:
      'Open **Help → Troubleshooting** for a checklist: pause/budget, session, report migration, and realtime. The FAQ also has quick answers.',
    link: { href: '/help/troubleshooting', label: 'Troubleshooting' },
  },
]

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'it', 'i', 'my', 'me', 'we', 'our', 'you', 'your', 'this', 'that', 'how', 'do', 'does', 'can',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
}

/**
 * Score how well the user message matches an entry. Higher is better.
 */
function scoreEntry(message: string, entry: AssistantEntry): number {
  const lower = message.toLowerCase().trim()
  if (!lower) return 0

  let score = 0
  for (const kw of entry.keywords) {
    if (lower.includes(kw)) score += kw.split(/\s+/).length + 2
  }

  const words = tokenize(lower)
  for (const w of words) {
    for (const kw of entry.keywords) {
      if (kw.includes(w) && w.length > 2) score += 0.5
    }
  }

  if (lower.includes(entry.chip.toLowerCase().slice(0, 12))) score += 3

  return score
}

export interface AssistantReply {
  answer: string
  link?: { href: string; label: string }
  matchedId: string | null
}

const FALLBACK_ANSWER = `I only cover common topics about Pantheon — I'm not a full AI assistant.

Try the **Help** guides for full detail, or rephrase using words like *project*, *budget*, *agents*, *pause*, or *report*.`

export function matchAssistantMessage(userMessage: string): AssistantReply {
  const trimmed = userMessage.trim()
  if (!trimmed) {
    return {
      answer: 'Type a short question in your own words.',
      matchedId: null,
    }
  }

  let best: { entry: AssistantEntry; score: number } | null = null
  for (const entry of ASSISTANT_ENTRIES) {
    const s = scoreEntry(trimmed, entry)
    if (!best || s > best.score) best = { entry, score: s }
  }

  if (best && best.score >= 2.5) {
    return {
      answer: best.entry.answer,
      link: best.entry.link,
      matchedId: best.entry.id,
    }
  }

  return {
    answer: FALLBACK_ANSWER,
    link: { href: '/help/faq', label: 'FAQ' },
    matchedId: null,
  }
}

/** Shown when the user sends the same question again (avoid circular repeats). */
export const DUPLICATE_QUESTION_REPLY =
  'That matches what you just asked — my answer has not changed. Scroll up for the last reply, or open **Help** for the full guides.'
