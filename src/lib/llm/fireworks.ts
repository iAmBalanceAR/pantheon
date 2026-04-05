import OpenAI from 'openai'
import type { LLMMessage, LLMResponse } from '@/types'
import { estimateCost } from './client'

const client = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: 'https://api.fireworks.ai/inference/v1',
})

export async function callFireworks(
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<LLMResponse> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  const content = response.choices[0]?.message?.content ?? ''
  const tokensIn = response.usage?.prompt_tokens ?? 0
  const tokensOut = response.usage?.completion_tokens ?? 0

  return {
    content,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost: estimateCost(model, tokensIn, tokensOut),
    model,
    provider: 'fireworks',
  }
}
