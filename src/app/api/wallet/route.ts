import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getFinance, ensureCoinWallet, getCoinSettings } from '@/lib/callapp/server'
import { walletSnapshot } from '@/lib/callapp/finance'
import { getPaymentConfig } from '@/lib/callapp/payments'

/**
 * GET — REAL-MONEY earnings wallet + COIN wallet (in-app currency).
 *
 * USD wallet:
 *   - balances: available / reserved / lifetime totals
 *   - ledger entries (central financial ledger)
 *   - gift history with full breakdown (gross / commission / fee / net)
 *   - withdrawals + bank accounts + finance config + provider mode
 *
 * Coin wallet:
 *   - coins balance + lifetime counters (purchased/converted/spent/received)
 *   - coin ledger entries (last 60) — every coin balance change
 *   - coin settings (packs, coinsPerUsd, convertBonusPercent, master switch)
 */
export async function GET(req: Request) {
  const me = await requireUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [wallet, finance, payCfg, coinSettings, coinWalletRow] = await Promise.all([
    walletSnapshot(me.id),
    getFinance(),
    getPaymentConfig(),
    getCoinSettings(),
    ensureCoinWallet(me.id),
  ])

  const [ledger, giftSends, withdrawals, bankAccounts, coinLedger] = await Promise.all([
    db.ledgerEntry.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
    db.giftSend.findMany({
      where: { recipientId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        gift: { select: { name: true, emoji: true, imageUrl: true } },
        sender: { select: { id: true, name: true, avatarKey: true, avatarUrl: true } },
      },
    }),
    db.withdrawal.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    db.bankAccount.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' } }),
    db.coinLedgerEntry.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
  ])

  return NextResponse.json({
    wallet,
    currency: finance.currency,
    minWithdrawal: finance.minWithdrawal,
    withdrawalMethods: finance.withdrawalMethods,
    provider: { id: payCfg.provider, isTest: payCfg.provider === 'sandbox' },
    ledger: ledger.map((l) => ({
      id: l.id,
      kind: l.kind,
      direction: l.direction,
      amount: l.amount,
      availableAfter: l.availableAfter,
      reservedAfter: l.reservedAfter,
      note: l.note,
      refType: l.refType,
      refId: l.refId,
      createdAt: l.createdAt.toISOString(),
    })),
    gifts: giftSends.map((s) => ({
      id: s.id,
      gift: { name: s.gift.name, emoji: s.gift.emoji, imageUrl: s.gift.imageUrl },
      from: { id: s.sender.id, name: s.sender.name, avatarKey: s.sender.avatarKey, avatarUrl: s.sender.avatarUrl },
      context: s.context,
      grossAmount: s.grossAmount,
      grossCoins: s.grossCoins,
      commission: s.commission,
      feeAmount: s.feeAmount,
      netAmount: s.netAmount,
      currency: s.currency,
      paymentMethod: s.paymentMethod,
      isTest: s.isTest,
      createdAt: s.createdAt.toISOString(),
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      currency: w.currency,
      method: w.method,
      status: w.status,
      adminNote: w.adminNote,
      transferRef: w.transferRef,
      bankName: safeParse(w.bankDetails).bankName || null,
      maskedAccount: maskAccount(safeParse(w.bankDetails).accountNumber),
      createdAt: w.createdAt.toISOString(),
      paidAt: w.paidAt ? w.paidAt.toISOString() : null,
    })),
    bankAccounts: bankAccounts.map((b) => ({
      id: b.id,
      holderName: b.holderName,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      iban: b.iban,
      swift: b.swift,
      countryCode: b.countryCode,
      isDefault: b.isDefault,
      masked: maskAccount(b.accountNumber),
      createdAt: b.createdAt.toISOString(),
    })),
    coinWallet: {
      coins: coinWalletRow.coins,
      totalPurchased: coinWalletRow.totalPurchased,
      totalConverted: coinWalletRow.totalConverted,
      totalSpent: coinWalletRow.totalSpent,
      totalReceived: coinWalletRow.totalReceived,
    },
    coinLedger: coinLedger.map((c) => ({
      id: c.id,
      kind: c.kind,
      direction: c.direction,
      amount: c.amount,
      coinsAfter: c.coinsAfter,
      note: c.note,
      refType: c.refType,
      refId: c.refId,
      createdAt: c.createdAt.toISOString(),
    })),
    coinSettings,
  })
}

function safeParse(raw: string | null | undefined): Record<string, string> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function maskAccount(num?: string): string {
  if (!num) return ''
  const clean = num.replace(/\s+/g, '')
  if (clean.length <= 4) return clean
  return `•••• ${clean.slice(-4)}`
}
