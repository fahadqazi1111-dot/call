import type { CallRecord, ChatSummary, ContactItem, Me, Message } from './types'

const TOKEN_KEY = 'call.auth.token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (!(init?.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers['x-auth-token'] = token
  const res = await fetch(path, { ...init, headers, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`)
  return data as T
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ ok: boolean; phone: string; devCode: string; expiresInSec: number }>('/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string, name?: string) =>
    request<{ ok?: boolean; needName?: boolean; token?: string; user?: Me; error?: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, name }),
    }),
  me: () => request<{ user: Me }>('/api/me'),
  updateMe: (patch: { name?: string; about?: string; avatarUrl?: string | null }) =>
    request<{ user: Me }>('/api/me', { method: 'PUT', body: JSON.stringify(patch) }),
  chats: () => request<{ chats: ChatSummary[] }>('/api/chats'),
  messages: (peerId: string) =>
    request<{ peer: Me; messages: Message[] }>(`/api/chats/${peerId}/messages`),
  sendMessage: (payload: { to: string; type: 'text' | 'voice' | 'call'; content: string; duration?: number }) =>
    request<{ message: Message }>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  markRead: (peerId: string) =>
    request<{ ok: boolean; updated: number }>('/api/messages/read', {
      method: 'POST',
      body: JSON.stringify({ peerId }),
    }),
  contacts: () => request<{ contacts: ContactItem[] }>('/api/contacts'),
  addContact: (name: string, phone: string) =>
    request<{ contact: ContactItem }>('/api/contacts', { method: 'POST', body: JSON.stringify({ name, phone }) }),
  deleteContact: (id: string) => request<{ ok: boolean }>(`/api/contacts?id=${id}`, { method: 'DELETE' }),
  syncContacts: (contacts: { name: string; phone: string }[]) =>
    request<{ ok: boolean; saved: number; matched: number }>('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    }),
  calls: () => request<{ calls: CallRecord[] }>('/api/calls'),
  logCall: (payload: {
    peerId: string
    type: 'voice' | 'video'
    status: CallRecord['status']
    durationSec: number
    addMessage?: boolean
  }) => request<{ ok: boolean; callId: string; message: Message | null }>('/api/calls', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadVoice: async (blob: Blob) => {
    const form = new FormData()
    form.append('file', blob, 'voice.webm')
    return request<{ ok: boolean; id: string; mime: string }>('/api/upload', { method: 'POST', body: form })
  },
  uploadAvatar: async (blob: Blob, mime: string) => {
    const ext = mime === 'image/png' ? 'avatar.png' : mime === 'image/webp' ? 'avatar.webp' : 'avatar.jpg'
    const form = new FormData()
    form.append('file', blob, ext)
    return request<{ ok: boolean; id: string; mime: string }>('/api/upload', { method: 'POST', body: form })
  },
}
