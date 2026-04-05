/**
 * Sanitizes agent provider/model before execution.
 * Remaps anything Anthropic or deprecated Fireworks to working alternatives.
 */

const DEPRECATED_FIREWORKS: Record<string, string> = {
  'accounts/fireworks/models/llama-v3p1-70b-instruct': 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  'accounts/fireworks/models/llama-v3p1-8b-instruct':  'accounts/fireworks/models/llama-v3p3-70b-instruct',
  'accounts/fireworks/models/llama-v3-70b-instruct':   'accounts/fireworks/models/llama-v3p3-70b-instruct',
  'accounts/fireworks/models/glm-5':                   'accounts/fireworks/models/llama-v3p3-70b-instruct',
}

const ANTHROPIC_TO_GEMINI: Record<string, string> = {
  'claude-opus-4-5':    'gemini-2.5-flash',
  'claude-sonnet-4-6':  'gemini-2.5-flash',
  'claude-haiku-4-5':   'gemini-2.5-flash',
  'claude-3-5-sonnet':  'gemini-2.5-flash',
  'claude-3-haiku':     'gemini-2.5-flash',
}

export function sanitizeModel(
  provider: string,
  model: string
): { provider: string; model: string } {
  // Remap any Anthropic provider → Gemini
  if (provider === 'anthropic') {
    return {
      provider: 'gemini',
      model: ANTHROPIC_TO_GEMINI[model] ?? 'gemini-2.5-flash',
    }
  }

  // Remap deprecated Fireworks models
  if (provider === 'fireworks' && DEPRECATED_FIREWORKS[model]) {
    return { provider: 'fireworks', model: DEPRECATED_FIREWORKS[model] }
  }

  // Unknown provider → Gemini
  if (provider !== 'fireworks' && provider !== 'gemini') {
    return { provider: 'gemini', model: 'gemini-2.5-flash' }
  }

  return { provider, model }
}
