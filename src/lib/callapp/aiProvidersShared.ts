/**
 * AI provider registry — shared between the admin UI (client) and the API
 * routes (server). This file must stay free of server-only imports.
 */

export type AiProviderId = 'zai' | 'google' | 'openrouter' | 'groq' | 'venom'

export interface AiProviderMeta {
  id: AiProviderId
  label: string
  /** curated, best-working models (admin can always type a custom id too) */
  models: string[]
  defaultModel: string
  /** OpenAI-compatible base URL (external providers) */
  baseUrl?: string
  /** Venom lets the admin point at a different gateway */
  editableBaseUrl?: boolean
  /** built-in provider — no credentials needed */
  keyless?: boolean
  keyUrl?: string
  note?: string
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'zai',
    label: 'Z-AI (built-in)',
    models: ['default'],
    defaultModel: 'default',
    keyless: true,
    note: 'Built into CALL — no API key required. Used automatically as a fallback when another provider fails.',
  },
  {
    id: 'google',
    label: 'Google AI (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
    ],
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'gemma2-9b-it',
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'venom',
    label: 'Venom AI',
    baseUrl: 'https://api.venomai.org/v1',
    editableBaseUrl: true,
    models: ['venom-v1', 'venom-v1-mini', 'venom-v1-pro'],
    defaultModel: 'venom-v1',
    keyUrl: 'https://venomai.org',
  },
]

export interface AiProviderConf {
  apiKey?: string
  baseUrl?: string
  model?: string
}

/** Shape of the 'ai' AdminSetting JSON block. */
export interface AiConfig {
  dailyTextLimit?: number
  dailyImageLimit?: number
  dailyVoiceLimit?: number
  voiceReplies?: boolean
  imageGen?: boolean
  activeProvider?: string
  providers?: Partial<Record<AiProviderId, AiProviderConf>>
  [k: string]: unknown
}

/** Mask an API key for display — keep only the last 4 characters. */
export function maskKey(key?: string): string {
  const k = String(key || '')
  return k ? `\u2022\u2022\u2022\u2022${k.slice(-4)}` : ''
}

export const MASK_RE = /^\u2022\u2022\u2022\u2022/
