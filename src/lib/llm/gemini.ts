import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMMessage, LLMResponse } from '@/types'
import { estimateCost } from './client'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')

// Reject if Gemini takes longer than this
const GEMINI_TIMEOUT_MS = 45_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms (${label})`)), ms)
    ),
  ])
}

export async function callGemini(
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<LLMResponse> {
  const system = messages.find(m => m.role === 'system')?.content ?? ''

  // Gemini rules:
  //   1. history must start with a 'user' turn
  //   2. turns must strictly alternate user → model → user → …
  //   3. the final user turn goes via sendMessage, not in history
  const nonSystem = messages.filter(m => m.role !== 'system')
  const lastMessage = nonSystem.at(-1)?.content ?? ''

  // Map to Gemini roles then fix ordering issues
  let rawHistory = nonSystem.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : ('user' as 'user' | 'model'),
    parts: [{ text: m.content }],
  }))

  // Rule 1 — drop leading model turns
  while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
    rawHistory = rawHistory.slice(1)
  }

  // Rule 2 — merge consecutive same-role turns into one (concatenate with newline)
  const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  for (const turn of rawHistory) {
    const prev = history.at(-1)
    if (prev && prev.role === turn.role) {
      prev.parts[0].text += '\n' + turn.parts[0].text
    } else {
      history.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] })
    }
  }

  // Rule 1 (re-check after merge) — history must end on 'model' if non-empty,
  // because sendMessage adds the next 'user' turn. If history ends on 'user',
  // Gemini would see user → user which is invalid. Drop the trailing user turn
  // and prepend it to lastMessage instead.
  let prefix = ''
  if (history.length > 0 && history.at(-1)!.role === 'user') {
    prefix = history.pop()!.parts[0].text + '\n\n'
  }
  const finalMessage = prefix + lastMessage

  // Disable thinking on 2.5-flash to get fast responses (thinkingBudget:0 = off)
  const is25Flash = model.includes('2.5-flash')

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    ...(is25Flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  }
  if (options.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const geminiModel = genAI.getGenerativeModel({
    model,
    ...(system ? {
      systemInstruction: { role: 'user', parts: [{ text: system }] },
    } : {}),
  })

  const chat = geminiModel.startChat({
    history,
    generationConfig,
  })

  const result = await withTimeout(
    chat.sendMessage(finalMessage),
    GEMINI_TIMEOUT_MS,
    model
  )
  const content = result.response.text()
  const tokensIn  = result.response.usageMetadata?.promptTokenCount ?? 0
  const tokensOut = result.response.usageMetadata?.candidatesTokenCount ?? 0

  return {
    content,
    tokens_in:  tokensIn,
    tokens_out: tokensOut,
    cost: estimateCost(model, tokensIn, tokensOut),
    model,
    provider: 'gemini',
  }
}
