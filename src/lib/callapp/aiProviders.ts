/**
 * Server-side AI provider engine.
 *
 * Every provider (Google AI, OpenRouter, Groq, Venom AI) exposes an
 * OpenAI-compatible chat completions endpoint, so one client covers them all.
 * There is NO built-in fallback: if the active provider is not connected,
 * rate-limited or fails, an AiUnavailableError is raised and the user sees a
 * friendly "We are Facing High Traffic" notice.
 */
import {
  AI_PROVIDERS,
  MASK_RE,
  maskKey,
  type AiConfig,
  type AiProviderConf,
  type AiProviderId,
} from './aiProvidersShared'

export type { AiConfig, AiProviderId } from './aiProvidersShared'
export { AI_PROVIDERS, maskKey }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Raised whenever the agent cannot answer through the connected providers. */
export class AiUnavailableError extends Error {
  code: 'not_connected' | 'rate_limited' | 'unavailable'
  constructor(code: 'not_connected' | 'rate_limited' | 'unavailable', message: string) {
    super(message)
    this.name = 'AiUnavailableError'
    this.code = code
  }
}

/** Clone the AI config with every provider API key masked (safe for the client). */
export function maskAiConfig<T extends Record<string, unknown>>(cfg: T): T {
  const out = { ...(cfg || {}) } as Record<string, unknown>
  const providers = { ...((out.providers as Record<string, AiProviderConf>) || {}) }
  for (const id of Object.keys(providers)) {
    providers[id] = { ...providers[id], apiKey: maskKey(providers[id]?.apiKey) }
  }
  out.providers = providers
  return out as T
}

/**
 * Merge incoming admin edits with the stored config. Masked (••••) or missing
 * keys keep their stored value, so a masked GET response round-tripping
 * through the admin form never clobbers real credentials.
 */
export function mergeAiConfig(
  incoming: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, unknown> {
  const cur = { ...(current || {}) }
  const inc = { ...(incoming || {}) }
  const curProviders = { ...((cur.providers as Record<string, AiProviderConf>) || {}) }
  const incProviders = { ...((inc.providers as Record<string, AiProviderConf>) || {}) }
  const providers: Record<string, AiProviderConf> = { ...curProviders }
  for (const id of Object.keys(incProviders)) {
    const prev = providers[id] || {}
    const next = { ...prev, ...incProviders[id] }
    const key = String(next.apiKey || '')
    if (!key || MASK_RE.test(key)) next.apiKey = prev.apiKey || ''
    providers[id] = next
  }
  delete providers.zai // legacy built-in provider no longer exists
  inc.providers = providers
  return { ...cur, ...inc }
}

/** Resolve the effective settings for a provider id (falls back to active). */
export function resolveProvider(cfg: AiConfig, providerId?: string) {
  const id = (providerId || cfg.activeProvider || 'google') as AiProviderId
  const meta = AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0]
  const conf = (cfg.providers || {})[meta.id] || {}
  const storedKey = conf.apiKey || ''
  return {
    id: meta.id,
    meta,
    apiKey: storedKey,
    baseUrl: (conf.baseUrl || meta.baseUrl || '').replace(/\/+$/, ''),
    model: conf.model || meta.defaultModel,
    ready: !!storedKey,
  }
}

/** Minimal OpenAI-compatible chat completion with a hard timeout. */
async function openAiCompatible(
  p: { baseUrl: string; apiKey: string; model: string; id: AiProviderId },
  messages: ChatMessage[],
  maxTokens?: number
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    }
    if (p.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://call.app'
      headers['X-Title'] = 'CALL'
    }
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: p.model, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${t ? ` — ${t.slice(0, 240)}` : ''}`)
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    if (!text) throw new Error('Empty completion')
    return text
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run a chat completion through the active connected provider. No silent
 * fallback — failures surface as AiUnavailableError so the UI can show the
 * "We are Facing High Traffic" notice.
 */
export async function runChatCompletion(
  messages: ChatMessage[],
  cfg: AiConfig
): Promise<{ text: string; provider: string; model: string }> {
  const p = resolveProvider(cfg)
  if (!p.ready || !p.baseUrl) {
    throw new AiUnavailableError('not_connected', 'No AI provider is connected yet')
  }
  try {
    const text = await openAiCompatible(p, messages)
    return { text, provider: p.id, model: p.model }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof AiUnavailableError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new AiUnavailableError('unavailable', 'Timed out after 45s')
    }
    if (/\b429\b|rate.?limit|quota|too many requests/i.test(msg)) {
      throw new AiUnavailableError('rate_limited', msg)
    }
    console.error(`ai provider ${p.id} failed:`, msg)
    throw new AiUnavailableError('unavailable', msg)
  }
}

/**
 * Provider connectivity test used by the admin panel. A fresh key typed into
 * the form is tested directly; a masked/omitted key falls back to the stored
 * one.
 */
export async function testProvider(
  opts: { provider: AiProviderId; model?: string; apiKey?: string; baseUrl?: string },
  cfg: AiConfig
): Promise<{ ok: boolean; latencyMs: number; reply?: string; model?: string; error?: string }> {
  const started = Date.now()
  const ping: ChatMessage[] = [{ role: 'user', content: 'Reply with exactly: OK' }]
  try {
    const meta = AI_PROVIDERS.find((p) => p.id === opts.provider)
    if (!meta) return { ok: false, latencyMs: 0, error: 'Unknown provider' }
    const conf = (cfg.providers || {})[meta.id] || {}
    const key = opts.apiKey && !MASK_RE.test(opts.apiKey) ? opts.apiKey : conf.apiKey || ''
    if (!key) return { ok: false, latencyMs: Date.now() - started, error: 'No API key saved for this provider' }
    const baseUrl = (opts.baseUrl || conf.baseUrl || meta.baseUrl || '').replace(/\/+$/, '')
    const model = opts.model || conf.model || meta.defaultModel
    const reply = await openAiCompatible({ baseUrl, apiKey: key, model, id: meta.id }, ping, 16)
    return { ok: true, latencyMs: Date.now() - started, reply: reply.slice(0, 60), model }
  } catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'Timed out after 45s' : e.message) : String(e)
    return { ok: false, latencyMs: Date.now() - started, error: msg }
  }
}
