import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, rateLimit } from '@/lib/callapp/server'

/** Validate bank-account payloads. Account number is the minimum viable id. */
function validate(body: Record<string, unknown>) {
  const holderName = String(body.holderName || '').trim().slice(0, 80)
  const bankName = String(body.bankName || '').trim().slice(0, 80)
  const accountNumber = String(body.accountNumber || '').replace(/\s+/g, '').slice(0, 34)
  const iban = String(body.iban || '').replace(/\s+/g, '').slice(0, 34) || null
  const swift = String(body.swift || '').replace(/\s+/g, '').slice(0, 11).toUpperCase() || null
  const countryCode = String(body.countryCode || '').trim().slice(0, 2).toUpperCase()
  if (!holderName) return { error: 'Account holder name is required' }
  if (!bankName) return { error: 'Bank name is required' }
  if (!/^[a-zA-Z0-9]{6,34}$/.test(accountNumber)) {
    return { error: 'Account number must be 6–34 letters/numbers' }
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) return { error: 'Country code required' }
  return { data: { holderName, bankName, accountNumber, iban, swift, countryCode } }
}

/** GET — my bank accounts (masked account numbers). */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accounts = await db.bankAccount.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({
    accounts: accounts.map((b) => ({
      id: b.id,
      holderName: b.holderName,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      iban: b.iban,
      swift: b.swift,
      countryCode: b.countryCode,
      isDefault: b.isDefault,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}

/** POST — add a bank account (bank transfer is the only withdrawal method). */
export async function POST(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`bank:${me.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const v = validate(body)
    if ('error' in v && v.error) return NextResponse.json({ error: v.error }, { status: 400 })
    if (!('data' in v) || !v.data) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    const count = await db.bankAccount.count({ where: { userId: me.id } })
    const account = await db.bankAccount.create({
      data: { ...v.data, userId: me.id, isDefault: count === 0 || body.isDefault === true },
    })
    if (account.isDefault) {
      await db.bankAccount.updateMany({ where: { userId: me.id, id: { not: account.id } }, data: { isDefault: false } })
    }
    return NextResponse.json({ ok: true, account })
  } catch {
    return NextResponse.json({ error: 'Failed to add bank account' }, { status: 500 })
  }
}

/** DELETE ?id= — remove one of my bank accounts. */
export async function DELETE(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') || ''
  const account = await db.bankAccount.findUnique({ where: { id } })
  if (!account || account.userId !== me.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.bankAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
