import type { LLMMessage, LLMResponse, LLMProvider } from '@/types'
import { callAnthropic } from './anthropic'
import { callFireworks } from './fireworks'
import { callGemini } from './gemini'

// Cost per 1M tokens (input / output) in USD
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':                                { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':                                 { input: 0.80,  output: 4.00  },
  'claude-opus-4-5':                                  { input: 15.00, output: 75.00 },
  'accounts/fireworks/models/llama-v3p3-70b-instruct': { input: 0.90,  output: 0.90  },
  'accounts/fireworks/models/llama-v3p1-70b-instruct': { input: 0.90,  output: 0.90  },
  'accounts/fireworks/models/llama-v3p1-8b-instruct':  { input: 0.20,  output: 0.20  },
  'accounts/fireworks/models/glm-5':                   { input: 0.90,  output: 0.90  },
  'gemini-2.5-flash':                                 { input: 0.15,  output: 0.60  },
  'gemini-2.0-flash':                                 { input: 0.10,  output: 0.40  },
  'gemini-1.5-flash':                                 { input: 0.075, output: 0.30  },
  'gemini-1.5-flash-latest':                          { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':                                   { input: 1.25,  output: 5.00  },
}

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 1.00, output: 3.00 }
  return (tokensIn / 1_000_000) * costs.input + (tokensOut / 1_000_000) * costs.output
}

export async function callLLM(
  provider: LLMProvider,
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<LLMResponse> {
  switch (provider) {
    case 'anthropic': return callAnthropic(model, messages, options)
    case 'fireworks': return callFireworks(model, messages, options)
    case 'gemini':    return callGemini(model, messages, options)
    default: throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

// Streaming variant — yields text chunks
export async function* streamLLM(
  provider: LLMProvider,
  model: string,
  messages: LLMMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<string> {
  if (provider === 'anthropic') {
    const { streamAnthropic } = await import('./anthropic')
    yield* streamAnthropic(model, messages, options)
  } else {
    // For non-streaming providers, just yield the full response
    const result = await callLLM(provider, model, messages, options)
    yield result.content
  }
}
