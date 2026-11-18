import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, normalizePhone, publicUser } from '@/lib/callapp/server'

/**
 * Verify OTP. If the phone is not registered yet, respond { needName: true } so
 * the client collects the display name, then resend with { name } to finish signup.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const normalized = normalizePhone(body.phone || '')
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    const code = String(body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 })
    }
    const otp = await db.otp.findFirst({
      where: { phone: normalized, consumed: false, code },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code is wrong or expired. Request a new one.' }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { phone: normalized } })
    if (!user) {
      const name = String(body.name || '').trim()
      if (!name) {
        // Do NOT consume the code yet - it will be used once the name arrives.
        return NextResponse.json({ needName: true, phone: normalized })
      }
      await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })
      user = await db.user.create({
        data: {
          phone: normalized,
          name: name.slice(0, 40),
          avatarKey: Math.floor(Math.random() * 8),
        },
      })
    } else {
      await db.otp.update({ where: { id: otp.id }, data: { consumed: true } })
      if (body.name && body.name.trim() && body.name.trim() !== user.name) {
        user = await db.user.update({ where: { id: user.id }, data: { name: String(body.name).trim().slice(0, 40) } })
      }
    }
    await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
    return NextResponse.json({
      ok: true,
      token: signToken(user.id),
      user: publicUser(user),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
