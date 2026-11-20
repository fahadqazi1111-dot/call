/* eslint-disable @typescript-eslint/no-require-imports -- plain-Node pre-build guard (runs without bun) */
/**
 * Pre-build environment guard — FIRST step of `npm run build`.
 *
 * The #1 deployment failure mode is building without a production
 * DATABASE_URL: the app compiles fine but every API call then fails at
 * runtime, and NEXT_PUBLIC_* values get baked empty. Fail fast here with
 * instructions instead of shipping a broken deploy.
 *
 * Environment values are read from BOTH sources, in order:
 *   1. process.env           (hosting panels often inject env vars directly)
 *   2. <root>/.env           (the file the deploy ZIP must carry)
 *
 * Exits 1 (build fails with a visible message) when:
 *   - no DATABASE_URL anywhere
 *   - DATABASE_URL is still a SQLite/file: URL (this build targets MySQL —
 *     see prisma/schema.mysql.prisma)
 *   - DATABASE_URL still contains placeholder credentials
 *
 * Exits 0 with warnings for soft issues (NEXT_PUBLIC_APP_URL placeholder).
 */
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const envPath = path.join(root, '.env')

console.log('\n=== CALL build: environment check ===')

const fail = (msg) => {
  console.error('\n' + msg + '\n')
  process.exit(1)
}

const readFileVars = () => {
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$/)
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2]
  }
  return out
}

const fileVars = readFileVars()
const effective = (name) => process.env[name] || fileVars[name] || ''

const DB_TEMPLATE = [
  '  DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME"',
  '  NEXT_PUBLIC_SOCKET_URL="/"',
  '  NEXT_PUBLIC_SOCKET_PATH="/socket.io/"',
  '  NEXT_PUBLIC_APP_URL="https://your-domain.hostingersite.com"',
].join('\n')

if (!fs.existsSync(envPath) && !process.env.DATABASE_URL) {
  fail(
    [
      'ERROR: no .env file in the project root and no DATABASE_URL in the environment.',
      '',
      'The ZIP downloaded from GitHub does NOT include .env (it holds secrets and is',
      'never committed). Create a file named `.env` next to package.json with:',
      '',
      DB_TEMPLATE,
      '',
      'DB_USER / DB_PASSWORD / DB_NAME come from your hosting panel',
      '(hPanel -> Databases -> MySQL Databases). Then rebuild.',
    ].join('\n')
  )
}

const dbUrl = effective('DATABASE_URL')
if (!dbUrl) {
  fail('ERROR: no DATABASE_URL (neither in the environment nor in .env). Add:  DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME"')
}
if (/^(file|sqlite):/i.test(dbUrl)) {
  fail(
    'ERROR: DATABASE_URL is a SQLite/file: URL but this build uses the MySQL schema\n' +
      '(prisma/schema.mysql.prisma). Point it to your hosting MySQL server, e.g.\n' +
      '  DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME"\n' +
      '(Local dev SQLite is fine for `next dev`, not for this MySQL production build.)'
  )
}
if (/USER:PASSWORD@|DB_USER:DB_PASSWORD/i.test(dbUrl)) {
  fail('ERROR: DATABASE_URL still contains placeholder credentials. Fill in the real DB user, password and name from your hosting panel.')
}

const appUrl = effective('NEXT_PUBLIC_APP_URL')
if (!appUrl || /your-domain/i.test(appUrl)) {
  console.warn('WARNING: NEXT_PUBLIC_APP_URL is missing or a placeholder — set it to the public site URL (used for share links).')
}

const socketUrl = effective('NEXT_PUBLIC_SOCKET_URL')
if (!socketUrl) {
  console.warn('WARNING: NEXT_PUBLIC_SOCKET_URL not set — realtime still works (same-origin default), but add NEXT_PUBLIC_SOCKET_URL="/" for clarity.')
}

console.log('OK: environment looks buildable (' + dbUrl.replace(/:\/\/[^@]*@/, '://***@') + ')\n')
