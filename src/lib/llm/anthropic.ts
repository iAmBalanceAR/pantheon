import Anthropic from '@anthropic-ai/sdk'
import type { LLMMessage, LLMResponse } from '@/types'
import { estimateCost } from './client'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function callAnthropic(
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<LLMResponse> {
  const system = messages.find(m => m.role === 'system')?.content
  const rest = messages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system,
    messages: rest,
  })

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  const tokensIn = response.usage.input_tokens
  const tokensOut = response.usage.output_tokens

  return {
    content,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost: estimateCost(model, tokensIn, tokensOut),
    model,
    provider: 'anthropic',
  }
}

export async function* streamAnthropic(
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<string> {
  const system = messages.find(m => m.role === 'system')?.content
  const rest = messages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>

  const stream = await client.messages.stream({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system,
    messages: rest,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      yield chunk.delta.text
    }
  }
}
