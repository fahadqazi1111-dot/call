/**
 * Free, client-side contact import parsing — works in every browser.
 * Supports: vCard (.vcf from iPhone / Google Contacts), CSV (Google Contacts export),
 * and free-form pasted text (name + number per line). 100% local, nothing uploaded except
 * the final { name, phone } list to the user's own contact book.
 */

export interface ParsedContact {
  name: string
  phone: string
}

/** Keep only digits (server matches numbers by digits). */
function digits(raw: string): string {
  return (raw || '').replace(/\D/g, '')
}

function isValidPhone(raw: string): boolean {
  const d = digits(raw)
  return d.length >= 7 && d.length <= 15
}

function cleanName(raw: string): string {
  return raw
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/gi, ' ')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/** Dedupe by digits, drop invalid entries, cap size. */
export function dedupeContacts(list: ParsedContact[], cap = 2000): ParsedContact[] {
  const seen = new Set<string>()
  const out: ParsedContact[] = []
  for (const c of list) {
    if (!isValidPhone(c.phone)) continue
    const key = digits(c.phone)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: c.name || key, phone: c.phone })
    if (out.length >= cap) break
  }
  return out
}

/* ---------------- vCard (.vcf) ---------------- */

interface VCardEntry {
  name: string
  tels: string[]
}

/** Unfold folded vCard lines (continuation lines start with space/tab). */
function unfoldVCard(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines: string[] = []
  for (const line of raw) {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function parseVCardValue(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':')
  if (idx < 0) return null
  const key = line.slice(0, idx).toUpperCase()
  const value = line.slice(idx + 1).trim()
  if (!value) return null
  return { key, value }
}

function parseVCard(text: string): ParsedContact[] {
  const lines = unfoldVCard(text)
  const out: ParsedContact[] = []
  let cur: VCardEntry | null = null

  const flush = () => {
    if (cur && cur.tels.length) {
      // prefer a mobile-ish number if present, else first
      const cell = cur.tels.find((t) => /CELL|MOBILE|IPHONE/i.test(t)) ?? cur.tels[0]
      out.push({ name: cleanName(cur.name) || digits(cell), phone: cell })
    }
    cur = null
  }

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (upper.startsWith('BEGIN:VCARD')) {
      cur = { name: '', tels: [] }
      continue
    }
    if (upper.startsWith('END:VCARD')) {
      flush()
      continue
    }
    if (!cur) continue

    const kv = parseVCardValue(line)
    if (!kv) continue

    if (kv.key.startsWith('FN')) {
      cur.name = kv.value
    } else if (kv.key.startsWith('N') && !kv.key.startsWith('NICKNAME')) {
      // N:Last;First;Middle;Prefix;Suffix — only used if FN missing
      if (!cur.name) {
        const parts = kv.value.split(';').map((p) => p.trim()).filter(Boolean)
        if (parts.length >= 2) cur.name = `${parts[1]} ${parts[0]}`
        else cur.name = parts[0] ?? ''
      }
    } else if (kv.key.includes('TEL')) {
      // item1.TEL;...:+92 300 1234567 — strip any X- params, keep value
      const tel = kv.value.replace(/[^+\d\s\-().]/g, '').trim()
      if (isValidPhone(tel)) cur.tels.push(tel)
    }
    // ignore PHOTO, ADR, EMAIL, ORG, etc.
  }
  flush()
  return out
}

/* ---------------- CSV ---------------- */

/** Minimal RFC-4180-ish CSV row splitter (handles quoted commas). */
function splitCsvRow(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',' || ch === ';' || ch === '\t') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

/** Google Contacts exports columns like "Phone 1 - Value"; E.164 numbers keep leading +. */
function looksLikePhoneCell(cell: string): boolean {
  const d = digits(cell)
  if (d.length < 7 || d.length > 15) return false
  // avoid treating years/ids as phones when they are plain short numbers without + or separators
  return /^[+\d][\d\s\-().]+$/.test(cell)
}

function parseCsv(text: string): ParsedContact[] {
  const rows = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((r) => r.trim())
  const out: ParsedContact[] = []
  const startRow = rows.length && /name|phone|contact/i.test(rows[0]) ? 1 : 0

  for (let i = startRow; i < rows.length; i++) {
    const cells = splitCsvRow(rows[i])
    if (!cells.length) continue
    let name = ''
    const tels: string[] = []
    for (const cell of cells) {
      if (!cell) continue
      if (looksLikePhoneCell(cell)) tels.push(cell)
      else if (!name && /[a-z\u00C0-\u024F]/i.test(cell) && cell.length <= 40 && !/^https?:/i.test(cell)) {
        name = cell
      }
    }
    const phone = tels[0]
    if (phone && isValidPhone(phone)) out.push({ name: cleanName(name), phone })
  }
  return out
}

/* ---------------- pasted free-form text ---------------- */

const PHONE_TOKEN = /(\+?\d[\d\s\-().]{5,}\d|\+?\d{7,15})/

function parsePasted(text: string): ParsedContact[] {
  const out: ParsedContact[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('//')) continue
    const m = t.match(PHONE_TOKEN)
    if (!m) continue
    const phone = m[1].trim()
    if (!isValidPhone(phone)) continue
    let name = (t.slice(0, m.index) + t.slice((m.index ?? 0) + m[1].length))
      .replace(/[,;:\t|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    name = cleanName(name)
    out.push({ name, phone })
  }
  return out
}

/* ---------------- dispatcher ---------------- */

export type ImportSource = 'vcf' | 'csv' | 'paste'

export function parseContactsSource(source: ImportSource, text: string): ParsedContact[] {
  switch (source) {
    case 'vcf':
      return dedupeContacts(parseVCard(text))
    case 'csv':
      return dedupeContacts(parseCsv(text))
    case 'paste':
      return dedupeContacts(parsePasted(text))
  }
}

/** Parse an uploaded file by name extension (.vcf, .csv, .txt). */
export function parseContactFile(fileName: string, text: string): ParsedContact[] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.vcf') || /BEGIN:VCARD/i.test(text)) return parseContactsSource('vcf', text)
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return parseContactsSource('csv', text)
  // .txt or unknown: try vCard, then CSV, then paste — pick whichever found more
  const candidates = [
    parseContactsSource('vcf', text),
    parseContactsSource('csv', text),
    parseContactsSource('paste', text),
  ]
  return candidates.reduce((best, cur) => (cur.length > best.length ? cur : best))
}

/** Pretty label for a parsed phone (digits only, grouped). */
export function formatParsedPhone(phone: string): string {
  const d = digits(phone)
  return d.length > 10 ? `+${d.slice(0, d.length - 10)} ${d.slice(-10)}` : d
}
